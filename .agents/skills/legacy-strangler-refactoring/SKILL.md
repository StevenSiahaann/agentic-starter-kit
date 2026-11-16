---
name: legacy-strangler-refactoring
description: >-
  Modernizes legacy codebases safely using the Strangler Fig pattern, Characterization (Golden Master) tests,
  and incremental extraction from monolithic God Services into Clean Architecture Use-Case handlers.
  Use when refactoring legacy code, eliminating God Services, or onboarding an existing codebase to .agents standards.
---

# Legacy Codebase Modernization (Strangler Fig & Characterization Testing)

Use this skill when applying `.agents/` engineering standards to an existing legacy codebase that lacks unit tests, contains monolithic "God Services", or uses untyped `any` payloads.

## Step-by-Step Safe Refactoring Procedure

1. **Freeze Behavior First with Characterization Tests (Golden Master)**:
   - **Never refactor legacy code without a safety net**.
   - Before modifying a legacy function or endpoint, write a black-box **Characterization Test** (following the AAA pattern in [06-testing-strategy.md](../../rules/06-testing-strategy.md)) that captures the current actual input/output behavior—including edge cases and error responses.

2. **Establish an Anti-Corruption Layer (ACL) / Facade Boundary**:
   - Wrap the legacy module behind a clean Application Port interface (`<domain>-service.port.ts`).
   - Validate all incoming external data at the boundary using a strict Zod schema so untyped `any` data cannot leak into newly extracted code.

3. **Extract One Vertical Use-Case Slice at a Time (Strangler Fig Pattern)**:
   - Identify a single cohesive business action inside the God Service (e.g., `cancelOrder`).
   - Extract it into a standalone Clean Architecture Command/Query Handler (`cancel-order.handler.ts`, max 150 lines) returning `Result<T, DomainError>`.
   - Route calls through a **Release Feature Flag** ([feature-flag-evaluator.ts](../../templates/feature-flag-evaluator.ts)):
     - Flag `OFF`: Executes legacy code path.
     - Flag `ON`: Executes new Clean Architecture Use-Case handler.

4. **Verify Parity & Retire Dead Code**:
   - Run the Characterization Test suite against both Flag `OFF` and Flag `ON` states.
   - Once rolled out to 100% of production traffic for $\le 14\text{ days}$ with zero error regression, delete the legacy code path and remove the temporary feature flag.
