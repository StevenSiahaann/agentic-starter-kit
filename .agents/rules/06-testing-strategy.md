---
trigger: glob
globs: "**/*.test.ts, **/*.test.tsx, **/*.spec.ts, **/*.spec.tsx, **/tests/**, **/__tests__/**"
---

# Testing Strategy & Quality Standards: Pyramid, AAA Pattern, & Mock Boundaries

> **Status:** MANDATORY ENGINEERING STANDARD  
> **Target:** All Unit, Integration, Component, and End-to-End Test Suites.

---

## 1. The Testing Pyramid

Maintain the target test distribution across the codebase:

```text
       /\
      /  \      10% End-to-End Tests (Playwright)
     /----\
    /      \    20% Integration Tests (Testcontainers / Real DB & Redis)
   /--------\
  /          \  70% Unit Tests (Fast, In-Memory, Pure Domain & Use-Case Logic)
 /------------\
```

### A. 70% Unit Tests (Domain & Business Invariants)
- **Target**: Domain Entities, Value Objects, Use-Case Handlers, Pure Algorithms.
- **Characteristics**:
  - Ultra-fast execution ($< 5\text{ms}$ per test case).
  - **Zero I/O**: No real database connections, no network calls, no filesystem mutations.
  - Exhaustively verify business invariants, boundary conditions, mathematical calculations, and domain error branches.

### B. 20% Integration Tests (Repositories, Adapters, & Middlewares)
- **Target**: SQL Repositories, Database Migrations, Atomic Outbox Transactions, Idempotency Locks.
- **Characteristics**:
  - MUST run against **real ephemeral PostgreSQL and Redis instances** provisioned via **Docker Testcontainers** (`.agents/templates/harness/integration-harness.ts`).
  - Never mock SQL queries or ORM drivers when testing repository implementations.
  - Isolate state between tests via table truncation (`resetDatabase()`) or transaction rollback.

### C. 10% End-to-End Tests (Critical User Journeys)
- **Target**: High-value business flows (Authentication $\rightarrow$ Product Selection $\rightarrow$ Checkout $\rightarrow$ Payment Webhook Settlement).
- **Tooling**: Playwright running against production-parity staging or ephemeral preview environments.

---

## 2. Mandatory Structure: Arrange-Act-Assert (AAA) Pattern

Every `it()` or `test()` block MUST be explicitly structured into three distinct visual phases using `// 1. ARRANGE`, `// 2. ACT`, and `// 3. ASSERT` comments:

```typescript
describe('OrderEntity.addItem', () => {
  it('should calculate tax accurately and update grand total when a valid item is added', () => {
    // 1. ARRANGE: Prepare domain entities, value objects, and inputs
    const order = Order.create({
      id: '018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e0f',
      userId: '018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e11',
      currency: 'IDR',
    });
    const product = Product.create({
      id: '018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e22',
      price: 100000,
      taxRate: 0.11,
    });

    // 2. ACT: Execute the single business behavior under test
    const result = order.addItem(product, 2);

    // 3. ASSERT: Verify output Result and state transitions
    expect(result.isSuccess).toBe(true);
    expect(order.subtotal).toBe(200000);
    expect(order.taxTotal).toBe(22000);
    expect(order.grandTotal).toBe(222000);
    expect(order.items).toHaveLength(1);
  });
});
```

---

## 3. Strict Mock Boundaries

Improper mocking produces brittle tests that pass while production breaks.

### What MUST Be Mocked (in Unit Tests):
- **External Third-Party Gateways**: Payment processors (Stripe/Midtrans), SMS/Email providers (Twilio/SendGrid), external webhooks.
- **System Clock / Time**: Freeze time (`vi.setSystemTime()`) when testing token expiration, retry backoff, or window rollovers.

### What MUST NEVER Be Mocked:
- **Never mock Domain Entities or Value Objects**: Always instantiate real domain objects inside Use-Case tests.
- **Never mock ORM / Database Drivers in Repository Tests**: Test repositories against real PostgreSQL via Testcontainers.
- **Never test private implementation details**: Assert only against observable public behavior and state outputs.

---

## 4. Code Coverage Quality Gates

CI pipelines block merges if coverage drops below these mandatory thresholds:
- **Domain Layer (`src/domain/` or `src/modules/*/domain/`)**: Minimum **95% Branch Coverage**.
- **Application Layer (`src/application/` or `src/modules/*/application/`)**: Minimum **85% Line Coverage**.
- **Overall Project Coverage**: Minimum **80% Line Coverage**.

---

## 5. Mutation Testing Standard (Stryker)

High line and branch coverage can be deceptive if test assertions are superficial (*Assertion Roulette*). To guarantee tests catch real production defects, enforce Mutation Testing on domain models:
- **Tooling**: Stryker Mutator (`stryker.config.json`).
- **Target**: Domain calculations, financial ledgers, state machine transitions, and access control policies.
- **Quality Gate**: Minimum **80% Mutation Score** ($(\text{Killed Mutants} / \text{Total Mutants}) \times 100 \ge 80\%$).
- **Surviving Mutants Investigation**: If a mutant survives (e.g. replacing `>` with `>=` or negating a conditional without causing a test failure), the test suite MUST be strengthened with targeted boundary assertions.

---

## 6. Chaos & Transient Fault Injection

Distributed systems fail unpredictably. Critical use-cases and repository adapters MUST be tested against transient infrastructure disruptions:
- **Database Connection Timeout**: Simulate Postgres socket hanging; verify that the connection pool rejects or fails over within `timeoutMs` (RFC 7807 503 Service Unavailable).
- **Transient Network Glitches**: Inject 500ms latency or random HTTP 502 Bad Gateway on third-party integrations; verify that the Circuit Breaker (`circuit-breaker-client.ts`) trips to `OPEN` state after $N$ failures and executes safe fallbacks.
- **Cache Eviction / Stampede**: Invalidate Redis keys under concurrent requests; verify that Jittered TTL (`13-caching-and-rate-limiting.md`) prevents thundering herd database saturation.

---

## 7. Synthetic Canary Smoke Verification

Post-deployment in staging or production environments, execute the zero-dependency Canary Harness (`.agents/templates/harness/smoke-canary-harness.ts`):
- Verify Kubernetes `/livez` and `/readyz` health endpoints return HTTP 200 within $< 50\text{ms}$.
- Verify Contract-First OpenAPI specification (`/api/openapi.json`) and Swagger UI (`/api/docs`).
- Assert W3C distributed `traceparent` header propagation and enforce latency budget ($p95 < 200\text{ms}$).

