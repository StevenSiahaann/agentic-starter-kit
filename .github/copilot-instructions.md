# GitHub Copilot Instructions

Whenever assisting with code generation, code review, or refactoring in this repository, you must adhere to the production engineering guidelines specified in `.agents/rules/`:

## Engineering Standards Checklist
- [ ] **Security**: Input validation using Zod/Pydantic schemas; zero secrets committed; parameterized queries; HTML output sanitization (`.agents/rules/01-security-and-owasp.md`).
- [ ] **Clean Architecture**: Command/Query Use-Case handlers; Rich Domain Entities; `Result<T, E>` error handling; no God Services (`.agents/rules/03-architecture-and-code.md`).
- [ ] **Data Model & CQRS**: UUIDv7 keys; audit columns (`created_at`, `updated_at`, `version`); `Idempotency-Key` header with distributed lock for mutating endpoints (`.agents/rules/04-database-and-cqrs.md`).
- [ ] **Distributed Resiliency**: Transactional Outbox Pattern for events; Saga Orchestrator for rollbacks; Circuit Breaker with exponential backoff & jitter (`.agents/rules/10-monolith-vs-microservices.md`).
- [ ] **Observability**: Distributed trace correlation (`trace_id`, `span_id`) on all structured logs via `AsyncLocalStorage` (`.agents/rules/05-observability-otel.md`).
- [ ] **Testing**: Strict Arrange-Act-Assert (AAA) pattern; mock protocol boundaries only, never domain models (`.agents/rules/06-testing-strategy.md`).
- [ ] **Frontend**: TanStack Query (server state), Zustand (client UI state), `nuqs` (URL state); RHF + Zod; skeleton placeholders to prevent CLS (`.agents/rules/09-frontend-engineering.md`).
- [ ] **Performance**: Prefer `Map`/`Set` for $O(1)$ lookups; stream data with $O(1)$ space complexity (`.agents/rules/11-computational-complexity-and-metrics.md`).

