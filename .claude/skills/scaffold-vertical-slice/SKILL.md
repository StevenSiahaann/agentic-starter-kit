---
name: scaffold-vertical-slice
description: >-
  Scaffolds a complete production-grade vertical feature slice adhering to Clean Architecture,
  CQRS, Result<T, E> error handling, UUIDv7, Transactional Outbox, and AAA unit tests.
  Use when the user asks to create a new feature, module, endpoint, or use-case.
---

# Scaffold Vertical Slice Feature

Use this skill whenever creating a new feature or module so that every layer is generated consistently without creating monolithic "God Services".

## Step-by-Step Procedure

1. **Check Project Context**:
   - If `.agents/project-context.md` exists, read it first to align with the project's primary language, framework, and bounded contexts.

2. **Layer 1 — Domain Layer (`src/modules/<domain>/domain/`)**:
   - Create Rich Domain Entity (`<entity>.entity.ts`) with private constructor, factory method, invariant validations, and `version` field for optimistic concurrency.
   - Define specific `DomainError` subclasses (`<error-name>.error.ts`) with explicit HTTP `statusCode` (4xx) and machine-readable `code`.
   - Use the `Result<TSuccess, TError>` pattern from [use-case-template.ts](../../templates/use-case-template.ts). Never throw raw exceptions for domain errors.

3. **Layer 2 — Application Layer (`src/modules/<domain>/application/`)**:
   - Create focused Command or Query Handler (`<action>-<entity>.handler.ts`, max 150 lines).
   - Define outward Port interfaces (`<entity>-repository.port.ts`).
   - Generate IDs using RFC 9562 `generateUuidV7()`.
   - Persist domain state and `OutboxEventRecord` atomically (`saveWithOutbox`).
   - Log business milestones using `appLogger` ([otel-logger.ts](../../templates/otel-logger.ts)) with automatic `trace_id` correlation.

4. **Layer 3 — Infrastructure & Presentation Layer (`src/modules/<domain>/infrastructure/`)**:
   - Implement Repository adapter using 100% parameterized queries.
   - Wire thin HTTP/gRPC controller with Zod schema validation at the boundary.
   - For mutating endpoints (POST/PUT/PATCH), enforce `Idempotency-Key` middleware ([idempotency-middleware.ts](../../templates/idempotency-middleware.ts)) and return RFC 7807 Problem Details on error.

5. **Layer 4 — Automated Tests (`tests/`)**:
   - Write Unit Tests (`<action>-<entity>.handler.spec.ts`) following explicit `// 1. ARRANGE`, `// 2. ACT`, `// 3. ASSERT` blocks (target $\ge 95\%$ branch coverage on domain).
   - Never mock Domain Entities; mock only external gateway ports.

6. **Verification**:
   - Run `./.agents/hooks/scripts/harness-verify.sh` to verify zero `any`, zero `console.log`, and passing tests.
