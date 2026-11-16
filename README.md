# Reusable Enterprise AI Engineering Standards & Multi-Agent Framework (`.agents/`)

This repository provides a **production-grade, universal AI engineering framework** designed to be reused and centrally synchronized by **Engineering Managers, Principal Architects, and Tech Leads** across backend, frontend, and full-stack projects.

---

## 📁 Repository Architecture

```text
.
├── .agents/
│   ├── hooks.json                       # Native Antigravity Lifecycle Hooks (PreToolUse & PostToolUse)
│   ├── project-context.example.md       # Project-Specific Override Template (Protected during Sync)
│   ├── rules/                           # 11 Modular Engineering Standards (Progressive Disclosure Glob Triggers)
│   │   ├── 01-security-and-owasp.md     # [always_on] OWASP Top 10 Web (A01-A10) & OWASP LLM (LLM01-LLM10)
│   │   ├── 02-ui-ux-human-craft.md      # [glob: UI] Anti-Glassmorphism, Solid Surfaces, Tactile Physics
│   │   ├── 03-architecture-and-code.md  # [always_on] Clean Architecture, Use-Case Driven, Result<T, E> Pattern
│   │   ├── 04-database-and-cqrs.md      # [glob: DB] CQRS 3NF vs Read Projections, UUIDv7, Optimistic Lock
│   │   ├── 05-observability-otel.md     # [glob: Code] AsyncLocalStorage Trace Correlation, OTel W3C, NDJSON
│   │   ├── 06-testing-strategy.md       # [glob: Test] Testing Pyramid (70/20/10), AAA Pattern, Mock Boundaries
│   │   ├── 07-git-branch-and-pr.md      # [always_on] Trunk-Based Development, Branch Regex, PR Size Governance
│   │   ├── 08-devops-and-iac.md         # [glob: Infra] Multi-Stage Distroless Docker, Non-Root, Terraform State
│   │   ├── 09-frontend-engineering.md   # [glob: FE] State Triad (TanStack/URL/Zustand), RHF+Zod, Zero CLS
│   │   ├── 10-monolith-vs-microservices.md # [always_on] ADR Matrix, Modular Monolith, Outbox, Saga, Circuit Breaker
│   │   └── 11-computational-complexity-and-metrics.md # [always_on] Big-O O(1) Lookups, CWV/RED/USE/DORA SLOs
│   ├── skills/                          # 5 Actionable Engineering Skills / Runbooks (On-Demand)
│   │   ├── scaffold-vertical-slice/     # End-to-End Feature Slice Generator (Domain -> UseCase -> Port -> Test)
│   │   ├── staff-pr-review/             # 6-Pillar Staff Engineer PR & Code Review Rubric
│   │   ├── owasp-security-audit/        # OWASP Web (A01-A10) & LLM (LLM01-LLM10) Security Assessment Runbook
│   │   ├── zero-downtime-migration/     # Lock-Free Expand-and-Contract Database Migration Validator
│   │   └── adr-writer/                  # Architecture Decision Record Generator (docs/adr/)
│   ├── agents/                          # 6 Specialist Subagents (Native Markdown Frontmatter + JSON)
│   │   ├── coordinator.{md,json}        # Lead Engineering Manager & Task Orchestrator
│   │   ├── security-auditor.{md,json}   # Read-Only Security & OWASP Pentester (Least Privilege)
│   │   ├── ui-craftsman.{md,json}       # Tactile UI/UX, Design Tokens & Frontend Specialist
│   │   ├── database-architect.{md,json} # Database, 3NF, UUIDv7 & CQRS Specialist
│   │   ├── qa-engineer.{md,json}        # Test Automation, Testcontainers & AAA Pattern Specialist
│   │   └── devops-platform.{md,json}    # Platform, CI/CD, Containerization & SRE Specialist
│   ├── hooks/                           # Deterministic Lifecycle Hook Scripts (Dual-Mode JSON stdin + CLI)
│   │   ├── hooks.json                   # Mirror PreToolUse & PostToolUse Configuration
│   │   └── scripts/
│   │       ├── pre-command-guard.sh     # 5-Layer Defense-in-Depth Agent Safety Harness
│   │       ├── post-edit-styler.sh      # Architectural Invariant Checker & Auto-Formatter
│   │       └── harness-verify.sh        # 1-Click 5-Gate Deterministic Verification Suite
│   ├── scripts/
│   │   └── sync-to-project.sh           # Multi-Project Rollout & Upgrade CLI for Engineering Managers
│   └── templates/                       # Production-Ready Boilerplates (100% Verified)
│       ├── harness/                     # Application Test Harness Templates
│       │   ├── integration-harness.ts   # Docker Testcontainers (PostgreSQL 16 + Redis 7 Ephemeral Runner)
│       │   └── frontend-render-harness.tsx # RTL Custom Render + QueryClient + MemoryRouter Wrapper
│       ├── use-case-template.ts         # Clean Architecture Handler + Native RFC 9562 UUIDv7 + Outbox + Result
│       ├── idempotency-middleware.ts    # Scoped Idempotency-Key Lock, Response Capture & Cache Replay
│       ├── circuit-breaker-client.ts    # Rolling-Window Circuit Breaker + Half-Open Probe Gate + Full Jitter
│       ├── saga-coordinator.ts          # Distributed Saga Orchestrator + LIFO Rollback + DLQ + OTel Log
│       ├── outbox-worker.ts             # Transactional Outbox Worker + W3C traceparent Propagation
│       ├── frontend-query-form.tsx      # TanStack Query + RHF + Zod + Accessible Tactile Form
│       ├── otel-logger.ts               # Structured NDJSON Logger + AsyncLocalStorage W3C Trace Context
│       ├── Dockerfile.distroless        # Multi-Stage Distroless Non-Root + Native Node /livez Healthcheck
│       └── terraform-base.tf            # Encrypted Terraform S3 Remote State + DynamoDB State Locking
├── .claude/                             # Native Claude Code Configuration
│   ├── settings.json                    # Native Claude Code PreToolUse & PostToolUse Hooks
│   ├── agents/                          # 6 Native Claude Code Subagents (*.md)
│   └── skills/                          # 5 Native Claude Code Skills (*/SKILL.md)
├── .cursor/
│   └── rules/
│       └── engineering-standards.mdc    # Modern Cursor Rules (MDC)
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md         # Enterprise 6-Pillar Pull Request Checklist
│   ├── copilot-instructions.md          # Universal Adapter for GitHub Copilot
│   └── workflows/
│       └── ci-cd-pipeline.yml           # Smart Adaptive Multi-Stage GitHub Actions Pipeline
├── AGENTS.md                            # Universal Standard Entrypoint (Antigravity, OpenAI Codex, Cursor)
├── CLAUDE.md                            # Universal Adapter for Claude Code
├── .cursorrules                         # Universal Adapter for Cursor IDE
├── .windsurfrules                       # Universal Adapter for Windsurf (Codeium Cascade)
└── .env.example                         # Standard Application Environment Variables Template
```

---

## 🌐 Universal Multi-Agent Compatibility

This starter kit is 100% interoperable across all major AI coding ecosystems out of the box:

| AI Coding Platform | Native Configuration Files | Capabilities Activated Automatically |
| :--- | :--- | :--- |
| **Google Antigravity** | `AGENTS.md`, `.agents/hooks.json`, `.agents/rules/`, `.agents/skills/`, `.agents/agents/*.md` | Progressive disclosure rules (`always_on` & `glob`), 5 on-demand skills, 6 native subagents, and real-time `PreToolUse` / `PostToolUse` JSON hooks. |
| **Claude Code** | `CLAUDE.md`, `.claude/settings.json`, `.claude/agents/*.md`, `.claude/skills/*/SKILL.md` | Project instructions, 6 native delegatable subagents, 5 skills, and real-time `Bash` & `Edit\|Write` guard hooks. |
| **OpenAI Codex** | `AGENTS.md`, `.agents/skills/*/SKILL.md` | Hierarchical `AGENTS.md` instructions and modular procedural skills. |
| **Cursor IDE** | `.cursorrules`, `.cursor/rules/*.mdc`, `AGENTS.md` | Automatic architectural rule indexing during code generation and refactoring. |
| **Windsurf** | `.windsurfrules`, `AGENTS.md` | Full Cascade context enforcing Clean Architecture, CQRS, and Anti-Glassmorphism. |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Guides inline completions and automated PR reviews in VS Code, JetBrains, and GitHub. |

---

## 🚀 Multi-Project Rollout & Synchronization (For Engineering Managers)

Use the automated `sync-to-project.sh` CLI to install or upgrade this framework across any number of downstream project repositories without overwriting project-specific overrides (`.agents/project-context.md`):

```bash
# 1. Install or upgrade the framework in a target repository (including local Git pre-commit hook)
./.agents/scripts/sync-to-project.sh /path/to/target-project --with-git-hooks

# 2. Customize the target project's specific tech stack & bounded contexts in:
#    /path/to/target-project/.agents/project-context.md

# 3. Run the 5-Gate Verification Harness at any time:
./.agents/hooks/scripts/harness-verify.sh
```
