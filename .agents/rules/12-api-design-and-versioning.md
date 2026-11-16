---
trigger: glob
globs: "**/*controller*.ts, **/*route*.ts, **/*router*.ts, **/*dto*.ts, **/*schema*.ts, **/openapi*"
---

# API Design, Contract-First OpenAPI, & Versioning Standards

> **Status:** MANDATORY API ENGINEERING STANDARD  
> **Target:** All REST/HTTP Endpoints, gRPC Contracts, Request/Response DTOs, and Public Webhooks.

---

## 1. Contract-First & Schema-Driven API Design

Every API endpoint MUST be governed by an explicit, machine-verifiable schema (Zod-to-OpenAPI 3.1, TypeBox, or Protocol Buffers):
- **Single Source of Truth**: Generate OpenAPI 3.1 specifications and Frontend TypeScript client types directly from the validated backend Zod/DTO schemas. Never maintain disconnected manual API docs.
- **Strict Input Whitelisting**: Configure boundary Zod schemas to reject or strip unknown properties (`.strict()` on security-sensitive mutations) to prevent Mass Assignment vulnerabilities.

---

## 2. Standard Response & Cursor Pagination Envelopes

### A. Single Resource & Collection Success Envelopes
Maintain predictable JSON response shapes across all services:
```json
{
  "data": {
    "id": "018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
    "status": "PAID",
    "total_amount": 250000,
    "currency": "IDR",
    "created_at": "2026-11-16T12:00:00.000Z"
  },
  "meta": {
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736"
  }
}
```

### B. Cursor-Based (Keyset) Pagination Envelope
All collection endpoints returning $> 50$ potential records MUST implement Cursor Pagination (forbid unbounded list responses):
```json
{
  "data": [
    { "id": "018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e01", "status": "PAID" }
  ],
  "meta": {
    "limit": 20,
    "next_cursor": "018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e01",
    "has_more": true,
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736"
  }
}
```

---

## 3. API Versioning & Backward Compatibility Governance

### A. URI Path Versioning
Prefix all external-facing HTTP endpoints with an explicit major version:
`/api/v1/orders`, `/api/v2/orders`.

### B. Non-Breaking vs. Breaking Changes
Never introduce a breaking change within an existing major version (`v1`):
- **Allowed (Non-Breaking / Additive)**:
  - Adding a new *optional* field to a request payload.
  - Adding a new field to a response payload.
  - Adding a new endpoint or HTTP method.
- **Forbidden in Same Version (Breaking — Requires `/api/v2/`)**:
  - Removing or renaming any existing response field.
  - Changing a field's data type (e.g., `number` $\rightarrow$ `string` or object structure).
  - Adding a new *required* field to an existing request payload without a default value.
  - Changing HTTP status codes or error code enums that clients branch on.

### C. Deprecation & Sunset Headers (RFC 8594)
When deprecating an endpoint or API version, keep `v1` operational for the agreed migration window (minimum 90 days for external clients) and emit standard HTTP headers:
```http
Deprecation: true
Sunset: Wed, 18 Feb 2027 23:59:59 GMT
Link: <https://api.domain.com/api/v2/orders>; rel="successor-version"
```

---

## 4. Semantic HTTP Status Codes

| Status Code | Semantic Usage |
| :--- | :--- |
| `200 OK` | Synchronous `GET`, `PATCH`, or `PUT` completed with response payload. |
| `201 Created` | Resource created synchronously via `POST` (include `Location` header when applicable). |
| `202 Accepted` | Asynchronous command queued for background processing (return job/operation tracking ID). |
| `204 No Content` | Successful `DELETE` or state transition with no response body. |
| `400 Bad Request` | Malformed JSON syntax, missing required header, or unparseable query string. |
| `401 Unauthorized` | Missing, expired, or cryptographically invalid authentication token. |
| `403 Forbidden` | Authenticated subject lacks RBAC/ABAC permission or resource ownership. |
| `404 Not Found` | Target entity ID does not exist (or is masked to prevent IDOR enumeration). |
| `409 Conflict` | Business state conflict (`ORDER_ALREADY_CANCELLED`, optimistic lock `version` mismatch, or `IDEMPOTENCY_IN_PROGRESS`). |
| `422 Unprocessable Entity` | Syntactically valid JSON that fails Zod schema validation or domain invariant rules. |
| `429 Too Many Requests` | Rate limit quota exceeded (must include `Retry-After` header). |
| `500 Internal Server Error` | Masked unexpected system failure (never leak SQL/stack traces; always include `trace_id`). |
| `503 Service Unavailable` | Downstream dependency circuit breaker is `OPEN` or service is draining during `SIGTERM`. |

