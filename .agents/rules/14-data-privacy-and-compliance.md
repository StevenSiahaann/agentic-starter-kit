---
trigger: model_decision
description: Data classification tiers (Public, Internal, Confidential PII, Restricted), automatic PII redaction/masking, GDPR and Indonesia UU PDP compliance, crypto-shredding, and immutable business audit trail (audit_logs). Activate when handling personal data, authentication, payments, logging, or compliance audits.
---

# Data Privacy, PII Redaction, & Compliance Audit Trail Standards

> **Status:** MANDATORY PRIVACY & COMPLIANCE STANDARD (GDPR / UU PDP / SOC2 / ISO 27001)  
> **Target:** All Databases, Loggers, Analytics Pipelines, and User Data Endpoints.

---

## 1. Four-Tier Data Classification Matrix

Every database column and DTO field MUST be classified into one of four sensitivity tiers:

| Tier | Classification | Examples | Storage & Logging Mandate |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **`PUBLIC`** | Product catalog names, public blog posts, public pricing. | Standard plaintext storage; safe to cache at CDN edge. |
| **Tier 2** | **`INTERNAL`** | Order UUIDs, internal status enums, timestamps, `trace_id`. | Standard encrypted-at-rest DB storage; safe to include in structured OTel logs. |
| **Tier 3** | **`CONFIDENTIAL_PII`** | Full name, email, phone number, home address, IP address, date of birth. | Masked in logs (`s***@domain.com`); scoped access; subject to Right-to-Erasure (UU PDP / GDPR). |
| **Tier 4** | **`RESTRICTED_SECRET`** | Passwords, National ID (NIK/SSN), PAN/CVV, API keys, JWTs, OAuth tokens. | **Argon2id** (passwords) or **AES-256-GCM** application-level encryption; **100% redacted (`[REDACTED]`) in all logs**. |

---

## 2. Automatic PII & Secret Redaction in Logs

Structured loggers (`otel-logger.ts`) MUST enforce an automatic recursive redaction scrubber before serializing any `context` object to `stdout`/`stderr`:
- Any key matching `/password|passphrase|secret|token|authorization|api[-_]?key|credit[-_]?card|card[-_]?number|cvv|pin|nik|ssn|private[-_]?key/i` MUST have its value replaced with `"[REDACTED]"`.
- Never log raw `req.headers` or raw `req.body` without passing through the redaction scrubber.

---

## 3. Immutable Business Audit Trail (`audit_logs`)

For regulatory compliance (SOC2, ISO 27001, financial audits), application logs in stdout are not sufficient for long-term forensic accountability. Every sensitive mutation (role/permission change, payout/refund, account deletion, security setting update) MUST write an immutable record to the `audit_logs` table:

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY, -- RFC 9562 UUIDv7
    actor_id UUID NOT NULL,
    actor_role VARCHAR(64) NOT NULL,
    actor_ip VARCHAR(45) NULL,
    action VARCHAR(128) NOT NULL, -- e.g., 'USER_ROLE_UPDATED', 'PAYOUT_APPROVED'
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    redacted_before JSONB NULL,
    redacted_after JSONB NULL,
    trace_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
```
* **Append-Only Rule**: The application database role MUST NOT have `UPDATE` or `DELETE` privileges on `audit_logs`.

---

## 4. Right-to-Erasure (UU PDP / GDPR) vs. Financial Ledger Integrity

When a user exercises their legal Right to Erasure (*Account Deletion Request*):
1. **Never Hard-Delete Financial Ledgers**: Deleting rows from `orders` or `payment_transactions` corrupts accounting reconciliation and violates tax retention laws.
2. **PII Anonymization & Crypto-Shredding**:
   - Scrub `CONFIDENTIAL_PII` columns on the `users` record (`email = 'deleted_<uuid>@redacted.invalid'`, `full_name = 'REDACTED_USER'`, `phone = NULL`, `deleted_at = NOW()`).
   - Destroy the user's unique encryption key in KMS/Vault (*Crypto-Shredding*) so any archived encrypted PII becomes permanently indecipherable while foreign key integrity on historical orders remains 100% intact.

