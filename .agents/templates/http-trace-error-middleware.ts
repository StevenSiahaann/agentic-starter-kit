/**
 * HTTP W3C Trace Context Ingress Middleware & Global RFC 7807 Problem Details Error Filter
 * Implements: W3C traceparent parsing/generation, AsyncLocalStorage binding,
 * X-Trace-Id response header injection, Monotonic duration measurement, and RFC 7807 Error Taxonomy.
 */

import { randomBytes } from 'crypto';
import { appLogger, traceStorage } from './otel-logger';
import { DomainError } from './use-case-template';

export interface IncomingHttpRequest {
  method: string;
  path: string;
  userId?: string;
  headers: Record<string, string | undefined>;
}

export interface OutgoingHttpResponse {
  status(code: number): this;
  setHeader(name: string, value: string): this;
  json(body: unknown): this;
}

/**
 * Parses an incoming W3C `traceparent` header (`00-<32hex_traceId>-<16hex_spanId>-01`)
 * or generates a fresh cryptographic traceId and spanId at the edge.
 */
export function resolveW3cTraceContext(traceparentHeader?: string): {
  traceId: string;
  spanId: string;
  traceparent: string;
} {
  const w3cRegex = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i;
  const match = traceparentHeader ? w3cRegex.exec(traceparentHeader.trim()) : null;

  const traceId = match ? match[1].toLowerCase() : randomBytes(16).toString('hex');
  const spanId = randomBytes(8).toString('hex');

  return {
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}

/**
 * Middleware wrapping every HTTP request in AsyncLocalStorage trace context,
 * setting correlation headers, measuring monotonic duration, and formatting RFC 7807 errors.
 */
export async function httpTraceAndErrorBoundaryMiddleware(
  req: IncomingHttpRequest,
  res: OutgoingHttpResponse,
  next: () => Promise<void>
): Promise<void> {
  const { traceId, spanId, traceparent } = resolveW3cTraceContext(req.headers['traceparent']);
  const startMonotonicNs = process.hrtime.bigint();

  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('traceparent', traceparent);

  await traceStorage.run({ traceId, spanId, userId: req.userId }, async () => {
    try {
      await next();

      const durationMs = Number(process.hrtime.bigint() - startMonotonicNs) / 1_000_000;
      appLogger.info(
        'HTTP request completed',
        { method: req.method, path: req.path, duration_ms: Number(durationMs.toFixed(2)) },
        'HTTP_REQUEST'
      );
    } catch (error) {
      const durationMs = Number(process.hrtime.bigint() - startMonotonicNs) / 1_000_000;

      // 1. Expected Domain / Business Error (4xx -> Log as WARN)
      if (error instanceof DomainError) {
        appLogger.warn(
          'Domain invariant rejected request',
          { code: error.code, statusCode: error.statusCode, path: req.path, duration_ms: Number(durationMs.toFixed(2)) },
          'DOMAIN_ERROR'
        );

        res
          .setHeader('Content-Type', 'application/problem+json')
          .status(error.statusCode)
          .json({
            type: `https://api.domain.com/errors/${error.code.toLowerCase().replace(/_/g, '-')}`,
            title: error.name,
            status: error.statusCode,
            detail: error.message,
            code: error.code,
            trace_id: traceId,
            timestamp: new Date().toISOString(),
          });
        return;
      }

      // 2. Unexpected System / Infrastructure Error (500 -> Log as ERROR, mask internal details)
      appLogger.error(
        'Unhandled system exception caught at HTTP boundary',
        error,
        { method: req.method, path: req.path, duration_ms: Number(durationMs.toFixed(2)) },
        'SYSTEM_ERROR_500'
      );

      res
        .setHeader('Content-Type', 'application/problem+json')
        .status(500)
        .json({
          type: 'https://api.domain.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected internal error occurred. Please reference trace_id when contacting support.',
          code: 'INTERNAL_SERVER_ERROR',
          trace_id: traceId,
          timestamp: new Date().toISOString(),
        });
    }
  });
}
