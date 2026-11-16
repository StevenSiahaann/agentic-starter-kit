# Production Incident Triage & SRE Runbook

> **Scope**: Standard Operating Procedure (SOP) for On-Call Software Engineers, SREs, and AI Agents investigating production outages, latency spikes, or elevated error rates.  
> **Governed by**: `.agents/rules/05-observability-otel.md`, `11-computational-complexity-and-metrics.md`, and `.agents/skills/incident-rca-postmortem/SKILL.md`.

---

## 1. Incident Classification & Severity Matrix

| Severity Level | User Impact | SLO Threshold Violation | Target Resolution Window | Escalation Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core transactional path down (Payments, Authentication, Checkout blocked). | Error rate $> 1.0\%$, $p95$ latency $> 2{,}000\text{ms}$, or zero traffic ingress. | $\le 30\text{ minutes}$ | Engineering Manager, Tech Lead, On-Call Architect. |
| **SEV-2 (Major)** | Secondary degradation (Search slow, notifications delayed, read-replicas lagging). | Error rate $0.1\% - 1.0\%$, or $p95$ latency $> 500\text{ms}$. | $\le 2\text{ hours}$ | Module Tech Lead. |
| **SEV-3 (Minor)** | Cosmetic UI defects, non-critical background jobs delayed, minor transient glitch. | Within SLO error budget ($< 0.1\%$). | $\le 24\text{ hours}$ | Normal sprint triage / Jira ticket. |

---

## 2. 6-Step Systematic Triage Procedure

Follow these steps sequentially to isolate root causes without jumping to conclusions.

### Step 1: Health Probe Assessment (`/livez` & `/readyz`)
Check whether pods or application containers are healthy, restarting, or failing dependency readiness:
```bash
# 1. Check container liveness (Is the Node.js event loop responsive?)
curl -s -i http://localhost:3000/livez

# 2. Check container readiness (Are PostgreSQL and Redis connected?)
curl -s -i http://localhost:3000/readyz
```
* **If `/livez` fails (HTTP 503 or timeout)**: Node.js event loop is blocked (CPU saturation, infinite loop, or Out-Of-Memory OOM crash). Check memory: `docker stats` or `kubectl top pods`.
* **If `/readyz` fails (HTTP 503)**: Application is alive but downstream storage is unreachable (Postgres connection pool exhausted or Redis timeout).

---

### Step 2: Distributed Trace Triage in Jaeger / OpenTelemetry
Locate the root cause using the W3C `trace_id` from client error responses (`X-Trace-Id` header):
1. Open local or staging Jaeger UI: `http://localhost:16686`.
2. Filter by service name and look for tags: `error=true` and HTTP status `5xx`.
3. Inspect the waterfall span hierarchy:
   - Identify the span with the longest duration (e.g. database query, third-party HTTP call, or lock acquisition).
   - Check span logs for the exact exception message and stack trace.

---

### Step 3: Poison-Pill & Dead Letter Queue (DLQ) Quarantine Check
When asynchronous workers or background jobs fail repeatedly, inspect the `dead_letter_events` table:
```sql
-- Check quarantined poison pills in the last 60 minutes
SELECT id, tenant_id, event_type, error_message, retry_count, quarantined_at, original_trace_id
FROM dead_letter_events
WHERE status = 'QUARANTINED'
ORDER BY quarantined_at DESC
LIMIT 20;
```
* **Resolution**:
  - If a corrupted payload (*Poison Pill*) was quarantined, verify that remaining queue traffic resumed processing.
  - Fix the underlying schema or validation bug in a hotfix, then replay the quarantined events safely using `replayDlqBatch()`.

---

### Step 4: Circuit Breaker Status & Third-Party Outage Triage
If downstream third-party integrations (Payment Gateway, SMS, Partner APIs) are timing out:
1. Check Circuit Breaker state: Look for structured log event `"Circuit breaker state changed: OPEN"` (`.agents/templates/circuit-breaker-client.ts`).
2. Verify fallback execution: Ensure client requests receive a graceful degraded response (RFC 7807 503 with retry-after) rather than hanging until timeout.
3. Once downstream recovers, verify the circuit automatically transitions through `HALF-OPEN` probe state to `CLOSED`.

---

### Step 5: Database Connection Pool & Lock Saturation Triage
Inspect PostgreSQL active queries and locking bottlenecks:
```sql
-- 1. Identify long-running queries (> 5 seconds)
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle' AND (now() - query_start) > interval '5 seconds'
ORDER BY duration DESC;

-- 2. Check for lock contention / blocked transactions
SELECT blocked_locks.pid     AS blocked_pid,
       blocking_locks.pid    AS blocking_pid,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
   AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
   AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
   AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
   AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
   AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
   AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
   AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
   AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
   AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
   AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```

---

### Step 6: Emergency Mitigation & Safe Rollback Procedure
If the root cause is linked to a recent deployment or faulty feature rollout:
1. **Activate Operational Kill-Switch** (`.agents/templates/feature-flag-evaluator.ts`):
   - Disable the problematic feature immediately via Redis/Config flag override (0ms propagation without redeployment).
2. **Container Rollback**:
   - If a binary regression cannot be disabled via flag, execute clean rollback to previous SHA.
   - Database migrations MUST follow Expand-and-Contract (`zero-downtime-migration`), ensuring rollback of application code does not break the database schema.
3. **Preserve Incident Evidence**:
   - Collect error rates, Jaeger trace IDs, and log snapshots for the postmortem.
4. **Trigger Blameless Postmortem**:
   - Run the skill `incident-rca-postmortem` to conduct 5-Whys analysis and generate `docs/postmortems/YYYY-MM-DD-incident-title.md`.
