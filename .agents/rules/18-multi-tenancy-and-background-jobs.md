---
trigger: model_decision
description: Multi-tenant data isolation via PostgreSQL Row-Level Security (RLS), tenant context propagation, and resumable chunked background/cron job governance. Activate when building B2B SaaS, multi-tenant schemas, scheduled cron jobs, or batch workers.
---

# Multi-Tenant Isolation (RLS) & Background / Cron Job Standards

> **Status:** MANDATORY SAAS & BATCH PROCESSING STANDARD  
> **Target:** Multi-Tenant Databases, Background Queue Workers, and Scheduled Cron Jobs.

---

## 1. Multi-Tenant Data Isolation (Defense-in-Depth)

In B2B SaaS, multi-merchant, or multi-organization systems, a single missing `WHERE tenant_id = $1` filter results in a catastrophic cross-tenant data leak. Enforce **Defense-in-Depth Tenant Isolation**:

### A. Mandatory `tenant_id` Indexing
- Every tenant-scoped table MUST include `tenant_id UUID NOT NULL` as the leading column in composite B-Tree indexes (`CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);`).

### B. PostgreSQL Row-Level Security (RLS) as a Hard Safety Net
Enable PostgreSQL RLS on all tenant-owned tables so the database engine itself blocks cross-tenant reads/writes even if application code omits a `WHERE` clause:
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON orders
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
```
At the start of every tenant-scoped database transaction, bind the verified tenant ID locally to that transaction:
```sql
SET LOCAL app.current_tenant_id = '018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e0f';
```

---

## 2. Background Jobs & Scheduled Cron Governance

Unbounded batch jobs are a leading cause of midnight database CPU saturation and OOM crashes.

### A. Single-Active-Leader Execution
- Never run `node-cron` or `setInterval` blindly inside every web container replica (if Kubernetes scales to 5 pods, the cron job will execute 5 times concurrently!).
- Run scheduled jobs either as dedicated Kubernetes `CronJob` resources (`concurrencyPolicy: Forbid`) or acquire a **Distributed Redis Leader Lock** before starting execution.

### B. Resumable Chunked Batch Processing (Cursor Checkpointing)
- **Never load or update 100,000+ rows in a single giant SQL transaction**.
- Process batch jobs in deterministic chunks of **$200\text{–}1,000\text{ rows}$** using Keyset/Cursor pagination (`WHERE id > $lastProcessedId ORDER BY id ASC LIMIT 500`).
- Persist the `lastProcessedId` checkpoint after each chunk so that if a worker pod is preempted or crashes at row 45,000, the next run resumes cleanly from row 45,001 without reprocessing or duplicating earlier work.

### C. Dead-Man's-Switch & Poison-Pill Isolation
- **Dead-Man's-Switch**: Critical settlement/reconciliation cron jobs MUST emit a completion metric or heartbeat upon finishing; alert on-call SRE if the success metric is absent within the expected schedule window.
- **Per-Item Fault Isolation**: Inside a batch loop, wrap individual record processing in a `try/catch` block. If 1 record out of 500 is malformed (*Poison Pill*), log the error with `trace_id`, mark that specific record as `FAILED_REVIEW`, and continue processing the remaining 499 records.
