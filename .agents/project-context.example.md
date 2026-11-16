# Project-Specific Engineering Context (`project-context.md`)

> **Instructions for Engineering Managers / Tech Leads:**
> Copy this file to `.agents/project-context.md` in your target repository. The `.agents/project-context.md` file is **never overwritten** when running `sync-to-project.sh` to pull upstream updates from `agentic-starter-kit`.

---

## 1. Project Identity & Architecture
- **Service / Project Name**: `e.g., core-payment-service`
- **Architecture Pattern**: `Modular Monolith` (Default) | `Microservice`
- **Bounded Contexts / Domain Modules**:
  - `orders`: Order lifecycle and shopping cart management
  - `billing`: Payment gateway orchestration and ledger reconciliation
  - `identity`: Authentication, RBAC/ABAC authorization, and session management

## 2. Project Tech Stack
- **Backend Language & Runtime**: `TypeScript 5.x (Node.js 20 LTS)` *(or Go 1.23 / Python 3.12 FastAPI)*
- **Backend Framework**: `Fastify / NestJS / Hono`
- **Database & ORM**: `PostgreSQL 16 + Drizzle ORM / Prisma`
- **Cache & Distributed Lock Store**: `Redis 7`
- **Message Broker**: `In-Memory Domain Event Bus (Modular Monolith)` *(or Apache Kafka / RabbitMQ)*
- **Frontend Stack**: `React 19 + Next.js / Vite + TanStack Query v5 + React Hook Form + Zod + Tailwind CSS`

## 3. Local Build, Test, & Verification Commands
- **Install Dependencies**: `pnpm install`
- **Run Linter**: `pnpm run lint`
- **Run Static Typecheck**: `pnpm exec tsc --noEmit`
- **Run Unit Tests**: `pnpm run test:unit`
- **Run Integration Tests**: `pnpm run test:integration`

## 4. Domain-Specific Invariants & Overrides
- All monetary values MUST be stored in integer minor units (`BIGINT` cents/sen) — never IEEE 754 floating-point decimals.
- All timestamps MUST be stored and transmitted in `UTC` (`TIMESTAMPTZ`).
