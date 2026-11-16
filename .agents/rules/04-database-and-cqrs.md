---
trigger: glob
globs: "**/*.sql, **/prisma/**, **/drizzle/**, **/migrations/**, **/*repository*.ts, **/*entity*.ts, **/*outbox*.ts"
---

# Database & CQRS Engineering Standards: Normalization, UUIDv7, & Data Integrity

> **Status:** MANDATORY DATABASE STANDARD  
> **Target:** Database Schemas, Relations, Migrations, and CQRS Projections.

---

## 1. CQRS Pattern (Command Query Responsibility Segregation)

Strictly separate data models between Write operations (*Commands*) and Read operations (*Queries*):

### A. Command Side (Write Model)
* **Objective**: Guarantee business invariant enforcement, referential integrity, and ACID transactions.
* **Normalization Strategy**: **Third Normal Form (3NF) / Boyce-Codd Normal Form (BCNF)**.
* **Rules**:
  - Never duplicate mutable attributes across tables where update anomalies can occur.
  - Enforce strict Foreign Key constraints.
  - Execute all multi-table mutations inside a single atomic database transaction (`BEGIN ... COMMIT`).

### B. Query Side (Read Model)
* **Objective**: Serve UI views and API queries with ultra-low latency and minimal query complexity.
* **Denormalization Strategy**: **Planned Denormalization**.
* **Rules**:
  - Use flat read projections, PostgreSQL Materialized Views, or Redis read caches.
  - Avoid 5+ table JOINs on high-traffic dashboard, catalog, or feed endpoints.
  - Synchronize Read Projections asynchronously from Command mutations via Domain Events (*Transactional Outbox*).

---

## 2. When to Normalize vs. Denormalize

| Data Category | Strategy | Technical Rationale |
| :--- | :--- | :--- |
| **Financial Ledger, Inventory, Auth, Accounts** | **Full Normalization (3NF)** | Prevents balance drift and update anomalies; requires strict ACID guarantees. |
| **Dashboards, Activity Feeds, Catalog Search** | **Planned Denormalization** | Eliminates expensive multi-table joins; maximizes read throughput. |
| **Invoices, Order Receipts, Audit Snapshots** | **Immutable Snapshot Denormalization** | Historical point-in-time records (product name, price at purchase, billing address) must never mutate when master catalog data changes later. |

---

## 3. Table Conventions, Primary Keys, & Relations

### A. Primary Keys: UUIDv7 vs. BIGSERIAL
1. **Public Business Entities**: **MUST use UUIDv7 (RFC 9562)**.
   * **Rationale**: UUIDv7 embeds a 48-bit millisecond Unix timestamp in its most significant bits, making it monotonically *time-ordered* (k-sorted). This eliminates B-Tree index page fragmentation on `INSERT` while preventing sequential ID enumeration attacks on public APIs.
2. **High-Volume Internal Append-Only Logs**: May use `BIGINT GENERATED ALWAYS AS IDENTITY` only when strictly internal and time-partitioned.

### B. Schema Naming Conventions
- **Table Names**: `plural_snake_case` (e.g., `users`, `orders`, `order_items`, `payment_transactions`).
- **Column Names**: `snake_case` (e.g., `first_name`, `billing_address_city`).
- **Foreign Keys**: `singular_target_table_id` (e.g., `user_id`, `order_id`, `tenant_id`).
- **Many-to-Many Join Tables**: Alphabetical `table1_table2` (e.g., `courses_students`).

### C. Mandatory Audit & Optimistic Concurrency Columns
Every core entity table MUST include the following columns, including `version` for Optimistic Concurrency Control (preventing lost updates):
```sql
id UUID PRIMARY KEY,
version INT NOT NULL DEFAULT 1,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by UUID NULL,
deleted_at TIMESTAMPTZ NULL -- for entities supporting Soft-Delete
```

### D. Foreign Key Constraints & B-Tree Indexing
- Every Foreign Key column **MUST have an explicit B-Tree index** to prevent sequential table scans during joins and cascading checks.
- Declare `ON DELETE` behavior explicitly on every Foreign Key:
  - `ON DELETE RESTRICT` (Default for financial, order, and core ledger records).
  - `ON DELETE CASCADE` (Only for strictly owned child entities within the same aggregate, e.g., `order_items` belonging to `orders`).
  - `ON DELETE SET NULL` (For optional referential links).

---

## 4. Standard Schemas for Idempotency & Transactional Outbox

### Idempotency Key Store (`idempotency_keys`)
Supports the full lifecycle from `IN_PROGRESS` (when lock is acquired and response is still `NULL`) to `COMPLETED`:
```sql
CREATE TABLE idempotency_keys (
    scoped_key VARCHAR(255) PRIMARY KEY,
    user_id UUID NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NULL,
    response_body JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

### Transactional Outbox Table (`outbox_events`)
```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    trace_id VARCHAR(32) NULL,
    span_id VARCHAR(16) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_outbox_unpublished ON outbox_events(created_at) WHERE published_at IS NULL;
```

---

## 5. Connection Pool Sizing & Mandatory Query Timeouts

Unbounded query durations and oversized per-pod connection pools are the #1 cause of PostgreSQL production outages during Kubernetes auto-scaling.

### A. Connection Pool Sizing Formula
When scaling application pods horizontally, size each pod's connection pool so total connections never exceed PostgreSQL `max_connections` (or route through **PgBouncer** in transaction pooling mode):
$$\text{Max Pool Size per Pod} = \left\lfloor \frac{\text{DB Max Connections} - \text{Reserved Superuser/Admin Connections}}{\text{Max Auto-Scaling Pod Replicas}} \right\rfloor$$

### B. Mandatory Session & Statement Timeouts
Every database client pool MUST configure hard defensive timeouts at connection initialization so runaway queries or crashed workers never hold table locks indefinitely:
- `statement_timeout = '5000ms'` (Aborts any single query running longer than 5 seconds on OLTP endpoints).
- `lock_timeout = '2000ms'` (Fails fast if waiting $> 2\text{s}$ to acquire a row/table lock instead of queueing all worker threads).
- `idle_in_transaction_session_timeout = '10000ms'` (Automatically rolls back and terminates zombie transactions left idle for $> 10\text{s}$).
