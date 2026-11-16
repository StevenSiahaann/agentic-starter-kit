/**
 * Dead Letter Queue (DLQ) & Poison-Pill Replay Worker
 *
 * Implements resilient asynchronous event processing for Transactional Outbox,
 * Webhook Ingestion, and Cron Background Jobs.
 *
 * Core Capabilities:
 * 1. Exponential Backoff with Full Jitter for transient failure recovery.
 * 2. Automatic Poison-Pill Quarantine into `dead_letter_events` table on terminal failure.
 * 3. Diagnostic preservation (original payload snapshot, stack trace, W3C trace_id, tenant_id).
 * 4. Idempotent batch replay engine with execution limits.
 *
 * Database DDL Requirement:
 * ```sql
 * CREATE TABLE IF NOT EXISTS dead_letter_events (
 *   id VARCHAR(36) PRIMARY KEY,                  -- RFC 9562 UUIDv7
 *   tenant_id VARCHAR(64) NOT NULL,              -- PostgreSQL RLS tenant boundary
 *   original_event_id VARCHAR(64) NOT NULL,      -- Correlation to source outbox/inbox event
 *   event_type VARCHAR(128) NOT NULL,            -- e.g., 'order.payment_completed'
 *   payload JSONB NOT NULL,                      -- Immutable snapshot of failed event
 *   error_message TEXT NOT NULL,                 -- Root cause exception summary
 *   error_stack TEXT,                            -- Stack trace for postmortem debugging
 *   retry_count INT NOT NULL DEFAULT 0,          -- Number of failed processing attempts
 *   status VARCHAR(32) NOT NULL DEFAULT 'QUARANTINED', -- QUARANTINED | REPLAYED | DISCARDED
 *   original_trace_id VARCHAR(64),               -- W3C Distributed trace ID
 *   quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   replayed_at TIMESTAMPTZ,
 *   CONSTRAINT chk_dlq_status CHECK (status IN ('QUARANTINED', 'REPLAYED', 'DISCARDED'))
 * );
 * CREATE INDEX IF NOT EXISTS idx_dlq_tenant_status ON dead_letter_events(tenant_id, status);
 * CREATE INDEX IF NOT EXISTS idx_dlq_event_type ON dead_letter_events(event_type);
 * ```
 */

export type DlqStatus = 'QUARANTINED' | 'REPLAYED' | 'DISCARDED';

export interface DeadLetterRecord<T = Record<string, unknown>> {
  readonly id: string;
  readonly tenantId: string;
  readonly originalEventId: string;
  readonly eventType: string;
  readonly payload: T;
  readonly errorMessage: string;
  readonly errorStack?: string;
  readonly retryCount: number;
  readonly status: DlqStatus;
  readonly originalTraceId?: string;
  readonly quarantinedAt: Date;
  readonly replayedAt?: Date;
}

export interface DlqRepository {
  quarantine(record: Omit<DeadLetterRecord, 'quarantinedAt' | 'status'>): Promise<void>;
  fetchQuarantined(options: { tenantId?: string; eventType?: string; limit: number }): Promise<DeadLetterRecord[]>;
  markReplayed(id: string, replayedAt: Date): Promise<void>;
  markDiscarded(id: string, reason: string): Promise<void>;
}

export interface DlqLogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelayMs: 200,
  maxDelayMs: 10_000,
  backoffFactor: 2.0,
};

/**
 * Calculates exponential backoff with full jitter:
 * delay = random(0, min(maxDelay, initialDelay * (factor ^ attempt)))
 */
export function calculateBackoffWithJitter(
  attempt: number,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): number {
  const exponentialCap = Math.min(
    options.maxDelayMs,
    options.initialDelayMs * Math.pow(options.backoffFactor, attempt)
  );
  return Math.floor(Math.random() * (exponentialCap + 1));
}

/**
 * Executes an async task with retry backoff.
 * If all retries are exhausted, automatically routes event to DLQ quarantine.
 */
export async function executeWithRetryAndDlq<TPayload extends Record<string, unknown>>(params: {
  readonly eventId: string;
  readonly eventType: string;
  readonly tenantId: string;
  readonly payload: TPayload;
  readonly traceId?: string;
  readonly handler: (payload: TPayload) => Promise<void>;
  readonly dlqRepo: DlqRepository;
  readonly logger: DlqLogger;
  readonly retryOptions?: Partial<RetryOptions>;
}): Promise<{ success: boolean; quarantined: boolean }> {
  const options: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...params.retryOptions };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      await params.handler(params.payload);
      return { success: true, quarantined: false };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      params.logger.warn('Event processing attempt failed, backing off', {
        eventId: params.eventId,
        eventType: params.eventType,
        attempt: attempt + 1,
        maxAttempts: options.maxAttempts,
        error: lastError.message,
        traceId: params.traceId,
      });

      if (attempt < options.maxAttempts - 1) {
        const delay = calculateBackoffWithJitter(attempt, options);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Max retries exhausted: Quarantine as Poison-Pill
  const dlqId = `dlq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const finalError = lastError ?? new Error('Unknown terminal processing error');

  params.logger.error('Poison-pill detected: quarantining event to Dead Letter Queue', {
    dlqId,
    eventId: params.eventId,
    eventType: params.eventType,
    tenantId: params.tenantId,
    retryCount: options.maxAttempts,
    error: finalError.message,
    traceId: params.traceId,
  });

  await params.dlqRepo.quarantine({
    id: dlqId,
    tenantId: params.tenantId,
    originalEventId: params.eventId,
    eventType: params.eventType,
    payload: params.payload,
    errorMessage: finalError.message,
    errorStack: finalError.stack,
    retryCount: options.maxAttempts,
    originalTraceId: params.traceId,
  });

  return { success: false, quarantined: true };
}

/**
 * Replays a batch of quarantined dead letter records safely.
 */
export async function replayDlqBatch<TPayload extends Record<string, unknown>>(params: {
  readonly dlqRepo: DlqRepository;
  readonly handler: (record: DeadLetterRecord<TPayload>) => Promise<void>;
  readonly logger: DlqLogger;
  readonly batchSize?: number;
  readonly tenantId?: string;
  readonly eventType?: string;
}): Promise<{ replayed: number; failed: number }> {
  const records = await params.dlqRepo.fetchQuarantined({
    tenantId: params.tenantId,
    eventType: params.eventType,
    limit: params.batchSize ?? 50,
  });

  let replayedCount = 0;
  let failedCount = 0;

  for (const record of records) {
    try {
      await params.handler(record as DeadLetterRecord<TPayload>);
      await params.dlqRepo.markReplayed(record.id, new Date());
      replayedCount++;

      params.logger.info('Dead letter record replayed successfully', {
        dlqId: record.id,
        originalEventId: record.originalEventId,
        eventType: record.eventType,
      });
    } catch (replayError: unknown) {
      failedCount++;
      const err = replayError instanceof Error ? replayError : new Error(String(replayError));
      
      params.logger.error('Failed to replay dead letter record', {
        dlqId: record.id,
        originalEventId: record.originalEventId,
        error: err.message,
      });
    }
  }

  return { replayed: replayedCount, failed: failedCount };
}
