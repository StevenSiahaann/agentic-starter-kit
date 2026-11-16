---
name: staff-pr-review
description: >-
  Conducts a rigorous Staff/Principal Engineer code review on staged changes, branches, or Pull Requests.
  Use when the user asks to review code, audit a PR, check code quality, or prepare a branch for merge.
---

# Staff Engineer PR & Code Review

Follow this structured review rubric to evaluate code changes against enterprise production standards.

## Review Procedure

1. **Inspect Changes**:
   - Run `git status` and `git diff` (or `git diff main...HEAD`) to identify all modified files and line counts (flag if PR exceeds $\pm 400$ LOC excluding lockfiles).

2. **Evaluate Across 6 Pillars**:
   - **Pillar 1 — Security & OWASP ([01-security-and-owasp.md](../../rules/01-security-and-owasp.md))**:
     - Check for IDOR (missing `user_id`/`tenant_id` ownership check in queries).
     - Verify 100% parameterized queries, Zod boundary validation, and zero hardcoded secrets.
   - **Pillar 2 — Architecture & Error Taxonomy ([03-architecture-and-code.md](../../rules/03-architecture-and-code.md))**:
     - Ensure business logic resides in Use-Case handlers and Rich Entities, not controllers.
     - Verify Domain Errors use `Result<T, E>` (logged as `WARN`) while System Errors return masked 500 RFC 7807 responses with `trace_id`.
   - **Pillar 3 — Computational Complexity & Big-O ([11-computational-complexity-and-metrics.md](../../rules/11-computational-complexity-and-metrics.md))**:
     - Flag any nested loops or `.includes()` / `.find()` inside loops ($O(N \times M)$) — require conversion to `Map` or `Set` ($O(1)$ lookup).
     - Flag any N+1 database queries inside loops or unstreamed large payloads ($>10\text{MB}$).
   - **Pillar 4 — Database & Resiliency ([04-database-and-cqrs.md](../../rules/04-database-and-cqrs.md) & [10-monolith-vs-microservices.md](../../rules/10-monolith-vs-microservices.md))**:
     - Check for missing Foreign Key indexes, missing `Idempotency-Key` on mutations, or dual-write bugs without Transactional Outbox.
   - **Pillar 5 — Frontend Craft ([02-ui-ux-human-craft.md](../../rules/02-ui-ux-human-craft.md) & [09-frontend-engineering.md](../../rules/09-frontend-engineering.md))**:
     - Flag any `backdrop-blur` (Glassmorphism), server state stored in Zustand/useEffect instead of TanStack Query, missing skeleton loaders, or missing `aria-invalid`/`aria-describedby`.
   - **Pillar 6 — Testing Quality ([06-testing-strategy.md](../../rules/06-testing-strategy.md))**:
     - Verify AAA pattern comments and ensure domain entities/ORMs are not mocked.

3. **Run Deterministic Gate**:
   - Execute `./.agents/hooks/scripts/harness-verify.sh`.

4. **Output Format**:
   - Present findings grouped by severity: `BLOCKER (Must Fix)`, `WARNING (Should Fix)`, and `NIT (Suggestion)`, citing exact `file:line` references and concrete code fixes.
