# AGENTS.md — Universal Enterprise AI Engineering Standard

This repository is governed by the **`.agents/` Production Engineering Framework**. All AI coding agents (Google Antigravity, Claude Code, OpenAI Codex, Cursor, Windsurf, and GitHub Copilot) operating in this workspace MUST adhere to the architectural invariants, security guardrails, and verification gates defined below.

---

## 0. Project-Specific Context Override
If `.agents/project-context.md` exists in this repository, read it first. It defines this project's specific language/runtime stack, bounded contexts, and approved exceptions while keeping all core security and architectural invariants intact.

---

## 1. Modular Engineering Rules (`.agents/rules/` — 3-Tier Progressive Disclosure)

| Rule File | Trigger Tier | Core Mandate |
| :--- | :--- | :--- |
| [01-security-and-owasp.md](.agents/rules/01-security-and-owasp.md) | `glob` (Code/SQL) | Zero hardcoded secrets; OWASP Web Top 10 (A01–A10) & OWASP LLM Top 10 (LLM01–LLM10); Argon2id; 100% parameterized queries; SSRF private IP block. |
| [02-ui-ux-human-craft.md](.agents/rules/02-ui-ux-human-craft.md) | `glob` (UI files) | **Anti-Glassmorphism** (no `backdrop-blur`); Solid Surface Layering (`#0B0F19`, `#161F30`, `#F8FAFC`); WCAG 2.1 AA contrast $\ge 4.5:1$; tactile press physics. |
| [03-architecture-and-code.md](.agents/rules/03-architecture-and-code.md) | `glob` (Backend) | Clean Architecture Use-Case Driven (no God Services); Rich Domain Entities; `Result<T, E>` for domain errors (4xx, `WARN`) vs masked 500 RFC 7807 for system errors; `Idempotency-Key` on mutations. |
| [04-database-and-cqrs.md](.agents/rules/04-database-and-cqrs.md) | `glob` (DB/Repo) | CQRS (3NF Command model vs Planned Denormalized Read projections); RFC 9562 **UUIDv7** primary keys; `version` column for optimistic locking; FK B-Tree indexes; `idempotency_keys` & `outbox_events` tables. |
| [05-observability-otel.md](.agents/rules/05-observability-otel.md) | `glob` (Code) | Single-line NDJSON structured logging with automatic PII redaction; zero raw `console.log`; automatic W3C `trace_id` & `span_id` correlation via `AsyncLocalStorage`; `X-Trace-Id` response header. |
| [06-testing-strategy.md](.agents/rules/06-testing-strategy.md) | `glob` (Tests) | Testing Pyramid (70% Unit / 20% Integration via Testcontainers / 10% E2E); explicit `Arrange-Act-Assert (AAA)` blocks; never mock domain entities or ORM drivers; $\ge 95\%$ domain branch coverage. |
| [07-git-branch-and-pr.md](.agents/rules/07-git-branch-and-pr.md) | `model_decision` | Trunk-Based Development (branch lifetime $<48\text{h}$); Conventional Commits; PR diff target $\le 400$ LOC; `CODEOWNERS` review; never push directly to `main` or use `--force`. |
| [08-devops-and-iac.md](.agents/rules/08-devops-and-iac.md) | `glob` (Infra) | Multi-stage Distroless non-root containers (`<150\text{MB}`); native `/livez` & `/readyz` probes; `SIGTERM` graceful shutdown; Terraform encrypted remote state locking. |
| [09-frontend-engineering.md](.agents/rules/09-frontend-engineering.md) | `glob` (Frontend) | State Triad: Server state (TanStack Query), URL state (`nuqs`), Client UI state (Zustand); React Hook Form + Zod; structural skeletons (CLS $< 0.1$); Granular Error Boundaries. |
| [10-monolith-vs-microservices.md](.agents/rules/10-monolith-vs-microservices.md) | `model_decision` | **Modular Monolith by Default, Microservices by Exception**; Database-per-Service; Transactional Outbox Pattern; Saga Orchestrator with LIFO compensation; Circuit Breaker with Full Jitter. |
| [11-computational-complexity-and-metrics.md](.agents/rules/11-computational-complexity-and-metrics.md) | `glob` (Code/SQL) | $O(1)$ in-memory lookups via `Map`/`Set` (forbid $O(N \times M)$ nested loops); $O(1)$ space streaming for files $>10\text{MB}$; Keyset/Cursor pagination; CWV, RED, USE, and DORA SLO targets. |
| [12-api-design-and-versioning.md](.agents/rules/12-api-design-and-versioning.md) | `glob` (API/DTO) | Contract-First OpenAPI 3.1 & Swagger UI (`/api/docs`, `/api/openapi.json`); `{ data, meta }` & cursor pagination envelopes; `/api/v1/` versioning; RFC 8594 `Deprecation` & `Sunset` headers. |
| [13-caching-and-rate-limiting.md](.agents/rules/13-caching-and-rate-limiting.md) | `glob` (Cache/DB) | Cache-Aside with **Jittered TTL** (anti-stampede); versioned cache keys; Optimistic (`version`) vs Pessimistic (`FOR UPDATE SKIP LOCKED`) locking; multi-tier `RateLimit-*` headers. |
| [14-data-privacy-and-compliance.md](.agents/rules/14-data-privacy-and-compliance.md) | `model_decision` | 4-Tier Data Classification (`PUBLIC`, `INTERNAL`, `CONFIDENTIAL_PII`, `RESTRICTED_SECRET`); recursive PII log redaction; append-only `audit_logs` table; GDPR / UU PDP Crypto-Shredding. |
| [15-financial-time-and-i18n.md](.agents/rules/15-financial-time-and-i18n.md) | `model_decision` | Integer minor units (`BIGINT`) / `NUMERIC(19,4)` for money (zero floats); Banker's Rounding; Double-Entry `ledger_entries`; `UTC` storage + Monotonic Clocks (`performance.now()`). |
| [16-webhooks-and-event-contracts.md](.agents/rules/16-webhooks-and-event-contracts.md) | `model_decision` | Constant-time `crypto.timingSafeEqual` HMAC-SHA256 on raw body; 5-minute replay guard; Transactional Inbox (`inbox_events` deduplication); CloudEvents 1.0 envelope. |
| [17-feature-flags-and-progressive-delivery.md](.agents/rules/17-feature-flags-and-progressive-delivery.md) | `model_decision` | 4 Flag categories (Release $\le 14\text{d}$ TTL, Operational Kill-Switches, Experiment, Entitlement); SHA-256 Consistent Hashing rollouts; Dual-State (`ON`/`OFF`) testing. |
| [18-multi-tenancy-and-background-jobs.md](.agents/rules/18-multi-tenancy-and-background-jobs.md) | `model_decision` | Multi-tenant isolation via PostgreSQL Row-Level Security (`ENABLE ROW LEVEL SECURITY`); resumable chunked batch/cron jobs ($200\text{–}1,000$ rows) with cursor checkpointing. |

---

## 2. Actionable Engineering Skills (`.agents/skills/`)
Activate these step-by-step runbooks when performing core engineering workflows:
- **`scaffold-vertical-slice`** ([SKILL.md](.agents/skills/scaffold-vertical-slice/SKILL.md)): Generate a complete feature slice (Domain Entity $\rightarrow$ Use-Case $\rightarrow$ Repository Port $\rightarrow$ Controller $\rightarrow$ AAA Tests).
- **`staff-pr-review`** ([SKILL.md](.agents/skills/staff-pr-review/SKILL.md)): Run a 6-pillar Staff Engineer PR review rubric.
- **`owasp-security-audit`** ([SKILL.md](.agents/skills/owasp-security-audit/SKILL.md)): Execute an OWASP Top 10 Web & LLM security audit.
- **`zero-downtime-migration`** ([SKILL.md](.agents/skills/zero-downtime-migration/SKILL.md)): Author and verify lock-free Expand-and-Contract database migrations.
- **`adr-writer`** ([SKILL.md](.agents/skills/adr-writer/SKILL.md)): Generate Architecture Decision Records (`docs/adr/`).
- **`incident-rca-postmortem`** ([SKILL.md](.agents/skills/incident-rca-postmortem/SKILL.md)): Conduct a blameless 5-Whys Root Cause Analysis and generate a Postmortem (`docs/postmortems/`).
- **`legacy-strangler-refactoring`** ([SKILL.md](.agents/skills/legacy-strangler-refactoring/SKILL.md)): Safely modernize legacy codebases using Characterization (Golden Master) tests and the Strangler Fig pattern.

---

## 3. Specialized Subagents (`.agents/agents/` & `.claude/agents/`)
- **`coordinator`**: Lead Engineering Manager & Orchestrator
- **`security-auditor`**: Read-Only OWASP & Secret Pentester
- **`ui-craftsman`**: Tactile UI/UX, Figma Tokens & Frontend Specialist
- **`database-architect`**: 3NF, CQRS, UUIDv7 & Migration Architect
- **`qa-engineer`**: Test Pyramid, Testcontainers & AAA Specialist
- **`devops-platform`**: Distroless Docker, Terraform IaC & OTel SRE

---

## 4. Mandatory Verification Gate
Before declaring any implementation task complete, committing, or opening a Pull Request, you **MUST** execute:
```bash
./.agents/hooks/scripts/harness-verify.sh
```
All 5 verification gates (Secret Scan, Architectural Invariants, Shell/JSON Config Syntax, Static Typecheck, and Automated Test Suite) must report `[PASS]`.
