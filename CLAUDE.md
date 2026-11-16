# CLAUDE.md - Universal Engineering Instructions for Claude Code

Welcome to this codebase! This repository adheres to strict, production-grade enterprise software engineering standards. Whenever working on this codebase or any project adopting this framework, you MUST read, understand, and strictly adhere to the guidelines established in `.agents/rules/`.

---

## 🎯 Core Operating Principles

1. **Security & Zero Secrets First (`.agents/rules/01-security-and-owasp.md`)**:
   - Zero hardcoded credentials or secrets. Always use environment variables.
   - Guard against OWASP Web Top 10 (A01–A10) and OWASP LLM Top 10 (LLM01–LLM10).
   - Strict input validation via schema parsers (Zod / Valibot / Pydantic) at all system boundaries.
   - Contextual sanitization (DOMPurify, parameterized queries) to prevent XSS and SQL injection.

2. **Clean Architecture & Domain-Driven Design (`.agents/rules/03-architecture-and-code.md`)**:
   - Strictly prohibit "God Services" or anemic controllers.
   - Code must be organized by Use-Cases (Command/Query handlers) with rich domain entities.
   - Use the `Result<T, E>` pattern for domain errors instead of throwing untyped raw exceptions.
   - Adhere to the templates in `.agents/templates/use-case-template.ts`.

3. **CQRS & Data Integrity (`.agents/rules/04-database-and-cqrs.md`)**:
   - 3NF Normalized relational schema for transactional Command operations.
   - Denormalized / materialized read models for complex read queries.
   - Primary keys must use chronological UUIDv7.
   - Mandate audit columns (`created_at`, `updated_at`, `created_by`, `version` for optimistic locking).
   - Mandate Idempotency keys (`Idempotency-Key` HTTP header) with database/Redis locks (`.agents/templates/idempotency-middleware.ts`).

4. **Distributed Systems & Resiliency (`.agents/rules/10-monolith-vs-microservices.md`)**:
   - Default to Modular Monolith with bounded contexts; split to Microservices only when justified by team/scale boundaries.
   - Mandate Transactional Outbox Pattern for domain event publishing (`.agents/templates/outbox-worker.ts`).
   - Mandate Saga Orchestrator with compensating rollback transactions (`.agents/templates/saga-coordinator.ts`).
   - Implement Circuit Breaker with Exponential Backoff + Jitter for external calls (`.agents/templates/circuit-breaker-client.ts`).

5. **Observability & Distributed Tracing (`.agents/rules/05-observability-otel.md`)**:
   - Correlate all logs using W3C `traceparent` / `X-Trace-Id` via Node `AsyncLocalStorage`.
   - Structured single-line NDJSON format. Never use `console.log` for business logs.
   - Reference: `.agents/templates/otel-logger.ts`.

6. **Frontend Engineering & Tactile UI (`.agents/rules/02-ui-ux-human-craft.md` & `09-frontend-engineering.md`)**:
   - Strict state separation: Server state (TanStack Query) vs Client state (Zustand) vs URL state (`nuqs`).
   - Form handling: React Hook Form + Zod schema validation.
   - Anti-Glassmorphism: Use solid tactile surfaces, distinct elevation borders, and subtle physics.
   - Zero Layout Shift: Mandate matching skeleton placeholders for asynchronous loads.
   - Reference: `.agents/templates/frontend-query-form.tsx`.

7. **Computational Complexity & Resource Efficiency (`.agents/rules/11-computational-complexity-and-metrics.md`)**:
   - Enforce $O(1)$ amortized lookups using `Map`/`Set` instead of nested $O(N^2)$ loops.
   - Stream large datasets ($O(1)$ memory consumption) instead of buffering full arrays into memory.
   - Track Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1) and RED/USE/DORA metrics.

8. **Testing Strategy & AAA Pattern (`.agents/rules/06-testing-strategy.md`)**:
   - Testing pyramid: 70% Unit, 20% Integration, 10% E2E.
   - Format all tests strictly in Arrange-Act-Assert (AAA) blocks.
   - Only mock external boundary protocols (HTTP, message queues, third-party APIs); never mock domain entities.

9. **Git & PR Governance (`.agents/rules/07-git-branch-and-pr.md`)**:
   - Trunk-Based Development: feature branches must live < 48 hours.
   - Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
   - PR diffs target $\le 400$ LOC.
   - Never push directly to `main` or use `--force`. Always run security verification before committing.

---

## 🛠️ Specialized Sub-Agent Roles

When performing complex tasks, adopt the specialized personas specified in `.agents/agents/`:
- **Lead / Orchestrator**: `coordinator.json`
- **Security Auditor**: `security-auditor.json` (Read-only, security scanning & compliance)
- **UI Craftsman**: `ui-craftsman.json` (Figma tokens, tactile micro-interactions, responsive a11y)
- **Database Architect**: `database-architect.json` (Schema normalization, indexes, CQRS outbox)
- **QA Engineer**: `qa-engineer.json` (Unit/integration test coverage, edge cases)
- **DevOps Platform**: `devops-platform.json` (Distroless containers, Terraform IaC, CI/CD pipelines)

---

## 🔒 Security Hook Enforcement & Quality Gate

- **Safety Harness**: Before executing bash commands, compliance is checked against `.agents/hooks/scripts/pre-command-guard.sh` (5-layer defense-in-depth: `.env` protection, zero `rm -rf`, no `npm -g`, no direct push to `main`, secret scan).
- **Verification Gate**: Before declaring any task complete or submitting a PR, ALWAYS execute `./.agents/hooks/scripts/harness-verify.sh` to verify zero secret leaks, compliant architectural invariants, and clean testing.

