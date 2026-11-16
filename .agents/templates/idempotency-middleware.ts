/**
 * Production Idempotency Middleware Template
 * Implements: Scoped Idempotency-Key validation, Redis/DB atomic lock, response capture & cache replay, RFC 7807 Problem Details
 */

import { createHash } from 'crypto';
import { traceStorage } from './otel-logger';

export interface IdempotencyStore {
  get(scopedKey: string): Promise<IdempotencyRecord | null>;
  setLock(scopedKey: string, requestHash: string, ttlSeconds: number): Promise<boolean>;
  saveResponse(scopedKey: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void>;
  releaseLock(scopedKey: string): Promise<void>;
}

export interface IdempotencyRecord {
  readonly status: 'IN_PROGRESS' | 'COMPLETED';
  readonly requestHash: string;
  readonly statusCode: number;
  readonly responseBody: unknown;
  readonly createdAt: string;
}

export interface HttpRequest {
  method?: string;
  path: string;
  userId?: string;
  headers: Record<string, string | undefined>;
  body: unknown;
}

export interface HttpResponse {
  status(code: number): this;
  setHeader(name: string, value: string): this;
  json(body: unknown): this;
}

export function createIdempotencyMiddleware(store: IdempotencyStore, ttlHours = 24) {
  const ttlSeconds = ttlHours * 3600;
  const inProgressLockSeconds = 60;

  return async function idempotencyMiddleware(
    req: HttpRequest,
    res: HttpResponse,
    next: () => Promise<void>
  ): Promise<void> {
    const rawKey = req.headers['idempotency-key'];

    // 1. Pass through if no Idempotency-Key header is provided
    if (!rawKey) {
      return next();
    }

    const traceId = traceStorage.getStore()?.traceId ?? '00000000000000000000000000000000';
    const actorScope = req.userId ?? traceStorage.getStore()?.userId ?? 'anonymous';
    const methodScope = (req.method ?? 'POST').toUpperCase();
    const scopedKey = `idemp:${actorScope}:${methodScope}:${req.path}:${rawKey}`;

    // 2. Compute deterministic SHA-256 hash of request body to detect payload mismatch
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(req.body ?? {}))
      .digest('hex');

    // 3. Check whether an idempotency record already exists
    const existing = await store.get(scopedKey);

    if (existing) {
      // a. State IN_PROGRESS: Concurrent duplicate request is currently executing
      if (existing.status === 'IN_PROGRESS') {
        res.status(409).json({
          type: 'https://api.domain.com/errors/concurrent-request',
          title: 'Conflict',
          status: 409,
          detail: 'A request with this Idempotency-Key is currently being processed. Please wait and retry.',
          code: 'IDEMPOTENCY_IN_PROGRESS',
          trace_id: traceId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // b. Payload Mismatch: Same Idempotency-Key reused with a different request body
      if (existing.requestHash !== payloadHash) {
        res.status(422).json({
          type: 'https://api.domain.com/errors/idempotency-payload-mismatch',
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Request payload does not match the original payload for this Idempotency-Key.',
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          trace_id: traceId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // c. State COMPLETED: Replay cached status code and response body immediately
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }

    // 4. Acquire Atomic Lock (IN_PROGRESS)
    const acquired = await store.setLock(scopedKey, payloadHash, inProgressLockSeconds);
    if (!acquired) {
      res.status(409).json({
        type: 'https://api.domain.com/errors/concurrent-request',
        title: 'Conflict',
        status: 409,
        detail: 'Concurrent execution conflict detected for this Idempotency-Key.',
        code: 'IDEMPOTENCY_LOCK_FAILED',
        trace_id: traceId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 5. Intercept status & json response methods to persist completed response
    let capturedStatusCode = 200;
    let capturedBody: unknown = undefined;
    let responseSent = false;

    const originalStatus = res.status.bind(res);
    const originalJson = res.json.bind(res);

    res.status = (code: number) => {
      capturedStatusCode = code;
      return originalStatus(code);
    };

    res.json = (body: unknown) => {
      capturedBody = body;
      responseSent = true;
      return originalJson(body);
    };

    try {
      await next();

      if (responseSent && capturedStatusCode < 500) {
        await store.saveResponse(
          scopedKey,
          {
            status: 'COMPLETED',
            requestHash: payloadHash,
            statusCode: capturedStatusCode,
            responseBody: capturedBody,
            createdAt: new Date().toISOString(),
          },
          ttlSeconds
        );
      } else {
        // Release lock on 5xx server errors so the client can safely retry
        await store.releaseLock(scopedKey);
      }
    } catch (error) {
      await store.releaseLock(scopedKey);
      throw error;
    }
  };
}
