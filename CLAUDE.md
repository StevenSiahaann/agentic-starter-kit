# CLAUDE.md — Enterprise Engineering Instructions for Claude Code

This repository adheres to the **`.agents/` Production Engineering Framework**. Read `AGENTS.md` (and `.agents/project-context.md` if present) as your primary architectural map, and load modular rules from `.agents/rules/` dynamically based on the files and tasks you are working on.

---

## 🎯 Core Architectural Invariants (Quick Reference)

1. **Security & Privacy First (`01-security-and-owasp.md` & `14-data-privacy-and-compliance.md`)**:
   - Zero hardcoded credentials or secrets. Never read or write live `.env` files (edit `.env.example` only).
   - Enforce OWASP Web Top 10 (A01–A10) and OWASP LLM Top 10 (LLM01–LLM10): domain-layer ownership checks (anti-IDOR), 100% parameterized queries, Zod boundary validation, SSRF private CIDR blocks, and recursive PII redaction in logs.

2. **Clean Architecture & API Contracts (`03-architecture-and-code.md` & `12-api-design-and-versioning.md`)**:
   - Decompose business logic into single-responsibility Use-Case Command/Query Handlers and Rich Domain Entities (no God Services).
   - Return `Result<T, DomainError>` for expected business errors (4xx, logged as `WARN`); mask unexpected system errors as HTTP 500 RFC 7807 Problem Details with `trace_id`.
   - Enforce `/api/v1/` URI versioning, OpenAPI 3.1 contract alignment, and Cursor Pagination envelopes (`{ data, meta }`).
   - Reference template: `.agents/templates/use-case-template.ts`.

3. **CQRS, Concurrency, & Caching (`04-database-and-cqrs.md` & `13-caching-and-rate-limiting.md`)**:
   - 3NF normalized Command models with RFC 9562 **UUIDv7** primary keys and `version` column for optimistic locking; planned denormalized Read projections for queries.
   - Enforce scoped `Idempotency-Key` locks on mutations (`.agents/templates/idempotency-middleware.ts`).
   - Prevent Cache Stampede using **Jittered TTLs**; use `FOR UPDATE SKIP LOCKED` for multi-pod outbox/queue polling.

4. **Distributed Resiliency & Observability (`05-observability-otel.md`, `08-devops-and-iac.md`, `10-monolith-vs-microservices.md`)**:
   - Default to Modular Monolith; extract Microservices only when justified by the ADR matrix.
   - Use Transactional Outbox (`.agents/templates/outbox-worker.ts`), Saga Orchestrator with LIFO compensation (`.agents/templates/saga-coordinator.ts`), Circuit Breaker with Full Jitter (`.agents/templates/circuit-breaker-client.ts`), and Graceful Shutdown probes (`.agents/templates/graceful-shutdown.ts`).
   - Emit single-line NDJSON logs correlated with W3C `trace_id` via `AsyncLocalStorage` (`.agents/templates/otel-logger.ts`). Never use raw `console.log`.

5. **Frontend Craft & Computational Complexity (`02-ui-ux-human-craft.md`, `09-frontend-engineering.md`, `11-computational-complexity-and-metrics.md`)**:
   - **Anti-Glassmorphism**: Zero `backdrop-blur`; 100% opaque Solid Surface Layering (`#0B0F19`, `#161F30`, `#F8FAFC`), WCAG 2.1 AA contrast $\ge 4.5:1$, tactile hard shadows.
   - State Triad: TanStack Query (server), `nuqs` (URL), Zustand (local UI); React Hook Form + Zod; structural skeletons ($\text{CLS} < 0.1$).
   - Enforce $O(1)$ lookups via `Map`/`Set` inside loops and $O(1)$ memory streaming for payloads $>10\text{MB}$.

6. **Testing & Git Governance (`06-testing-strategy.md` & `07-git-branch-and-pr.md`)**:
   - Testing Pyramid (70% Unit / 20% Testcontainers Integration / 10% E2E) using explicit `Arrange-Act-Assert (AAA)` blocks.
   - Trunk-Based Development ($<48\text{h}$ branches), Conventional Commits, PRs $\le 400$ LOC.

---

## 🛠️ Native Subagents & Skills
- **Subagents (`.claude/agents/`)**: `coordinator`, `security-auditor`, `ui-craftsman`, `database-architect`, `qa-engineer`, `devops-platform`.
- **Skills (`.claude/skills/`)**: `scaffold-vertical-slice`, `staff-pr-review`, `owasp-security-audit`, `zero-downtime-migration`, `adr-writer`, `incident-rca-postmortem`.

---

## 🔒 Mandatory Verification Gate
Before declaring any task complete or creating a commit/PR, ALWAYS execute:
```bash
./.agents/hooks/scripts/harness-verify.sh
```
