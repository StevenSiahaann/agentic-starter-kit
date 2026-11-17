# Contributor & Day-1 Developer Onboarding Guide

Welcome to the **`.agents/` Enterprise Production Engineering Framework**! This guide helps human software engineers and AI coding agents contribute safely, rapidly, and in full compliance with our architectural invariants.

---

## ⚡ 5-Minute Developer Quickstart

Get your local development environment and verification suite running in under 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/StevenSiahaann/agentic-starter-kit.git
cd agentic-starter-kit

# 2. Spin up local development infrastructure (PostgreSQL 16, Redis 7, Jaeger OTel)
make up

# 3. Execute the 5-Gate Automated Verification Harness
make verify

# 4. Run the runtime algorithm self-test
make self-test

# 5. Run synthetic canary health check
make canary
```

Access local developer tools:
* **PostgreSQL 16**: `localhost:5432` (`app_user` / `app_secure_password_123` / `app_db`) with pre-initialized `schema-baseline.sql`.
* **Redis 7**: `localhost:6379`.
* **Jaeger Tracing UI**: `http://localhost:16686`.

---

## 🏗️ Architectural Invariants (Non-Negotiable)

All contributions MUST adhere to the invariants defined in `.agents/rules/`:
1. **Clean Architecture & Result Pattern**: Business logic resides strictly in Domain Entities and Use-Case Handlers. Never throw domain exceptions; return `Result<T, E>`.
2. **Anti-Glassmorphism**: Zero `backdrop-blur` in UI components. Use solid surface layers (`#0B0F19`, `#161F30`, `#F8FAFC`).
3. **Database & CQRS**: Primary keys MUST be RFC 9562 **UUIDv7**. All mutations MUST be protected by `Idempotency-Key` and transactional `outbox_events`.
4. **Structured Logging**: Zero raw `console.log`. Use structured NDJSON logger with automatic PII redaction and W3C `trace_id` correlation.
5. **Testing Pyramid**: Write explicit Arrange-Act-Assert (`// 1. ARRANGE`, `// 2. ACT`, `// 3. ASSERT`) tests. Never mock domain entities or ORM drivers.

---

## 🛠️ Everyday Engineering Workflows

### 1. Scaffolding a New Feature Slice
Do not manually write boilerplate. Activate the `scaffold-vertical-slice` skill:
```bash
# Prompt your AI agent:
"Scaffold a vertical slice for creating a payment subscription with UUIDv7, outbox events, and AAA unit tests."
```

### 2. Scaffolding a Brand New Microservice
Create an entire Clean Architecture microservice folder in 1 command:
```bash
make new-service NAME=notification-service
```

### 3. Running Pre-Commit Verifications
Before committing changes, execute:
```bash
make verify
```
All 5 gates (Secrets, Architectural Invariants, Syntax, Typecheck, and Algorithm Self-Test) must report `[PASS]`.

---

## 📦 Pull Request (PR) Governance & Standards

Governed by `.agents/rules/07-git-branch-and-pr.md`:
* **Trunk-Based Development**: Branch lifetimes MUST NOT exceed $48\text{ hours}$.
* **Branch Naming**: Format as `feat/<issue-id>-<short-description>`, `fix/...`, or `chore/...`.
* **Conventional Commits**: Commit messages are enforced locally via `commit-msg-guard.sh`:
  * Format: `<type>(<optional-scope>): <description>`
  * Examples: `feat(billing): add idempotency middleware`, `fix(outbox): handle timeout`
* **PR Diff Target**: Keep PRs small and reviewable ($\le 400$ Lines of Code changed).
* **Definition of Done (DoD)**:
  - [x] `make verify` passes with zero warnings.
  - [x] Domain branch coverage $\ge 95\%$.
  - [x] New endpoints include OpenAPI 3.1 documentation.
  - [x] PR description follows `.github/PULL_REQUEST_TEMPLATE.md`.

