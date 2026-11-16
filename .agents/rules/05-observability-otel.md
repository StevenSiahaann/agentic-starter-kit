---
trigger: glob
globs: "**/*.ts, **/*.js, **/*.go, **/*.py"
---

# Production Observability Standards: Structured Logging & OpenTelemetry (OTel)

> **Status:** MANDATORY OBSERVABILITY STANDARD  
> **Target:** All Backend Services, Background Workers, and Outbound HTTP/gRPC Clients.

---

## 1. Structured JSON Logging

Raw `console.log()` calls and unstructured plain-text logs are strictly forbidden in production code. All log output MUST be emitted as **Single-Line JSON (NDJSON)** to `stdout`/`stderr` for seamless ingestion by log aggregators (Datadog, Grafana Loki, Elastic, Cloud Logging).

### Mandatory JSON Log Schema
Every log entry MUST include the following structured fields:
```json
{
  "timestamp": "2026-11-16T11:44:00.125Z",
  "level": "INFO",
  "service": "order-service",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "user_id": "usr_98a72b1c",
  "action": "CREATE_ORDER",
  "message": "Order transaction completed successfully",
  "context": {
    "order_id": "018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
    "total_amount": 4500000,
    "currency": "IDR"
  },
  "duration_ms": 128.4
}
```

### Log Level Taxonomy:
- **DEBUG**: Granular diagnostic details (enabled only in local development or temporary staging debugging).
- **INFO**: Normal application lifecycle milestones (service started, order created, payment settled).
- **WARN**: Handled domain/business errors (`Result.fail`), invalid client payloads (4xx), or transient retries.
- **ERROR**: Unexpected technical/system failures (database timeout, upstream 5xx, unhandled exceptions).
- **FATAL**: Unrecoverable system state forcing process termination (primary database unreachable at boot, port bind failure).

---

## 2. Automatic Trace ID Correlation via `AsyncLocalStorage`

Never pass `trace_id` manually through every function signature across the codebase.

### Context Propagation Mechanism:
1. At the outermost HTTP/gRPC ingress middleware, inspect the incoming W3C `traceparent` header (if called by an upstream service) or generate a fresh 32-hex-character `trace_id` and 16-hex-character `span_id`.
2. Bind the trace context into Node.js **`AsyncLocalStorage`** (or Go `context.Context`).
3. The structured logger (`otel-logger.ts`) automatically extracts `trace_id`, `span_id`, and `user_id` from the active store on every log call:
   ```typescript
   // Developer writes clean business logging:
   appLogger.info('Processing order payment', { orderId }, 'PROCESS_PAYMENT');

   // Logger automatically injects:
   // "trace_id": "4bf92f35...", "span_id": "00f067aa..."
   ```

### HTTP Response Correlation Headers:
Every HTTP response MUST return correlation headers to the caller:
- `X-Trace-Id: <trace-id>`
- `traceparent: 00-<trace-id>-<span-id>-01`

This allows Support and QA engineers to pinpoint exact distributed traces in Grafana/Datadog directly from a browser Network tab or RFC 7807 error payload.

---

## 3. OpenTelemetry (OTel) Distributed Tracing & Metrics

### A. W3C Trace Context Propagation
- All inter-service communications (HTTP, gRPC, Kafka/RabbitMQ message headers, Transactional Outbox events) MUST propagate the W3C `traceparent` header:
  `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
- Broken trace chains across service boundaries are treated as observability defects.

### B. Pre-Main SDK Bootstrap
Initialize the OpenTelemetry `NodeSDK` before importing application modules so auto-instrumentations (HTTP, pg, redis) attach cleanly:
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
  serviceName: process.env.OTEL_SERVICE_NAME || 'core-service',
});

sdk.start();
```

### C. RED & USE Telemetry Signals
1. **RED Metrics** (Service & Endpoint Layer):
   * **Rate**: Requests per second (RPS).
   * **Errors**: Rate of HTTP 5xx / gRPC non-OK responses.
   * **Duration**: Latency distribution histograms ($p50$, $p95$, $p99$).
2. **USE Metrics** (Infrastructure & Resource Layer):
   * **Utilization**: CPU, memory, and database connection pool usage percentages.
   * **Saturation**: Connection pool wait queue depth and Node.js event loop lag.
   * **Errors**: Socket drops, OOM kills, and disk I/O failures.
