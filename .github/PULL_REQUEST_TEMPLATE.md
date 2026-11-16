## 📌 Summary of Changes
<!-- Describe concisely: what business/technical problem is solved and the architectural approach taken -->

### Change Type
- [ ] `feat`: New user-facing or API feature
- [ ] `fix`: Bug fix or defect resolution
- [ ] `perf`: Performance or Big-O algorithmic optimization
- [ ] `refactor`: Clean Architecture / Use-Case restructuring (no external behavior change)
- [ ] `sec`: Security patch or OWASP vulnerability remediation
- [ ] `chore`: Build tooling, dependencies, or CI/CD update

### Related Issue / Ticket
- Issue / Ticket: #

---

## 🛡️ Enterprise Engineering Quality Checklist (Mandatory)

### 1. Security & OWASP Compliance
- [ ] **Zero Hardcoded Secrets**: No API keys, JWT secrets, passwords, or private keys committed.
- [ ] **Injection Prevention**: 100% of database queries use parameterized bindings / ORM prepared statements; external inputs validated via Zod.
- [ ] **IDOR & Access Control**: Ownership and tenancy (`user_id` / `tenant_id`) validated inside the domain/use-case layer using server-verified session context.

### 2. Clean Architecture & Resiliency
- [ ] **Use-Case Driven**: Business logic resides in single-responsibility Command/Query Handlers and Rich Domain Entities (no God Services).
- [ ] **Error Taxonomy**: Domain errors return `Result<T, DomainError>` (4xx, logged as `WARN`); System errors return masked 500 RFC 7807 Problem Details with `trace_id`.
- [ ] **Idempotency**: State-mutating endpoints enforce scoped `Idempotency-Key` locking and response replay.
- [ ] **Trace Correlation**: All structured NDJSON logs include W3C `trace_id` and `span_id` via `AsyncLocalStorage` (zero raw `console.log`).

### 3. Database & CQRS
- [ ] Command (Write) models adhere to 3NF with RFC 9562 **UUIDv7** primary keys and `version` optimistic locking column.
- [ ] Every Foreign Key has an explicit B-Tree index and an explicit `ON DELETE` rule.
- [ ] Schema migrations follow the backward-compatible *Expand-and-Contract* pattern (zero table locks).

### 4. UI/UX & Frontend Engineering
- [ ] **Anti-Glassmorphism**: Zero `backdrop-filter: blur()`; built with 100% opaque Solid Surface Layering and tactile press physics.
- [ ] **Accessibility (WCAG 2.1 AA)**: Contrast $\ge 4.5:1$; form inputs bind `aria-invalid` & `aria-describedby`; full keyboard navigation.
- [ ] **State Triad**: Server state in TanStack Query, filter/pagination state in URL params (`nuqs`), local UI state in Zustand.
- [ ] **Zero CLS**: Structural skeleton placeholders match exact layout geometry ($\text{CLS} < 0.1$); wrapped in granular Error Boundaries.

### 5. Computational Complexity (Big-O) & Testing
- [ ] **$O(1)$ Lookups**: In-memory correlations inside loops use `Map` or `Set` (zero $O(N \times M)$ nested array scans).
- [ ] **$O(1)$ Space Streaming**: Payloads/files $> 10\text{MB}$ processed via Streams / Async Iterators; database lists use Cursor/Keyset pagination.
- [ ] **Testing & Verification**: Unit and Testcontainers Integration tests follow explicit `Arrange-Act-Assert (AAA)` blocks, and `./.agents/hooks/scripts/harness-verify.sh` passes all 5 gates.

---

## 📸 Verification Evidence / Screenshots
<!-- Attach terminal verification output or UI screenshots/recordings for frontend changes -->
