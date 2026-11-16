---
trigger: glob
globs: "**/Dockerfile*, **/docker-compose*.yml, **/*.tf, **/*.tfvars, **/.github/workflows/*.yml, **/.github/workflows/*.yaml, **/k8s/**"
---

# DevOps, Containerization, & Infrastructure as Code (IaC) Standards

> **Status:** MANDATORY SRE & PLATFORM STANDARD  
> **Target:** Dockerfiles, GitHub Actions CI/CD Workflows, Kubernetes Manifests, and Terraform Modules.

---

## 1. Containerization Standard (Production-Grade Dockerfile)

Monolithic, root-privileged container images are strictly prohibited in production.

### A. Mandatory Multi-Stage Builds
Every Dockerfile MUST use at least 2 distinct stages:
1. **Stage 1 (`builder`)**: Installs compiler toolchains, `devDependencies`, runs static checks, bundles assets, and prunes development packages (`pnpm prune --prod`).
2. **Stage 2 (`runner`)**: Copies only compiled production artifacts (`dist/` or `.next/standalone`) and production `node_modules`. Compilers, source files, and package managers must never ship in the final image.

### B. Minimal Base Image: Distroless or Alpine
- Use minimal hardened base images: `gcr.io/distroless/nodejs20-debian12:nonroot` or `node:20-alpine`.
- Benefits: Eliminates shell binaries (`bash`, `curl`, `apk`/`apt`), drastically shrinks the attack surface, and keeps image size **$< 150\text{MB}$**.

### C. Mandatory Non-Root Execution
Never run container processes as `root` (`UID 0`).
```dockerfile
USER nonroot:nonroot
```

### D. Graceful Shutdown (`SIGTERM` & `SIGINT` Handling)
Containerized applications MUST trap OS termination signals (`SIGTERM` and `SIGINT`) to stop accepting new connections, drain in-flight HTTP requests, and cleanly close database/Redis pools before exiting:
```typescript
process.on('SIGTERM', async () => {
  appLogger.info('SIGTERM received. Starting graceful shutdown...', {}, 'SHUTDOWN_START');
  await httpServer.close();
  await databasePool.end();
  appLogger.info('Graceful shutdown completed. Exiting.', {}, 'SHUTDOWN_COMPLETE');
  process.exit(0);
});
```

### E. Mandatory Healthcheck Probes
Every service MUST expose two diagnostic endpoints:
- `/livez` (Liveness Probe): Confirms the process event loop is alive and not deadlocked.
- `/readyz` (Readiness Probe): Confirms downstream dependencies (PostgreSQL pool, Redis cache) are connected and ready to serve traffic.

---

## 2. Infrastructure as Code (IaC) Standards (Terraform / OpenTofu)

### A. Encrypted Remote State with State Locking
- Never commit `terraform.tfstate` files to Git or store state solely on local developer machines.
- Always configure an encrypted Remote State Backend with atomic State Locking:
  - **AWS**: S3 Bucket (`encrypt = true`, KMS encryption, Bucket Versioning enabled) + DynamoDB Table for state locking.
  - **Google Cloud**: GCS Bucket with Object Versioning and Cloud KMS encryption.

### B. Modularity & Zero ClickOps
- Organize infrastructure into isolated, reusable modules:
  - `modules/networking/` (VPC, Subnets, Security Groups, NAT)
  - `modules/database/` (RDS PostgreSQL / Cloud SQL, Redis)
  - `modules/compute/` (EKS / GKE / Cloud Run / ECS)
  - `modules/security/` (KMS Keys, Least-Privilege IAM Roles)
- **Zero ClickOps**: Never mutate production cloud resources manually through the web console. All changes must flow through version-controlled Terraform Pull Requests verified via `terraform plan`.

### C. Least-Privilege IAM
- Scope every service IAM role strictly to the minimum actions and resource ARNs required.
- Wildcard permissions (`Action: "*"` or `Resource: "*"`) are forbidden.

---

## 3. GitHub Actions CI/CD: Multi-Stage Quality Gates

Every Pull Request and `main` branch push must pass through sequential, non-bypassable quality gates:

```text
[Stage 1: Agent & Architectural Verification Harness] (harness-verify.sh)
       │
       ▼
[Stage 2: Static Analysis, Linter & TypeCheck] (ESLint + tsc --noEmit)
       │
       ▼
[Stage 3: Security SAST & Secret Scan] (TruffleHog + Trivy FS)
       │
       ▼
[Stage 4: Automated Test Suite] (Unit + Testcontainers Integration Tests)
       │
       ▼
[Stage 5: Distroless Container Build & Image CVE Scan] (Trivy Image)
       │
       ▼
[Stage 6: Deploy to Staging & Run Smoke/E2E Suite]
       │
       ▼
[Stage 7: Production Approval Gate -> Zero-Downtime Rolling/Blue-Green Deploy]
```
