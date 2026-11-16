# 2. Modular Monolith with Transactional Outbox by Default

Date: 2026-11-16  
Status: Accepted  
Deciders: Engineering Management, Principal Architects  
Governed by: `.agents/rules/10-monolith-vs-microservices.md` and `.agents/rules/04-database-and-cqrs.md`  

---

## Context
When designing backend services for enterprise domains, teams frequently default to premature microservice decomposition. This introduces distributed system failure modes (network latency, distributed transactions, partial failures, split-brain data states, complex local development, and heavy Kubernetes orchestration overhead) before team cognitive boundaries or independent scaling requirements justify it.

Conversely, unconstrained monolithic codebases frequently deteriorate into unmaintainable "God Services" with tight in-memory coupling and circular database dependencies.

## Decision
We adopt the **Modular Monolith by Default, Microservices by Exception** architectural standard:
1. **Bounded Modules**: Code is strictly partitioned by business domains into isolated modules (e.g. `src/modules/billing/`, `src/modules/orders/`).
2. **Clean Architecture Ports & Adapters**: Each module encapsulates its own Domain Entities, Value Objects, Use-Case Handlers, and Repository Ports. Modules must never import internal database models or private handlers from another module directly.
3. **In-Process Communication**: Communication between modules is mediated via public Application DTO contracts or in-memory events.
4. **Transactional Outbox Pattern**: When cross-module or external event dissemination is required, events are atomically written to the `outbox_events` table in the same database transaction as the domain state mutation.
5. **Clear Microservice Extraction Boundary**: Because each module adheres to strict database schemas, explicit DTOs, and outbox event streams, extracting any single module into a standalone microservice requires zero domain logic refactoring when operational scale demands it.

## Consequences
### Positive
- **Simplicity**: Single deployable container (`Dockerfile.distroless`) and single database connection pool.
- **Fast Local Developer Experience**: Full system can be spun up in 2 seconds via `make up` (`docker-compose.yml`).
- **ACID Integrity**: Local database transactions guarantee atomic consistency between domain state and outbox events.
- **Zero Distributed Latency**: In-process calls run in microseconds rather than network milliseconds.

### Negative / Trade-offs
- Must enforce architectural invariants (via `harness-verify.sh`) to prevent accidental tight coupling across module boundaries.
- Database resource contention must be managed via proper B-Tree indexing, keyset pagination, and connection pooling.

