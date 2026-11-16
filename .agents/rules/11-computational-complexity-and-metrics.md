---
trigger: always_on
---

# Computational Complexity (Big-O) & Production Metrics Standards

> **Status:** MANDATORY ENGINEERING STANDARD  
> **Target:** All Algorithms, Database Queries, Collection Transformations, and Production SLA/SLO Monitoring.

---

## 1. Computational Complexity Standards (Big-O Notation)

Every algorithm and data transformation must be engineered for scale resilience. Code that performs acceptably on 20-row dummy datasets but degrades quadratically in production is rejected.

### A. Mandatory Time Complexity Rules

1. **In-Memory Lookups & Joins MUST Be $O(1)$**:
   * All membership checks, ID lookups, and collection correlations inside loops MUST use a **`Set`** or **`Map`** (Hash Table).
   * **Strict Ban on $O(N)$ Scans Inside Loops (Eliminate $O(N^2)$ / $O(N \times M)$)**:
     ```typescript
     // ❌ WRONG: O(N * M) — Quadratic performance degradation at scale
     const matchingUsers = users.filter((user) =>
       targetIds.includes(user.id) // Array.includes() performs an O(M) linear scan on every iteration
     );

     // ✅ CORRECT: O(N + M) — Pre-index into a Set for O(1) constant-time lookup
     const targetIdSet = new Set(targetIds); // O(M)
     const matchingUsers = users.filter((user) =>
       targetIdSet.has(user.id) // Set.has() is O(1)
     );
     ```

2. **Sorting Complexity Capped at $O(N \log N)$**:
   * Use native engine sorting (`Array.prototype.sort` / TimSort) or database indexed `ORDER BY`.
   * Never implement manual $O(N^2)$ sorting algorithms (Bubble, Insertion, Selection sort) on dynamic datasets.

3. **Single-Pass Collection Reduction**:
   * Avoid chaining multiple intermediate `.filter().map().reduce()` passes over large arrays when a single-pass loop avoids intermediate heap allocations:
     ```typescript
     // ❌ SUBOPTIMAL: O(3N) with two intermediate array allocations
     const total = items
       .filter((x) => x.active)
       .map((x) => x.price)
       .reduce((sum, price) => sum + price, 0);

     // ✅ OPTIMAL: O(N) single-pass with O(1) auxiliary memory
     let total = 0;
     for (const item of items) {
       if (item.active) total += item.price;
     }
     ```

4. **Bounded Recursion Safety**:
   * Every recursive function MUST have a provably reachable termination base case and an explicit maximum depth guard ($\le 100$ levels).
   * For deep hierarchical trees or graphs, use an iterative algorithm with an explicit heap-allocated stack/queue to prevent `RangeError: Maximum call stack size exceeded`.

---

### B. Mandatory Space Complexity Rules

1. **Streaming vs. Buffering for Large Payloads ($> 10\text{MB}$)**:
   * Processing large files or datasets (CSV/JSON exports, log dumps, media uploads $> 10\text{MB}$) **MUST operate in $O(1)$ auxiliary memory** using **Node.js Streams / Web Streams / Async Iterators** (`for await (const chunk of stream)`).
   * **Strictly Forbidden**: Loading entire large files into RAM via `fs.readFileSync()` or unbounded `SELECT * FROM large_table`, which triggers container OOM (Out-of-Memory) kills.

2. **Database Keyset (Cursor-Based) Pagination**:
   * Never load thousands of rows into application memory at once.
   * Use **Cursor-Based (Keyset) Pagination** ($O(\log N)$ B-Tree index seek): `WHERE id > $1 ORDER BY id ASC LIMIT 20`.
   * Avoid large `OFFSET` queries on big tables, as PostgreSQL must still scan and discard all skipped rows ($O(\text{OFFSET})$ linear cost).

---

## 2. Production Performance & Operational Metrics Catalog (SLA / SLO Targets)

All services and frontends are measured against the following quantitative engineering thresholds:

### A. Frontend & Core Web Vitals (CWV)

| Metric | Full Name | Good Target (SLO) | Poor Threshold | Operational Definition |
| :--- | :--- | :--- | :--- | :--- |
| **LCP** | Largest Contentful Paint | **$\le 2.5\text{s}$** | $> 4.0\text{s}$ | Time until the primary hero/content element is rendered. |
| **INP** | Interaction to Next Paint | **$\le 200\text{ms}$** | $> 500\text{ms}$ | Visual responsiveness latency following user input (click/key). |
| **CLS** | Cumulative Layout Shift | **$\le 0.1$** | $> 0.25$ | Visual stability score measuring unexpected layout jumps. |
| **FCP** | First Contentful Paint | **$\le 1.8\text{s}$** | $> 3.0\text{s}$ | Time until the first DOM pixel is painted on screen. |
| **TTFB** | Time to First Byte | **$\le 800\text{ms}$** | $> 1.8\text{s}$ | Initial document response latency from edge/server. |
| **Bundle Size** | Initial JS Gzip Payload | **$\le 150\text{–}200\text{KB}$** | $> 350\text{KB}$ | Critical-path JavaScript downloaded on initial load. |
| **Frame Rate** | UI Animation Smoothness | **$60\text{ FPS}$** ($16.6\text{ms}$) | $< 30\text{ FPS}$ | Frame budget consistency during scroll and transitions. |

---

### B. Backend API & Microservices (RED Method)

| RED Dimension | Metric | Production SLO Target | Critical Alert Threshold |
| :--- | :--- | :--- | :--- |
| **Rate** | Throughput (RPS) | Scales linearly within provisioned baseline. | Sudden $> 3\times$ baseline spike (DDoS / retry loop). |
| **Errors** | HTTP 5xx / Unhandled Error Rate | **$< 0.1\%$** of total requests. | **$> 1.0\%$** (Triggers PagerDuty On-Call page). |
| **Duration** | Latency $p50$ (Median) | **$< 50\text{ms}$** | $> 150\text{ms}$ |
| **Duration** | Latency $p95$ | **$< 150\text{ms}$** | $> 300\text{ms}$ |
| **Duration** | Latency $p99$ (Tail Latency) | **$< 500\text{ms}$** | $> 1.5\text{s}$ |

---

### C. Infrastructure & Database (USE Method)

| USE Dimension | Metric | Standard Target | Warning Alert Threshold |
| :--- | :--- | :--- | :--- |
| **Utilization** | CPU Utilization | Average **$< 70\%$** | Sustained $> 85\%$ for 5 minutes. |
| **Utilization** | Memory (RAM) Utilization | Average **$< 80\%$** | $> 90\%$ (High risk of Linux OOM Killer). |
| **Saturation** | DB Connection Pool Wait Time | **$0\text{ms}$** (Zero queued requests) | $> 50\text{ms}$ (Pool exhaustion / connection leak). |
| **Saturation** | Node.js Event Loop Lag | **$< 20\text{ms}$** | $> 100\text{ms}$ (Synchronous CPU blocking detected). |
| **Errors** | Slow Query Execution Time | **$< 20\text{ms}$** | Queries $> 100\text{ms}$ logged to slow query log. |
| **Efficiency** | Redis Cache Hit Ratio | **$\ge 85\text{–}90\%$** | $< 70\%$ (Cache stampede / key eviction issue). |
| **Integrity** | Database Index Hit Ratio | **$\ge 99\%$** | $< 95\%$ (Repeated Full Table Scans occurring). |

---

### D. Engineering Delivery Excellence (DORA Metrics)

1. **Deployment Frequency**:
   * *Elite Target*: **On-demand (multiple deployments per day)**.
2. **Lead Time for Changes** (commit to production):
   * *Elite Target*: **$< 24\text{ hours}$**.
3. **Change Failure Rate (CFR)** (deployments causing incident/rollback):
   * *Elite Target*: **$< 5\%$**.
4. **Mean Time to Recovery (MTTR)**:
   * *Elite Target*: **$< 30\text{–}60\text{ minutes}$**.

---

### E. Code Quality & Security Gate Minimums

- **Automated Test Coverage**:
  - Domain Business Rules (`src/domain/`): **$\ge 95\%$ Branch Coverage**.
  - Overall Project: **$\ge 80\%$ Line Coverage**.
- **Security Vulnerabilities (SAST & Container Scan)**:
  - **0 Critical CVEs**, **0 High CVEs**.
- **Type Safety**: **0 `any` types**, 100% clean `tsc --noEmit` in strict mode.
