# GitHub Copilot Instructions

Whenever generating code, refactoring, or reviewing Pull Requests in this repository, enforce the production engineering standards defined in `AGENTS.md` and `.agents/rules/`:

## Engineering Standards Checklist
- [ ] **Security & Privacy**: Validate external inputs with Zod; use 100% parameterized queries; enforce domain-layer ownership checks (anti-IDOR); redact PII/secrets in logs (`01-security-and-owasp.md`, `14-data-privacy-and-compliance.md`).
- [ ] **Clean Architecture & API Versioning**: Use single-responsibility Command/Query Handlers, Rich Domain Entities, `Result<T, E>` for domain errors (4xx), masked RFC 7807 Problem Details for 500 errors, and `/api/v1/` cursor-paginated envelopes (`03-architecture-and-code.md`, `12-api-design-and-versioning.md`).
- [ ] **Data Model, Caching, & Concurrency**: Use RFC 9562 UUIDv7 keys, `version` optimistic locking, Foreign Key B-Tree indexes, scoped `Idempotency-Key` middleware, Jittered Cache TTLs, and `FOR UPDATE SKIP LOCKED` for outbox/queue polling (`04-database-and-cqrs.md`, `13-caching-and-rate-limiting.md`).
- [ ] **Distributed Resiliency & Observability**: Use Transactional Outbox, LIFO Saga Orchestrator, Circuit Breaker with Full Jitter, Graceful `SIGTERM` Shutdown (`/livez`, `/readyz`), and `AsyncLocalStorage` W3C `trace_id` NDJSON logging (`05-observability-otel.md`, `08-devops-and-iac.md`, `10-monolith-vs-microservices.md`).
- [ ] **Frontend, Complexity, & Testing**: Enforce Anti-Glassmorphism (solid tactile surfaces), State Triad (TanStack Query / `nuqs` / Zustand), RHF + Zod, structural skeletons ($\text{CLS} < 0.1$), $O(1)$ `Map`/`Set` lookups in loops, and Arrange-Act-Assert (AAA) tests (`02-ui-ux-human-craft.md`, `06-testing-strategy.md`, `09-frontend-engineering.md`, `11-computational-complexity-and-metrics.md`).
