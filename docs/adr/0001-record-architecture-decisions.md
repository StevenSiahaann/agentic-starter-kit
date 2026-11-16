# 1. Record Architecture Decisions

Date: 2026-11-16  
Status: Accepted  
Deciders: Engineering Management, Principal Architects, Tech Leads  

---

## Context
We need a standard, lightweight method to record architectural and technical decisions made on this repository. These decisions must be preserved in version control alongside the source code so that current and future engineers (and AI agents) understand the context, trade-offs, and invariants governing the system.

## Decision
We will use Architecture Decision Records (ADRs) stored in `docs/adr/` formatted using Markdown, following Michael Nygard's structure.

Each ADR document will capture:
1. **Title and Number**: Sequential identifier (`NNNN-title.md`).
2. **Status**: Proposed, Accepted, Rejected, Deprecated, or Superseded.
3. **Context**: The business, organizational, or technical motivation behind the decision.
4. **Decision**: The selected direction, invariant, or technology stack choice.
5. **Consequences**: Both positive outcomes and negative trade-offs/operational obligations accepted.

New ADRs will be generated using the `.agents/skills/adr-writer/` skill.

## Consequences
### Positive
- Clear historical record of "why" technical decisions were made, preventing repetitive debates.
- AI coding agents can read `docs/adr/` to respect existing architectural boundaries.
- Onboarding time for new engineers is substantially reduced.

### Negative / Trade-offs
- Requires discipline to update or supersede ADRs when requirements or technology landscapes change.

