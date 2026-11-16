---
trigger: glob
globs: "**/*cache*.ts, **/*redis*.ts, **/*rate-limit*.ts, **/*repository*.ts, **/*lock*.ts"
---

# Caching Strategy, Concurrency Control, & Rate Limiting Standards

> **Status:** MANDATORY PERFORMANCE & RESILIENCE STANDARD  
> **Target:** Redis Caches, Database Concurrency Locks, Worker Queues, and API Rate Limiters.

---

## 1. Caching Architecture & Stampede Prevention

### A. Cache-Aside with Jittered TTL (Anti-Stampede)
When thousands of cached keys expire at the exact same second, concurrent requests flood the primary database simultaneously (*Cache Stampede / Thundering Herd*).
- **Mandatory Jittered TTL**: Every `SETEX` / cache write MUST add random jitter (10%–20% of base TTL) so keys expire across a spread window:
  ```typescript
  // CORRECT: Base TTL (300s) + Random Jitter (0..60s) prevents synchronized expiration stampedes
  const baseTtlSeconds = 300;
  const jitterSeconds = Math.floor(Math.random() * 60);
  await redis.set(cacheKey, JSON.stringify(payload), 'EX', baseTtlSeconds + jitterSeconds);
  ```

### B. Namespaced & Versioned Cache Keys
- Format all Redis keys with explicit service, schema version, and entity scope:
  `svc:<service>:v1:<entity>:<id>` (e.g., `svc:catalog:v1:product:018dc320...`).
- Embedding `:v1:` allows instant zero-downtime cache invalidation across deployments when the cached TypeScript interface changes.

### C. Negative Caching for Missing Records
- To protect the database against repeated lookups for non-existent IDs (*Cache Penetration attack*), cache `null` sentinel values (`"__NULL__"`) with a short TTL ($30\text{–}60\text{ seconds}$).

---

## 2. Database & Distributed Concurrency Control

Choose the right locking primitive based on contention profile:

| Contention Scenario | Mandatory Mechanism | Implementation Pattern |
| :--- | :--- | :--- |
| **Standard Entity Updates (Low/Medium Contention)** | **Optimistic Concurrency Control (`version`)** | `UPDATE orders SET status = $1, version = version + 1 WHERE id = $2 AND version = $3` (Throw `409 Conflict` if `rowCount === 0`). |
| **High-Contention Ledger / Balance Mutation (Single DB)** | **Pessimistic Row Lock (`FOR UPDATE`)** | Inside short ACID transaction: `SELECT balance FROM wallets WHERE id = $1 FOR UPDATE;` (Keep transaction $< 15\text{ms}$, zero external HTTP calls while holding lock!). |
| **Multi-Pod Queue / Outbox Polling** | **Non-Blocking Row Claim (`FOR UPDATE SKIP LOCKED`)** | `SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED;` (Allows $N$ Kubernetes replicas to process batches in parallel with zero duplicate delivery). |
| **Cross-Service / External Resource Coordination** | **Distributed Redis Lock (`SET NX PX`)** | Acquire atomic token lock (`SET lock:resource <uuid> NX PX 10000`), verify token ownership via Lua script on release. |

> **Golden Rule of Locks**: **NEVER** perform an outbound HTTP/gRPC call (e.g., calling Stripe/Midtrans) while holding an open PostgreSQL `FOR UPDATE` transaction lock. Doing so exhausts the database connection pool within seconds under upstream latency spikes.

---

## 3. Multi-Tier Rate Limiting & Quota Defense

Protect all public and internal endpoints using a sliding-window or token-bucket algorithm in Redis:

1. **Tier 1 — Anonymous / IP Level (Edge / Login / OTP)**:
   - Strict cap on authentication and OTP endpoints (e.g., max 5 attempts per 15 minutes per IP + identifier).
2. **Tier 2 — Authenticated User / Tenant Level**:
   - Standard read/write burst limits scoped by `user_id` or `tenant_id` to prevent a single noisy tenant from degrading multi-tenant SLAs.
3. **Tier 3 — Expensive Compute / LLM / Export Endpoints**:
   - Dedicated concurrency and token-budget quotas.

### Mandatory Rate-Limit Response Headers
Every rate-limited endpoint MUST return IETF-standard headers, and include `Retry-After` on HTTP `429 Too Many Requests`:
```http
RateLimit-Limit: 100
RateLimit-Remaining: 42
RateLimit-Reset: 1763294520
Retry-After: 30
```

