---
name: owasp-security-audit
description: >-
  Executes a comprehensive security audit against OWASP Top 10 Web (A01-A10) and OWASP Top 10 for LLM (LLM01-LLM10).
  Use when the user asks for a security review, vulnerability assessment, pentest check, or OWASP compliance audit.
---

# OWASP Web & LLM Security Audit

Perform a systematic, read-only security assessment of the codebase following [01-security-and-owasp.md](../../rules/01-security-and-owasp.md).

## Audit Checklist & Execution Steps

1. **Automated Secret & Pattern Scan**:
   - Run `./.agents/hooks/scripts/harness-verify.sh` to check Gate 1 (Hardcoded secrets, private keys, API tokens).
   - Check `.gitignore` to ensure `.env`, `*.pem`, `*.key`, and `*.tfstate` are ignored.

2. **OWASP Web Top 10 Inspection (A01–A10)**:
   - **A01 (Broken Access Control & IDOR)**: Inspect all repository queries (`findById`, `update`, `delete`) to verify they filter by authenticated `user_id` or `tenant_id` extracted from server session/JWT, never from request body/query.
   - **A02 (Cryptographic Failures)**: Verify password hashing uses Argon2id or Bcrypt ($\text{cost} \ge 12$) and sensitive PII uses AES-256-GCM with unique IVs.
   - **A03 (Injection)**: Grep for string interpolation inside SQL queries, raw ORM queries (`$queryRawUnsafe`), or OS command execution (`exec`, `spawn` with `shell: true`).
   - **A05 & A07 (Headers & Auth)**: Check HTTP security headers (HSTS, CSP, X-Frame-Options) and JWT/Cookie attributes (`HttpOnly`, `Secure`, `SameSite=Strict`).
   - **A10 (SSRF)**: Inspect outbound `fetch`/`axios` calls using user-supplied URLs to ensure private IP ranges (`127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`) are blocked.

3. **OWASP LLM Top 10 Inspection (LLM01–LLM10)** *(if AI/LLM features exist)*:
   - Verify untrusted inputs are wrapped in XML delimiters (`<untrusted_user_input>`).
   - Verify LLM outputs are sanitized (`DOMPurify` on UI, Zod schema before tool execution).
   - Verify PII scrubber strips tokens/NIK/cards before external LLM API calls.

4. **Security Audit Report**:
   - Output a markdown table with columns: `ID`, `Category (OWASP)`, `Severity (CRITICAL/HIGH/MEDIUM/LOW)`, `Location (file:line)`, `Vulnerability Description`, and `Remediation Patch`.
