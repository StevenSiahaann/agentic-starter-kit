---
name: adr-writer
description: >-
  Generates structured Architecture Decision Records (ADRs) in docs/adr/ evaluating trade-offs,
  Modular Monolith vs Microservices criteria, CQRS boundaries, and operational impact.
  Use when the user asks to document an architectural decision, evaluate tech stack choices, or decide between monolith and microservices.
---

# Architecture Decision Record (ADR) Writer

Use this skill to document significant architectural decisions in `docs/adr/NNNN-<kebab-case-title>.md`, following [10-monolith-vs-microservices.md](../../rules/10-monolith-vs-microservices.md).

## ADR Structure Template

Create a new file `docs/adr/NNNN-<slug>.md` with the following sections:

1. **Metadata**:
   - **Status**: `Proposed` | `Accepted` | `Superseded`
   - **Date**: `YYYY-MM-DD`
   - **Deciders**: Engineering Manager, Lead Architects

2. **Context & Problem Statement**:
   - Describe the business domain, current bottleneck, traffic scale (RPS, data volume), and team topology (number of squads/engineers).

3. **Evaluation Against Architecture Matrix**:
   - If deciding between **Modular Monolith** and **Microservices**, explicitly score the 6 criteria from `10-monolith-vs-microservices.md`:
     1. Team Size ($<30$ engineers $\rightarrow$ Modular Monolith default).
     2. Domain Maturity & Bounded Context stability.
     3. ACID Transaction vs Eventual Consistency (Saga) requirement.
     4. Asymmetric Scaling requirement (100x load hotspot).
     5. Infrastructure & SRE readiness (Kubernetes, Kafka, OTel, Outbox).
     6. Regulatory Isolation (e.g., PCI-DSS boundary).

4. **Considered Options**:
   - List at least 3 alternatives with concrete Pros, Cons, Big-O / Latency impact, and Operational Cost.

5. **Decision Outcome & Consequences**:
   - State the chosen option clearly.
   - Define required mitigations (e.g., Circuit Breaker, Transactional Outbox, Idempotency Keys, SLO targets).
