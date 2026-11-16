---
trigger: model_decision
description: Financial calculation accuracy, integer minor units, Banker's Rounding, Double-Entry Bookkeeping ledger schema, UTC and monotonic clock discipline, and Unicode/i18n standards. Activate when working on payments, wallets, pricing, accounting, timestamps, scheduling, or localization.
---

# Financial Precision, Double-Entry Ledger, Time, & i18n Standards

> **Status:** MANDATORY DOMAIN INTEGRITY STANDARD  
> **Target:** All Financial Calculations, Pricing Engines, Wallets, Scheduled Jobs, and Internationalized Text.

---

## 1. Monetary Precision & Rounding Discipline

### A. Strict Ban on IEEE 754 Floating-Point for Money
- **Never use `number` floats, `FLOAT`, or `DOUBLE PRECISION` for monetary amounts, exchange rates, or tax/discount calculations** (`0.1 + 0.2 === 0.30000000000000004`).
- **Mandatory Representation**:
  - Store and compute monetary values in **Integer Minor Units** (`BIGINT` in SQL, `bigint` in TypeScript — e.g., cents/sen) OR exact fixed-point **`NUMERIC(19, 4)`** paired with an arbitrary-precision decimal library.
  - Always pair every monetary amount with its explicit ISO 4217 3-letter currency code (`IDR`, `USD`, `SGD`) inside a `Money` Value Object. Never add or compare amounts of different currencies without an explicit exchange rate conversion record.

### B. Banker's Rounding (Round Half to Even)
- When dividing monetary amounts or applying percentage taxes/discounts, enforce **Banker's Rounding (IEEE 754 Round Half to Even)** to eliminate systematic upward bias across millions of transactions.
- Allocate remainder pennies deterministically (e.g., largest-remainder method when splitting an invoice across line items so $\sum \text{Line Items} \equiv \text{Invoice Total}$).

---

## 2. Double-Entry Bookkeeping Ledger Invariant

For wallets, account balances, escrow, or loyalty points, **never mutate a single `balance` column in isolation** without an immutable ledger trail.

### A. Append-Only Double-Entry Schema (`ledger_entries`)
Every financial movement MUST record balanced Debit and Credit entries inside a single ACID transaction:
```sql
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY, -- RFC 9562 UUIDv7
    transaction_id UUID NOT NULL,
    account_id UUID NOT NULL,
    direction VARCHAR(6) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_account_created ON ledger_entries(account_id, created_at DESC);
CREATE INDEX idx_ledger_transaction ON ledger_entries(transaction_id);
```
* **Zero-Sum Invariant**: For every `transaction_id`, the sum of `DEBIT` entries MUST strictly equal the sum of `CREDIT` entries ($\sum \text{Debits} - \sum \text{Credits} = 0$).
* **Immutability**: Corrections or refunds are executed by inserting a new **Reversing Entry**, never by `UPDATE` or `DELETE` on existing `ledger_entries`.

---

## 3. Timezone & Clock Discipline

### A. Storage vs. Presentation Timezones
1. **Storage & Wire Transfer**: Always store timestamps in PostgreSQL as `TIMESTAMPTZ` (UTC) and serialize in JSON as ISO 8601 UTC strings (`2026-11-16T14:30:00.000Z`).
2. **Business Day Cutoffs & Billing Cycles**: Never rely on the container's local OS timezone. Always pass an explicit **IANA Timezone Identifier** (e.g., `Asia/Jakarta`, `Asia/Singapore`, `America/New_York`) when computing end-of-day (EOD) settlement windows or recurring schedules.

### B. Monotonic Clocks for Duration Measurement
- **Never use `Date.now()` to measure elapsed execution duration (`duration_ms`)** or timeouts. System wall clocks (`Date.now()`) can jump backward or forward when NTP (Network Time Protocol) synchronizes the host clock.
- Always use the OS **Monotonic Clock** (`performance.now()` or `process.hrtime.bigint()`) for latency telemetry, profiling, and timeout calculation.

---

## 4. Unicode Normalization & Internationalization (i18n)

- **Unicode NFC Normalization**: Normalize all user-supplied strings using `.normalize('NFC')` before hashing, comparing, or storing usernames/emails (prevents homograph/canonical-equivalence bugs where `é` composed vs. decomposed produces different byte sequences).
- **Locale-Aware Formatting**: Format currencies, numbers, and dates at the UI presentation boundary using standard `Intl.NumberFormat` and `Intl.DateTimeFormat`, never via manual string concatenation.

