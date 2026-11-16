---
trigger: glob
globs: "**/*.ts, **/*.js, **/*.go, **/*.py"
---

# Architecture & Backend Code Standards: Clean Use-Case Driven & Error Taxonomy

> **Status:** MANDATORY ENGINEERING STANDARD  
> **Target:** All Backend Services, API Endpoints, Domain Models, and Error Handlers.

---

## 1. Clean Architecture: Use-Case Driven (Eliminate "God Services")

Traditional 4-layer architectures (*Controller -> Service -> Repository -> Model*) frequently degrade into bloated, multi-thousand-line monolithic `Service` classes (*God Services*).

Every business operation MUST be decomposed into an independent, single-responsibility **Use-Case / Command-Query Handler** (1 file = 1 business workflow, target 80–150 lines of code).

```text
src/
├── domain/                  # Enterprise Business Rules (Zero Framework/ORM Dependencies)
│   ├── entities/            # Rich Domain Entities (order.entity.ts, user.entity.ts)
│   ├── value-objects/       # Immutable Value Objects (money.vo.ts, email.vo.ts)
│   ├── events/              # Domain Events (order-placed.event.ts)
│   └── errors/              # Typed Domain Errors (order-already-cancelled.error.ts)
│
├── application/             # Application Business Rules (Use-Case Orchestration)
│   ├── commands/            # WRITE SIDE: State mutations (create-order, cancel-order)
│   ├── queries/             # READ SIDE: Fast projection queries (get-order-by-id)
│   └── ports/               # Outward Interfaces / Contracts for Repositories & Gateways
│
└── infrastructure/          # Frameworks, Drivers, & External Implementations
    ├── database/            # Drizzle / Prisma / SQL Repository Implementations
    ├── http/                # Thin HTTP Controllers & Middlewares
    └── external/            # Payment Gateway, Notification, and OTel Adapters
```

### Rich Domain Entity Rule (Anti-Anemic Domain Model)
- Domain entities **MUST** enforce their own business invariants and state transitions.
- Anemic entities consisting solely of public getters/setters without domain behavior are forbidden.
  ```typescript
  // CORRECT: Rich Domain Entity enforcing business invariants
  export class Order {
    private constructor(private readonly props: OrderProps) {}

    public cancel(reason: string): Result<void, OrderAlreadyCancelledError> {
      if (this.props.status === OrderStatus.CANCELLED) {
        return Result.fail(new OrderAlreadyCancelledError(this.props.id));
      }
      this.props.status = OrderStatus.CANCELLED;
      this.props.cancellationReason = reason;
      this.addDomainEvent(new OrderCancelledEvent(this.props.id));
      return Result.ok(undefined);
    }
  }
  ```

---

## 2. Error Taxonomy: Domain Errors vs. System Errors

Never conflate expected business rule violations with unexpected technical infrastructure failures.

### A. Domain / Business Errors
- **Definition**: Expected, deterministic outcomes in business workflows (e.g., insufficient funds, expired coupon, duplicate email).
- **Handling**: Return explicit **`Result<T, DomainError>`** values (Functional Either Pattern). **Never throw raw untyped exceptions (`throw new Error()`)** inside the domain or application layer for business errors.
- **HTTP Mapping**: **4xx** status codes (`400 Bad Request`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`).
- **Logging Level**: **`WARN` or `INFO`**. Never log domain errors as `ERROR` to avoid false-positive PagerDuty/SRE alerts.

### B. System / Infrastructure Errors
- **Definition**: Unexpected technical failures (e.g., database connection timeout, Redis crash, upstream payment gateway `502`).
- **Handling**: Caught at the global exception boundary.
- **HTTP Mapping**: **500 Internal Server Error** (or `503 Service Unavailable`).
- **Mandatory Data Masking**: Never leak raw SQL errors, credentials, or internal stack traces to the client. Return a generic safe message (`"An unexpected internal error occurred"`) paired with the correlation `trace_id`.
- **Logging Level**: **`ERROR` or `FATAL`** with full stack trace and context.

### C. Standard Error Response Format: RFC 7807 (Problem Details)
All API endpoints MUST return errors adhering to the RFC 7807 specification:
```json
{
  "type": "https://api.domain.com/errors/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 409,
  "detail": "Available account balance (50,000 IDR) is insufficient for transaction amount (120,000 IDR).",
  "code": "INSUFFICIENT_FUNDS",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "timestamp": "2026-11-16T11:42:00.000Z"
}
```

---

## 3. Idempotency Pattern (`Idempotency-Key`)

Every state-mutating endpoint (Checkout, Payment, Balance Transfer, Order Creation) **MUST require an `Idempotency-Key: <UUID>` HTTP header**.

### Idempotency Middleware Lifecycle:
1. Client sends a mutating request with `Idempotency-Key: c9b8f2a1-...`.
2. Middleware scopes the key by `idemp:<userId>:<method>:<path>:<key>` and checks Redis/DB:
   - If state is **`IN_PROGRESS`**: Reject immediately with HTTP `409 Conflict` (prevents concurrent double-click race conditions).
   - If state is **`COMPLETED`**:
     * Compare the SHA-256 hash of the current request body against the stored `requestHash`.
     * If identical: Immediately replay the cached status code and response body with header `Idempotent-Replayed: true`.
     * If different for the same key: Reject with HTTP `422 Unprocessable Entity` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).
3. If the key does not exist: Acquire an atomic lock with state `IN_PROGRESS` (TTL 60 seconds) and execute the Use-Case.
4. Upon successful completion (`statusCode < 500`): Persist state `COMPLETED` along with the response status and body for a 24-hour TTL. If a `5xx` error occurs, release the lock so the client can safely retry.

---

## 4. Naming Conventions & Strict Typing

- **Naming Conventions**:
  - Files & Directories: `kebab-case` (e.g., `create-order.handler.ts`, `order-repository.port.ts`).
  - Classes, Interfaces, Types, Components: `PascalCase`.
  - Functions, Methods, Variables: `camelCase`.
  - Global Constants & Env Vars: `UPPER_SNAKE_CASE`.
- **Interface vs. Type**:
  - Use `interface` for behavioral contracts and ports implemented by classes.
  - Use `type` for unions, intersections, tuples, primitive aliases, and Zod schema inferences.
  - Do not prefix interfaces with `I` (use `OrderRepositoryPort`, **not** `IOrderRepository`).
- **Strict Type Safety**:
  - TypeScript `strict: true` must be enabled at all times.
  - **The `any` type is strictly forbidden**. When handling dynamic external data, use `unknown` and narrow types via type guards or Zod parsers.
