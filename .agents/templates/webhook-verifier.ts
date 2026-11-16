/**
 * Production Webhook Signature Verifier & Transactional Inbox Handler Template
 * Implements: Constant-time HMAC-SHA256 verification (crypto.timingSafeEqual),
 * 5-minute timestamp replay protection, and idempotent Transactional Inbox deduplication.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { appLogger } from './otel-logger';

export interface WebhookVerifyOptions {
  secret: string;
  rawBody: Buffer | string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  toleranceSeconds?: number; // Default: 300s (5 minutes)
}

export interface InboxEventRecord {
  readonly id: string;
  readonly provider: string;
  readonly providerEventId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}

export interface InboxRepositoryPort {
  /**
   * Executes: INSERT INTO inbox_events (...) VALUES (...) ON CONFLICT (provider, provider_event_id) DO NOTHING
   * Returns true if inserted (first time seen), or false if duplicate.
   */
  tryInsertIdempotent(event: InboxEventRecord): Promise<boolean>;
}

export function verifyWebhookSignature(options: WebhookVerifyOptions): {
  valid: boolean;
  reason?: string;
} {
  const {
    secret,
    rawBody,
    signatureHeader,
    timestampHeader,
    toleranceSeconds = 300,
  } = options;

  if (!signatureHeader || !timestampHeader) {
    return { valid: false, reason: 'Missing signature or timestamp header' };
  }

  // 1. Validate timestamp tolerance window to prevent Replay Attacks
  const webhookEpochSeconds = Number(timestampHeader);
  if (!Number.isFinite(webhookEpochSeconds)) {
    return { valid: false, reason: 'Malformed webhook timestamp header' };
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowEpochSeconds - webhookEpochSeconds) > toleranceSeconds) {
    return { valid: false, reason: 'Webhook timestamp outside allowed tolerance window (Replay rejected)' };
  }

  // 2. Compute expected HMAC-SHA256 over "${timestamp}.${rawBody}"
  const rawBodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const signedPayload = `${timestampHeader}.${rawBodyString}`;
  const expectedHex = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  const normalizedReceived = signatureHeader.replace(/^sha256=/i, '').trim();

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const receivedBuf = Buffer.from(normalizedReceived, 'hex');

  // 3. Constant-time comparison to prevent timing side-channel attacks
  if (expectedBuf.length === 0 || expectedBuf.length !== receivedBuf.length) {
    return { valid: false, reason: 'Signature length mismatch' };
  }

  if (!timingSafeEqual(expectedBuf, receivedBuf)) {
    return { valid: false, reason: 'Cryptographic HMAC signature mismatch' };
  }

  return { valid: true };
}

export async function handleInboundWebhook(
  opts: WebhookVerifyOptions & {
    id: string;
    provider: string;
    providerEventId: string;
    eventType: string;
    parsedPayload: Record<string, unknown>;
  },
  inboxRepo: InboxRepositoryPort
): Promise<{ httpStatus: 200 | 202 | 401; body: Record<string, unknown> }> {
  const verification = verifyWebhookSignature(opts);
  if (!verification.valid) {
    appLogger.warn(
      'Rejected inbound webhook due to signature/replay verification failure',
      { provider: opts.provider, reason: verification.reason },
      'WEBHOOK_REJECTED'
    );
    return {
      httpStatus: 401,
      body: { code: 'WEBHOOK_SIGNATURE_INVALID', detail: verification.reason },
    };
  }

  const isFirstDelivery = await inboxRepo.tryInsertIdempotent({
    id: opts.id,
    provider: opts.provider,
    providerEventId: opts.providerEventId,
    eventType: opts.eventType,
    payload: opts.parsedPayload,
  });

  if (!isFirstDelivery) {
    appLogger.info(
      'Ignored duplicate webhook delivery via Transactional Inbox',
      { provider: opts.provider, providerEventId: opts.providerEventId },
      'WEBHOOK_DUPLICATE_IGNORED'
    );
    return {
      httpStatus: 200,
      body: { status: 'DUPLICATE_IGNORED', provider_event_id: opts.providerEventId },
    };
  }

  appLogger.info(
    'Persisted inbound webhook to Transactional Inbox for async processing',
    { provider: opts.provider, providerEventId: opts.providerEventId, eventType: opts.eventType },
    'WEBHOOK_ACCEPTED'
  );

  return {
    httpStatus: 202,
    body: { status: 'ACCEPTED', provider_event_id: opts.providerEventId },
  };
}
