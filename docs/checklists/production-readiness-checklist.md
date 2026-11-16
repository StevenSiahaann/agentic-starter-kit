# Production Readiness & Go-Live Checklist (25-Point Verification Matrix)

> **Target**: Engineering Managers, Principal Architects, Tech Leads, and SREs conducting a pre-launch Go/No-Go gate before promoting a service to Production.  
> **Governed by**: `.agents/rules/` (Rules 01–18).

---

## 1. Architecture & Resilience (Points 1–5)

- [ ] **1. Clean Architecture Boundaries**: Domain logic resides in pure Entities/Value Objects; no framework dependencies or SQL queries leaked into Domain Layer.
- [ ] **2. Idempotency on All Mutations**: All state-changing HTTP endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require an `Idempotency-Key` header with locked-state deduplication (`idempotency_keys`).
- [ ] **3. Transactional Outbox Pattern**: External events and cross-service messaging are atomically written to `outbox_events` in the same DB transaction as domain state mutations.
- [ ] **4. Circuit Breakers on External Gateways**: Outbound HTTP/gRPC calls to third-party services (Stripe, Twilio, partners) are protected with rolling-window circuit breakers and fallback handlers.
- [ ] **5. Dead Letter Queue (DLQ) & Poison-Pill Quarantine**: Background workers route terminal failures ($\ge 5$ attempts) to `dead_letter_events` with full payload and stack trace preservation.

---

## 2. Security & Compliance (Points 6–10)

- [ ] **6. Zero Hardcoded Secrets**: Scanned via `make verify` / TruffleHog; zero API keys, database passwords, or private certificates committed to git.
- [ ] **7. 100% Parameterized SQL Queries**: No raw string concatenation or interpolation in SQL queries; immune to SQL injection.
- [ ] **8. Multi-Tenant Row-Level Security (RLS)**: PostgreSQL `ENABLE ROW LEVEL SECURITY` active; tenant isolation policy enforced via `current_setting('app.current_tenant_id')`.
- [ ] **9. Webhook Signature Verification**: Inbound webhooks verified using constant-time `crypto.timingSafeEqual` HMAC-SHA256 with a 5-minute replay guard window.
- [ ] **10. Recursive PII Redaction in Logs**: Passwords, tokens, credit card numbers, CVVs, and national IDs automatically scrubbed before emitting NDJSON logs.

---

## 3. Database & Performance (Points 11–15)

- [ ] **11. Primary Keys are UUIDv7**: All primary keys follow RFC 9562 UUIDv7 for monotonically ordered B-Tree index performance without ID enumeration leaks.
- [ ] **12. Foreign Key B-Tree Indexes**: Every foreign key column has an explicit B-Tree index to prevent full-table locks during cascading operations.
- [ ] **13. Connection Pool Sizing**: Connection pool max connections calculated as:  
      $\text{Max Connections} = (\text{Total Pods} \times \text{Pool per Pod}) \le \text{Postgres max\_connections} \times 0.8$.
- [ ] **14. Jittered TTL on Caches**: Redis cache keys configured with randomized jitter ($TTL \pm 10\%$) to eliminate cache stampedes / thundering herds.
- [ ] **15. Keyset / Cursor Pagination**: All list endpoints query using keyset pagination (`WHERE id < :cursor`); zero unbounded `OFFSET` queries.

---

## 4. Observability, Metrics & SRE (Points 16–20)

- [ ] **16. Native Kubernetes Probes**: `/livez` verifies event loop responsiveness; `/readyz` verifies DB & Redis connectivity; returns HTTP 503 during graceful shutdown.
- [ ] **17. W3C Distributed Trace Correlation**: Ingress extracts `traceparent` into `AsyncLocalStorage`; downstream HTTP requests and database logs propagate `trace_id`.
- [ ] **18. Structured NDJSON Logging**: Single-line JSON log format containing timestamp, severity level, service name, `trace_id`, and `tenant_id`. Zero raw `console.log`.
- [ ] **19. Latency Budget Enforced (RED Metrics)**: Critical endpoints meet $p95 < 200\text{ms}$ and error rate $< 0.1\%$ under concurrent load (verified via `k6-load-test.js`).
- [ ] **20. Incident Triage Runbook Available**: On-call engineers trained on [docs/runbooks/incident-triage-runbook.md](../runbooks/incident-triage-runbook.md).

---

## 5. Deployment, Rollback & Governance (Points 21–25)

- [ ] **21. Multi-Stage Distroless Container**: Final container image built from distroless/non-root base with image size $< 150\text{MB}$.
- [ ] **22. Graceful Shutdown Draining**: Process handles `SIGTERM` by stopping HTTP ingress, draining active requests within 30 seconds, and closing database pools cleanly.
- [ ] **23. Expand-and-Contract Migrations**: Database DDL changes are strictly backwards-compatible; application code can roll back without breaking the schema.
- [ ] **24. Operational Feature Kill-Switches**: High-risk features wrapped in feature flags capable of being disabled within 0 seconds without container redeployment.
- [ ] **25. Contract-First API Spec**: OpenAPI 3.1 specification and Swagger UI validated and accessible at `/api/openapi.json` and `/api/docs`.
