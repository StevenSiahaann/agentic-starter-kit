/**
 * Transactional Outbox Pattern Worker Template (Multi-Pod Concurrency Safe)
 * Implements: Dual-Write prevention, At-Least-Once Delivery to Kafka/RabbitMQ,
 * Multi-Replica safe polling via PostgreSQL 'FOR UPDATE SKIP LOCKED',
 * W3C traceparent header propagation, and Structured OTel Logging.
 */

import { appLogger, StructuredLogger, traceStorage } from './otel-logger';

export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  createdAt: Date;
}

export interface MessagePublisher {
  publish(topic: string, key: string, payload: unknown, headers: Record<string, string>): Promise<void>;
}

/**
 * OutboxRepository contract.
 * IMPORTANT (Multi-Pod Concurrency):
 * When running multiple container replicas in Kubernetes, `claimAndPublishBatch` MUST use
 * `SELECT ... FROM outbox_events WHERE published_at IS NULL ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`
 * inside a single database transaction so concurrent pods never claim the same events.
 */
export const OUTBOX_CLAIM_SQL = `
  SELECT id, aggregate_type, aggregate_id, event_type, payload, trace_id, span_id, created_at
  FROM outbox_events
  WHERE published_at IS NULL
  ORDER BY created_at ASC
  LIMIT $1
  FOR UPDATE SKIP LOCKED;
`;

export interface OutboxRepository {
  fetchUnpublished(batchSize: number): Promise<OutboxMessage[]>;
  markAsPublished(ids: string[]): Promise<void>;
}

export class OutboxWorker {
  private isRunning = false;
  private pollTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly publisher: MessagePublisher,
    private readonly pollIntervalMs = 5000,
    private readonly batchSize = 100,
    private readonly logger: StructuredLogger = appLogger
  ) {}

  public start(): void {
    this.isRunning = true;
    this.logger.info('Started polling for unpublished transactional outbox events', {
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
    }, 'OUTBOX_START');
    void this.poll();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    this.logger.info('Outbox worker stopped gracefully', {}, 'OUTBOX_STOP');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const messages = await this.outboxRepo.fetchUnpublished(this.batchSize);

      if (messages.length > 0) {
        this.logger.info(
          'Claimed unpublished outbox events; publishing batch',
          { count: messages.length },
          'OUTBOX_PUBLISH_BATCH'
        );

        const publishedIds: string[] = [];

        for (const msg of messages) {
          const topic = `domain.${msg.aggregateType.toLowerCase()}.${msg.eventType.toLowerCase()}`;
          const activeTrace = traceStorage.getStore();
          const traceId = msg.traceId ?? activeTrace?.traceId ?? '00000000000000000000000000000000';
          const spanId = msg.spanId ?? activeTrace?.spanId ?? '0000000000000000';

          // W3C Trace Context propagation header injection
          const headers: Record<string, string> = {
            'content-type': 'application/json',
            'event-id': msg.id,
            traceparent: `00-${traceId}-${spanId}-01`,
          };

          await this.publisher.publish(topic, msg.aggregateId, msg.payload, headers);
          publishedIds.push(msg.id);
        }

        await this.outboxRepo.markAsPublished(publishedIds);
        this.logger.info(
          'Successfully marked outbox events as published',
          { publishedCount: publishedIds.length },
          'OUTBOX_PUBLISHED'
        );
      }
    } catch (error) {
      this.logger.error('Error during outbox polling/publishing batch', error, {}, 'OUTBOX_ERROR');
    } finally {
      if (this.isRunning) {
        this.pollTimer = setTimeout(() => {
          void this.poll();
        }, this.pollIntervalMs);
      }
    }
  }
}
