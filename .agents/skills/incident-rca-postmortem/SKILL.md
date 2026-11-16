---
name: incident-rca-postmortem
description: >-
  Conducts a blameless Root Cause Analysis (RCA) using the 5-Whys methodology, reconstructs incident timelines
  via W3C trace_id, evaluates SLO error-budget burn, and generates a structured Postmortem document in docs/postmortems/.
  Use when investigating production incidents, outages, latency spikes, or critical bug regressions.
---

# Incident Root Cause Analysis (RCA) & Blameless Postmortem

Use this skill to investigate production incidents systematically and author a Blameless Postmortem in `docs/postmortems/YYYY-MM-DD-<incident-slug>.md`.

## Investigation & Postmortem Procedure

1. **Triage & Blast Radius Assessment**:
   - Identify affected bounded contexts/services, start/end timestamps (UTC), and customer impact (failed requests, error rate %, latency degradation against SLOs in [11-computational-complexity-and-metrics.md](../../rules/11-computational-complexity-and-metrics.md)).
   - Collect correlated W3C `trace_id` values and NDJSON structured log entries.

2. **Reconstruct the Timeline (UTC)**:
   - Document exact timestamps for:
     - Triggering event (deployment, traffic spike, upstream outage, data poison pill).
     - Alert firing time (*Time-to-Detect — TTD*).
     - Mitigation action taken (rollback, circuit breaker trip, feature flag kill-switch).
     - Full recovery confirmation (*Time-to-Recovery — MTTR*).

3. **Execute 5-Whys Root Cause Analysis (Blameless)**:
   - Focus strictly on **systemic, architectural, and process gaps** rather than individual human error:
     - *Why 1*: Why did the endpoint return 500/timeout?
     - *Why 2*: Why was the database connection pool exhausted?
     - *Why 3*: Why did the handler hold an open transaction while calling an external payment API?
     - *Why 4*: Why was this not caught during PR review or integration testing?
     - *Why 5*: Which guardrail or automated harness check was missing?

4. **Define Preventative Action Items**:
   - Every postmortem MUST produce concrete, prioritized engineering tasks (`P0 Immediate`, `P1 Short-Term`, `P2 Long-Term`) with:
     - Regression test added (following the AAA pattern).
     - Architectural or harness check added so the same class of failure can never recur.

