---
trigger: model_decision
description: Feature flag taxonomy (Release Toggles, Operational Kill-Switches, Experimentation), consistent hashing percentage rollouts, flag lifecycle cleanup, and graceful degradation. Activate when implementing feature flags, canary rollouts, A/B tests, or kill-switches.
---

# Feature Flags, Progressive Delivery, & Kill-Switch Standards

> **Status:** MANDATORY DELIVERY & RESILIENCE STANDARD  
> **Target:** All Feature Releases, Canary Rollouts, and Third-Party Integration Switches.

---

## 1. Feature Flag Taxonomy & Lifecycle Governance

To support **Trunk-Based Development** (branches merged in $< 48\text{ hours}$ per `07-git-branch-and-pr.md`), incomplete or high-risk features are merged into `main` behind Feature Flags. Every flag MUST belong to one of four explicit categories:

| Flag Category | Purpose | Maximum Lifespan (TTL) | Owner |
| :--- | :--- | :--- | :--- |
| **1. Release Toggle** | Decouples code deployment from user-facing feature release. | **Transient ($\le 14\text{ days}$ after 100% rollout)**. Must be deleted from code once stable. | Product Engineering Squad |
| **2. Operational Kill-Switch** | Disables non-critical subsystems or slow third-party integrations instantly during load spikes/incidents (*Graceful Degradation*). | **Permanent**. Evaluated in-memory with zero external I/O latency. | SRE & Platform Engineering |
| **3. Experiment Toggle** | Drives A/B or multivariate cohort testing. | **Transient ($\le 30\text{ days}$)**. Removed once statistical significance is reached. | Growth / Product Squad |
| **4. Entitlement Toggle** | Controls B2B tier/plan access (e.g., Enterprise vs. Free tier capabilities). | **Long-Lived** (Managed via tenant configuration). | Domain / Billing Architecture |

---

## 2. Deterministic Percentage Rollout (Consistent Hashing)

Never use `Math.random() < 0.10` to roll out a feature to 10% of traffic—doing so causes the feature to flicker on and off for the same user on every page refresh!

### Consistent Hashing Formula:
Compute a deterministic bucket ($0\text{–}99$) by hashing `flagKey + ":" + subjectId` (`user_id` or `tenant_id`):
$$\text{bucket} = \text{uint32}\left(\text{SHA-256}(\texttt{flagKey} \mathbin{\Vert} \texttt{":"} \mathbin{\Vert} \texttt{subjectId})\right) \bmod 100$$
- If $\text{bucket} < \text{rolloutPercentage}$, the flag evaluates to `true`.
- **Monotonic Rollout Guarantee**: Increasing `rolloutPercentage` from `10%` to `25%` guarantees that the initial `10%` cohort keeps the feature enabled without disruption while `15%` new users are added.

---

## 3. Fail-Safe Defaults & Dual-State Testing

1. **Safe Fallback Default**: Every flag evaluation call MUST declare a hardcoded safe fallback value (`isEnabled('new-checkout-flow', context, false)`) so the application continues functioning with zero errors if the flag configuration store is unreachable.
2. **Dual-State Automated Testing**:
   - Unit and integration tests MUST verify behavior under **both** states:
     - `describe('when feature flag is OFF (legacy path)', ...)`
     - `describe('when feature flag is ON (new path)', ...)`
3. **Zero Flag Debt Rule**: When a Release Toggle reaches 100% production rollout for 14 days without incident, create a cleanup PR removing the dead `if/else` branch and flag definition.

