# Security Policy & Responsible Vulnerability Disclosure

The **`.agents/` Enterprise Production Engineering Framework** treats security, secret confidentiality, and data protection as foundational invariants.

---

## 1. Supported Versions

We provide security patches, CVE vulnerability remediations, and dependency updates for the following versions:

| Version | Supported | Status |
| :--- | :--- | :--- |
| **2.x (Current)** | :white_check_mark: | Full Active Security & Architecture Support |
| **1.x** | :x: | End of Life (Upgrade to 2.x recommended) |

---

## 2. Reporting a Vulnerability

If you discover a potential security vulnerability, secret leakage risk, injection vector, or authentication bypass within this repository or any downstream project using `.agents/` standards:

> **DO NOT create a public GitHub Issue, Pull Request, or Discussion.**

Please disclose the issue responsibly using one of the following methods:

1. **GitHub Private Security Advisory**: Open a confidential advisory directly under the **Security** tab of this repository.
2. **Direct Security Email**: Send an encrypted or confidential email to:
   * **Email**: `security@stevensiahaan.com` (or your enterprise security inbox)
   * **Subject**: `[SECURITY VULNERABILITY] .agents framework - <brief title>`

### Information to Include in Your Report
To accelerate validation and triage, please include:
- Description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Affected files, rules, templates, or hooks.
- Proposed remediation or patch if available.

---

## 3. Vulnerability Response SLA

Our engineering team operates under strict response service level objectives:
* **Acknowledgment**: Within **24 hours** of submission.
* **Triage & Severity Assessment**: Within **72 hours** (Common Vulnerability Scoring System — CVSS v3.1).
* **Patch & Coordinated Disclosure**: Critical issues resolved within **7 business days** with an accompanying changelog security advisory.

---

## 4. Built-In Security Guardrails

All codebases governed by this framework enforce automated runtime and pre-commit security gates:
* **Pre-Command Safety Guard (`pre-command-guard.sh`)**: Forbids reading/writing live `.env` files, prevents piping untrusted curl commands to bash, and blocks destructive git commands.
* **Static Secret Detection**: The verification harness (`harness-verify.sh`) continuously scans for AWS keys, GitHub tokens, Google API keys, and RSA/Ed25519 private keys.
* **OWASP Top 10 Web & LLM Standards**: Enforced via `.agents/rules/01-security-and-owasp.md` and automated via `.agents/skills/owasp-security-audit/`.
