# System Architecture Overview (C4 Model & Event Flows)

This document provides visual Architecture-as-Code for developers and AI agents operating within the **`.agents/` Enterprise Production Framework**.

---

## 1. C4 Level 1: System Context Diagram

Visualizes high-level system boundaries, user actors, and external third-party integrations.

```mermaid
flowchart TD
    User["End User / Browser Client"]
    Admin["Internal Operations / Admin"]
    ThirdParty["Third-Party Webhook Producer (e.g., Stripe, Midtrans)"]

    subgraph SystemBoundary["Enterprise System Boundary"]
        App["Modular Monolith / Microservices Backend"]
    end

    DownstreamPayment["Payment Gateway API"]
    DownstreamMessaging["Notification Gateway (SMS / Email)"]

    User -->|"HTTPS / JSON REST / W3C Trace"| App
    Admin -->|"HTTPS / Authenticated RBAC"| App
    ThirdParty -->|"HMAC-SHA256 Webhooks"| App

    App -->|"Outbound REST (Circuit Breaker)"| DownstreamPayment
    App -->|"Async Events"| DownstreamMessaging
```

---

## 2. C4 Level 2: Container Diagram

Illustrates the runtime topology, local development infrastructure (`docker-compose.yml`), transactional data stores, and observability pipelines.

```mermaid
flowchart LR
    Client["Client App (React / Mobile)"]

    subgraph Compute["Application Container Runtime"]
        API["Web API & Use-Case Engine (Distroless Node.js)"]
        OutboxPoller["Transactional Outbox Worker"]
        DlqWorker["Dead Letter Queue (DLQ) Worker"]
    end

    subgraph Storage["Data & Cache Tier"]
        PG[("PostgreSQL 16 (Primary DB & RLS)")]
        Redis[("Redis 7 (Cache & Rate Limiting)")]
    end

    subgraph Telemetry["Observability Stack"]
        Jaeger["Jaeger All-In-One (Local OTel UI :16686)"]
    end

    Client -->|"HTTP / OpenAPI 3.1"| API
    API -->|"SQL Transactions (3NF / RLS)"| PG
    API -->|"Cache-Aside / Jittered TTL"| Redis
    API -->|"W3C Traces (OTLP HTTP :4318)"| Jaeger

    OutboxPoller -->|"SKIP LOCKED Poll"| PG
    OutboxPoller -->|"Emit CloudEvents"| PG
    DlqWorker -->|"Quarantine Poison-Pill"| PG
```

---

## 3. C4 Level 3: Clean Architecture Component Flow

Detailed end-to-end request lifecycle through the Clean Architecture layers, enforcing single responsibility and strict mock boundaries.

```mermaid
sequenceDiagram
    autonumber
    actor Client as HTTP Client
    participant MW as Trace & Error Middleware
    participant Idemp as Idempotency Middleware
    participant Ctrl as Controller / OpenAPI
    participant UC as Use-Case Handler
    participant Ent as Domain Entity
    participant Repo as SQL Repository Port
    participant DB as PostgreSQL (RLS)

    Client->>MW: Ingress Request + traceparent
    MW->>MW: Initialize AsyncLocalStorage Context
    MW->>Idemp: Forward Request
    Idemp->>DB: Check idempotency_keys (Locked?)
    alt Request already processed
        Idemp-->>Client: Replay cached HTTP response
    else Request is new
        Idemp->>Ctrl: Dispatch to Handler
        Ctrl->>UC: Execute Command (DTO)
        UC->>Ent: Validate business invariants
        Ent-->>UC: Domain Result (Success / Failure)
        UC->>Repo: Atomic Commit (Entity + Outbox Event)
        Repo->>DB: BEGIN TRANSACTION (Set app.current_tenant_id)
        Repo->>DB: INSERT domain record
        Repo->>DB: INSERT outbox_events
        Repo->>DB: COMMIT
        Idemp->>DB: UPDATE idempotency_keys status = COMPLETED
        UC-->>Ctrl: Result.ok(data)
        Ctrl-->>MW: Envelope { data, meta }
        MW-->>Client: HTTP 200 OK + X-Trace-Id
    end
```

---

## 4. Resilient Asynchronous Event Life Cycle

Diagram of the Transactional Outbox, Retry with Exponential Backoff, and Poison-Pill DLQ Quarantine.

```mermaid
flowchart TD
    OutboxEvent["Outbox Event (status: PENDING)"] --> Poller["Outbox Worker (SKIP LOCKED)"]
    Poller --> Dispatch{"Dispatch to Message Broker"}

    Dispatch -->|"Success"| Published["Mark PUBLISHED (processed_at: NOW)"]
    Dispatch -->|"Transient Failure"| RetryCheck{"Attempts < Max Retries (5)?"}

    RetryCheck -->|"Yes"| Backoff["Exponential Backoff with Full Jitter"]
    Backoff --> Poller

    RetryCheck -->|"No (Terminal Failure)"| Quarantine["Poison-Pill Quarantine"]
    Quarantine --> DLQTable[("dead_letter_events (status: QUARANTINED)")]
    DLQTable --> SREAlert["Alert On-Call SRE (trace_id preserved)"]
    DLQTable --> ManualReplay["Idempotent Replay CLI (replayDlqBatch)"]
```

