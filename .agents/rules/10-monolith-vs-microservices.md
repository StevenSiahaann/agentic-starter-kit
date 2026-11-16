---
trigger: always_on
---

# Architecture Standards: Monolith vs. Microservices Decision Matrix & Distributed Patterns

> **Status:** MANDATORY ARCHITECTURE STANDARD  
> **Target:** System Architecture, Inter-Service Communication, and Distributed Transactions.

---

## 1. Architecture Decision Record (ADR): Monolith vs. Microservices

System architecture decisions MUST obey the golden rule: **"Modular Monolith by Default, Microservices by Justified Exception"**.

Never start a greenfield system with Microservices without concrete organizational or scaling proof. Premature microservices almost always degenerate into a **Distributed Monolith** (combining network latency, serialization overhead, and cascading failures with tight coupling).

### Architecture Evaluation Decision Matrix

| Evaluation Dimension | Choose **Modular Monolith** (Default) | Choose **Microservices** (By Exception) |
| :--- | :--- | :--- |
| **Engineering Team Size** | $< 25\text{–}30$ Engineers ($1\text{–}3$ squads). | $> 30\text{–}50$ Engineers (multiple autonomous squads requiring independent release cadences). |
| **Domain Maturity** | Bounded contexts are still evolving and being discovered. | Bounded contexts are battle-tested, stable, and cleanly decoupled. |
| **Transaction Consistency** | Requires immediate ACID transactions within a single database commit. | Prepared to operate under *Eventual Consistency* and distributed **Saga** orchestration. |
| **Traffic & Compute Profile** | Balanced compute and I/O load across modules. | **Asymmetric Scaling**: One module experiences $100\times$ load spikes or specialized hardware needs (e.g., Video Transcoding, AI Inference, High-Frequency Telemetry). |
| **Infrastructure & SRE Readiness** | Low operational overhead: $1\text{–}2$ containers, 1 primary DB, simple CI/CD. | High operational maturity: Dedicated SRE team, Kubernetes, Service Mesh, Kafka, Distributed Tracing, and Automated Canary Rollbacks. |
| **Regulatory Isolation** | Standard compliance scope. | Strict blast-radius or regulatory isolation required for a specific subsystem (e.g., PCI-DSS Level 1 Payment Vault). |

---

## 2. Modular Monolith Architecture Standard

For 90% of workloads, the **Modular Monolith** is the optimal architecture:
1. All code lives in a single repository and deploys as a single, cohesive binary/container.
2. Each business domain is strictly encapsulated inside its own directory: `src/modules/<domain>/` (e.g., `src/modules/orders/`, `src/modules/billing/`, `src/modules/identity/`).
3. **Strict Ban on Cross-Module SQL Joins**: The `orders` module is strictly forbidden from performing direct SQL JOINs or foreign key references against internal tables owned by `billing`.
4. Inter-module communication MUST occur exclusively through **Public Application Ports (Interfaces)** or an **In-Memory Domain Event Bus**.
5. **Extraction Readiness**: Because module boundaries and data ownership are isolated from day one, any module can be extracted into a standalone microservice in days if future scale demands it.

---

## 3. The 6 Golden Rules of Microservices (When Adopted)

When a subsystem justifies extraction into Microservices, it MUST enforce all 6 Golden Rules:

### A. Database-per-Service (Strictly Mandatory)
- Every microservice owns its private database schema/instance.
- **Zero Shared Databases**: Two microservices must never read or write directly to the same database table (*Shared Database is a forbidden anti-pattern*).

### B. Inter-Service Communication Protocols
1. **Synchronous (Request-Response)**: Prefer **gRPC with Protocol Buffers** for low-latency binary serialization and strict contract typing (or HTTP/REST wrapped in a **Circuit Breaker**).
2. **Asynchronous (Event-Driven)**: Use a durable message broker (**Apache Kafka, RabbitMQ, or Google Cloud Pub/Sub**) for domain events and read-model projections.

### C. Transactional Outbox Pattern (Eliminating Dual-Write Bugs)
To prevent the **Dual-Write Problem** (where a database commit succeeds but publishing to Kafka fails due to a network blip):
1. Persist the domain entity mutation AND the serialized event into the `outbox_events` table within the **exact same ACID database transaction**.
2. A dedicated background `OutboxWorker` (`.agents/templates/outbox-worker.ts`) or CDC connector (Debezium) polls unpublished rows (`WHERE published_at IS NULL`) and publishes them to the broker with *at-least-once delivery*.
3. Once acknowledged by the broker, mark `published_at = NOW()`. Consumers must be idempotent.

### D. Distributed Transactions: Saga Pattern
- Never use distributed Two-Phase Commit (2PC / XA Transactions) across microservices.
- Implement the **Saga Orchestrator Pattern** (`.agents/templates/saga-coordinator.ts`) with explicit **LIFO Compensating Transactions**:
  - Step 1: `ReserveInventoryCommand` $\rightarrow$ Succeeds.
  - Step 2: `ChargePaymentCommand` $\rightarrow$ Fails.
  - Compensation: The Saga Coordinator automatically executes `ReleaseInventoryCompensation` in reverse order (LIFO) to restore system consistency, routing unrecoverable compensation failures to a Dead Letter Queue (DLQ).

### E. Fault Tolerance & Resilience Engineering
1. **Circuit Breaker** (`.agents/templates/circuit-breaker-client.ts`):
   - **`CLOSED`**: Normal traffic flow; tracks failure rate across a rolling time window.
   - **`OPEN`**: Trips when failure rate exceeds threshold (e.g., $\ge 50\%$ over minimum 10 requests), failing fast immediately to prevent cascading thread/connection exhaustion.
   - **`HALF_OPEN`**: After `resetTimeoutMs`, admits a capped number of probe requests (`halfOpenMaxProbes`) to verify downstream recovery before closing the circuit.
2. **Retry Policy**: Always use **Exponential Backoff with Full Jitter** (`sleep = random(0, min(cap, base * 2^attempt))`) to prevent synchronized retry storms (*Thundering Herd*).
3. **Dead Letter Queue (DLQ)**: Route poison-pill messages that exhaust max retries into a DLQ with alerting for inspection.

### F. W3C Distributed Trace Propagation
Every outbound gRPC metadata header, HTTP request, and Kafka/Outbox message header MUST carry the W3C `traceparent` header (`00-<traceId>-<spanId>-01`) for end-to-end trace visibility.
