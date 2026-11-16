# Changelog

All notable changes to the **`agentic-starter-kit` (`.agents/` Enterprise Engineering Framework)** are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.3.0] - 2026-11-16

### Added
- **Unified Developer Experience (DX) Standard `Makefile`**: Root POSIX-compliant command runner supporting `make verify`, `make self-test`, `make sync TARGET=..`, `make canary`, `make audit`, and `make clean`.
- **Dead Letter Queue (DLQ) & Poison-Pill Replay Worker (`dlq-worker-replay.ts`)**: Resilient async event handling with Exponential Backoff + Full Jitter, automated terminal failure quarantine to PostgreSQL `dead_letter_events`, and idempotent batch replay engine.
- **Zero-Dependency Synthetic Canary & E2E Smoke Harness (`smoke-canary-harness.ts`)**: Fast post-deployment verification of `/livez`, `/readyz`, OpenAPI spec `/api/openapi.json`, Swagger UI `/api/docs`, and latency budget ($p95 < 200\text{ms}$) with W3C `traceparent` propagation.
- **Mutation Testing Standard (Stryker) & Chaos Fault Injection Recipe**: Integrated Section 5 & 6 into `06-testing-strategy.md` requiring $\ge 80\%$ Mutation Score on domain logic, alongside `.agents/templates/stryker.config.json` configuration template.
- **Framework Self-Test Expansion**: Added automated assertions for exponential backoff full jitter bounds in `harness-self-test.mjs`.

---

## [2.2.0] - 2026-11-16

### Added
- **Rule 15 (`15-financial-time-and-i18n.md`)**: Integer minor units (`BIGINT`), Banker's Rounding, Double-Entry Bookkeeping `ledger_entries` schema, `UTC` + IANA timezone rules, and Monotonic Clocks (`performance.now()` / `process.hrtime.bigint()`).
- **Rule 16 (`16-webhooks-and-event-contracts.md`)**: Constant-time `crypto.timingSafeEqual` HMAC-SHA256 verification on raw request bytes, 5-minute replay guard, Transactional Inbox (`inbox_events`), and CloudEvents 1.0 envelope.
- **Rule 17 (`17-feature-flags-and-progressive-delivery.md`)**: 4-category flag governance (Release $\le 14\text{d}$ TTL, Operational Kill-Switches, Experiment, Entitlement), SHA-256 Consistent Hashing rollout formula, and Dual-State testing.
- **Rule 18 (`18-multi-tenancy-and-background-jobs.md`)**: Multi-tenant isolation via PostgreSQL Row-Level Security (`ENABLE ROW LEVEL SECURITY`) and resumable chunked batch/cron jobs with cursor checkpointing.
- **Swagger / OpenAPI 3.1 Registry Template (`openapi-swagger-registry.ts`)**: Automated `/api/openapi.json` spec generation and interactive `/api/docs` Swagger UI endpoint with `BearerAuth`, `Idempotency-Key`, and RFC 7807 `ProblemDetails` components.
- **Glue Templates (`env-validator.ts`, `http-trace-error-middleware.ts`, `webhook-verifier.ts`, `feature-flag-evaluator.ts`)**: Complete ingress-to-egress production templates.
- **Skill #7 (`legacy-strangler-refactoring/SKILL.md`)**: Safe legacy modernization runbook using Characterization Tests and the Strangler Fig pattern.
- **Zero-Dependency Self-Test Suite (`harness-self-test.mjs`)**: Automated unit verification of core framework algorithms using Node's native test runner.
- **Version Tracking & IDE Hygiene**: Added `.agents/VERSION`, `CHANGELOG.md`, and `.editorconfig`.

---

## [2.1.0] - 2026-11-16

### Added
- **3-Tier Progressive Disclosure Token Optimization**: Reduced baseline per-turn context consumption by ~85% (`AGENTS.md` as Tier-1 Always-On Core, `trigger: glob` for Tier-2 file-scoped rules, and `trigger: model_decision` for Tier-3 architectural/workflow rules).
- **Rules 12–14**: `12-api-design-and-versioning.md`, `13-caching-and-rate-limiting.md` (Jittered TTL anti-stampede & `FOR UPDATE SKIP LOCKED`), and `14-data-privacy-and-compliance.md` (4-Tier PII classification, recursive log redaction, and `audit_logs`).
- **Graceful Shutdown Template (`graceful-shutdown.ts`)**: Kubernetes `/livez` and `/readyz` probes with `SIGTERM` 503 draining.
- **Skill #6 (`incident-rca-postmortem/SKILL.md`)**, `.github/CODEOWNERS`, and `.github/dependabot.yml`.

---

## [2.0.0] - 2026-11-16

### Added
- Initial full-English enterprise release with Rules `01`–`11`, 6 native Markdown & JSON specialist subagents (`coordinator`, `security-auditor`, `ui-craftsman`, `database-architect`, `qa-engineer`, `devops-platform`), 5 engineering skills, Dual-Mode `PreToolUse` / `PostToolUse` JSON hooks, Testcontainers & RTL harnesses, and `sync-to-project.sh` multi-project rollout CLI.
