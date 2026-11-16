---
trigger: model_decision
description: Git branching strategy (Trunk-Based Development), branch naming regex, Conventional Commits specification, and Pull Request governance. Activate when creating branches, committing changes, or opening/reviewing Pull Requests.
---

# Git Workflow Standard: Branching Strategy, Conventional Commits, & PR Governance

> **Status:** MANDATORY ENGINEERING STANDARD  
> **Target:** All Engineering Teams and Autonomous AI Agents.

---

## 1. Branching Strategy: Trunk-Based Development (TBD)

We adopt **Trunk-Based Development (TBD)** to maximize delivery velocity, maintain continuous integration, and eliminate long-lived merge conflicts (*merge hell*).

### A. Core Principles of TBD
1. **Single Release-Ready Trunk**: The `main` branch represents stable, verified code that passes all automated gates and is continuously deployable to production.
2. **Short-Lived Feature Branches**: All feature branches MUST be merged within **24 to 48 hours**.
3. **Decouple Release from Deployment via Feature Flags**: Features requiring more than 2 days of effort MUST be broken into small vertical slices or gated behind **Feature Flags / Toggles**. Never isolate a feature branch for weeks.

### B. Branch Naming Convention (Regex Enforcement)
All branches MUST match the following regular expression:
`^(feature|fix|hotfix|chore|refactor|release)\/[a-z0-9-]+$`

| Branch Type | Naming Pattern | Example |
| :--- | :--- | :--- |
| **New Feature** | `feature/<issue-id>-<slug>` | `feature/proj-101-radial-navigation` |
| **Bug Fix** | `fix/<issue-id>-<slug>` | `fix/proj-204-db-deadlock` |
| **Critical Production Patch** | `hotfix/<slug>` | `hotfix/auth-token-expiry` |
| **Tooling & Dependencies** | `chore/<slug>` | `chore/upgrade-otel-sdk` |
| **Code Refactoring** | `refactor/<slug>` | `refactor/split-use-case-handlers` |
| **Release Train** | `release/v<version>` | `release/v1.4.0` |

* **Strictly Prohibited**: Raw personal or ambiguous branch names (`john-dev`, `test-branch`, `try-again`, `temp-fix`).

---

## 2. Branch Protection Rules (VCS Level Enforcement)

The `main` branch MUST be protected in GitHub / GitLab with the following rules:
1. **No Direct Pushes**: Direct `git push origin main` is blocked. All changes must go through a Pull Request.
2. **No Force Pushes**: `git push --force` or `git push -f` on `main` is strictly forbidden.
3. **Mandatory Peer Review**: Every PR requires at least **1 approval from `CODEOWNERS`**.
4. **Mandatory Status Checks**:
   - Deterministic Verification Harness (`harness-verify.sh`)
   - Linter & Typecheck (`tsc --noEmit`, ESLint)
   - Security SAST & Secret Scan (Trivy, TruffleHog)
   - Automated Unit & Integration Tests (100% passing)
5. **Up-to-Date Branches**: Branches must be rebased or updated against `main` prior to merge.

---

## 3. Merge Strategy: Squash and Merge

To preserve a clean, linear, and auditable commit history on `main`:
* **Default Merge Method**: Use **Squash and Merge** (consolidating intermediate work-in-progress commits on a feature branch into **1 atomic commit** on `main`).
* **Linear History**: Avoid non-fast-forward merge bubbles on `main`.
* **Auto-Delete Head Branches**: Automatically delete feature branches once merged.

---

## 4. Conventional Commits Specification

Every commit message MUST conform to the Conventional Commits format:
`<type>(<scope>): <subject>`

### Formatting Rules:
- **Subject Length**: Maximum **72 characters**, lowercase imperative mood, and **no trailing period**.
- **Allowed Types**:
  - `feat`: New user-facing or API feature.
  - `fix`: Bug fix or logic defect resolution.
  - `perf`: Performance or Big-O optimization without changing external behavior.
  - `refactor`: Code restructuring without changing external behavior.
  - `test`: Adding or updating unit, integration, or E2E tests.
  - `chore`: Build scripts, tooling, or dependency updates.
  - `docs`: Documentation or ADR updates only.
  - `sec`: Security patch, OWASP mitigation, or CVE remediation.

### Valid Commit Examples:
```text
feat(auth): implement passkey webauthn biometric login
fix(order): resolve race condition on concurrent inventory decrement
perf(database): add composite index for tenant order query
sec(middleware): enforce rate limiting on sensitive otp verification
chore(deps): update opentelemetry sdk to version 1.25.0
```

---

## 5. Pull Request (PR) Governance

- **PR Size Limit**:
  - Maximum **+400 / -400 lines of code** per PR (excluding generated lockfiles). Small PRs ensure thorough reviews and lower production defect rates.
- **Mandatory PR Checklist**:
  1. Business rationale (*Why*) and technical approach (*How*).
  2. Link to Issue Tracker / Ticket.
  3. Screenshot or screen recording (mandatory for UI/UX changes).
  4. All unit and integration tests pass without coverage regression.
  5. Zero leaked secrets or sensitive logs.
  6. Database migrations follow the backward-compatible *Expand-and-Contract* pattern.
