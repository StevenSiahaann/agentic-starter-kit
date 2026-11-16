-- ==============================================================================
-- SCHEMA BASELINE: Enterprise Transactional Foundations (PostgreSQL 16+)
-- ==============================================================================
-- Governed by: .agents/rules/04-database-and-cqrs.md, 14-data-privacy, 15-financial-time,
--              16-webhooks-and-event-contracts, and 18-multi-tenancy-and-background-jobs.
-- Features:
-- 1. RFC 9562 UUIDv7 Primary Keys (Time-ordered, B-Tree optimal).
-- 2. Multi-Tenant Row-Level Security (RLS) via current_setting('app.current_tenant_id').
-- 3. Idempotency Key Storage with scoped locks.
-- 4. Transactional Outbox & Inbox deduplication patterns.
-- 5. Dead Letter Queue (DLQ) poison-pill quarantine.
-- 6. Immutable Double-Entry Ledger (Integer Minor Units) & Audit Trail.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. IDEMPOTENCY KEYS (Rule 03 & 04)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
  response_code INT,
  response_body JSONB,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key),
  CONSTRAINT chk_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys (expires_at);

-- ==============================================================================
-- 3. TRANSACTIONAL OUTBOX EVENTS (Rule 04 & 10)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS outbox_events (
  id VARCHAR(36) PRIMARY KEY,                    -- RFC 9562 UUIDv7
  tenant_id VARCHAR(64) NOT NULL,
  aggregate_type VARCHAR(128) NOT NULL,          -- e.g. 'Order', 'Payment'
  aggregate_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(128) NOT NULL,              -- e.g. 'order.created'
  payload JSONB NOT NULL,
  traceparent VARCHAR(128) NOT NULL,             -- W3C Distributed Tracing header
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT chk_outbox_status CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_poll ON outbox_events (status, created_at)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX IF NOT EXISTS idx_outbox_tenant_aggregate ON outbox_events (tenant_id, aggregate_type, aggregate_id);

-- ==============================================================================
-- 4. TRANSACTIONAL INBOX EVENTS (Rule 16)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS inbox_events (
  id VARCHAR(36) PRIMARY KEY,                    -- RFC 9562 UUIDv7
  tenant_id VARCHAR(64) NOT NULL,
  event_id VARCHAR(128) NOT NULL,                -- External Producer Event ID
  producer VARCHAR(128) NOT NULL,                -- e.g. 'stripe', 'midtrans'
  event_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inbox_producer_event UNIQUE (tenant_id, producer, event_id),
  CONSTRAINT chk_inbox_status CHECK (status IN ('PROCESSING', 'PROCESSED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_inbox_tenant_status ON inbox_events (tenant_id, status);

-- ==============================================================================
-- 5. DEAD LETTER QUEUE (DLQ) & POISON-PILL QUARANTINE (Rule 10 & 18)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dead_letter_events (
  id VARCHAR(36) PRIMARY KEY,                    -- RFC 9562 UUIDv7
  tenant_id VARCHAR(64) NOT NULL,
  original_event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'QUARANTINED',
  original_trace_id VARCHAR(64),
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replayed_at TIMESTAMPTZ,
  CONSTRAINT chk_dlq_status CHECK (status IN ('QUARANTINED', 'REPLAYED', 'DISCARDED'))
);

CREATE INDEX IF NOT EXISTS idx_dlq_tenant_status ON dead_letter_events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dlq_event_type ON dead_letter_events (event_type);

-- ==============================================================================
-- 6. DOUBLE-ENTRY FINANCIAL LEDGER (Rule 15)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id VARCHAR(36) PRIMARY KEY,                    -- RFC 9562 UUIDv7
  tenant_id VARCHAR(64) NOT NULL,
  transaction_id VARCHAR(64) NOT NULL,           -- Correlates debit and credit legs
  account_id VARCHAR(64) NOT NULL,
  entry_type VARCHAR(16) NOT NULL,               -- 'DEBIT' | 'CREDIT'
  amount_minor BIGINT NOT NULL,                  -- Integer minor units (e.g. cents, 10000 = $100.00)
  currency CHAR(3) NOT NULL,                     -- ISO 4217 (e.g. 'IDR', 'USD')
  running_balance_minor BIGINT NOT NULL,         -- Balance checkpoint after entry
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ledger_entry_type CHECK (entry_type IN ('DEBIT', 'CREDIT')),
  CONSTRAINT chk_ledger_positive_amount CHECK (amount_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_account_created ON ledger_entries (tenant_id, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON ledger_entries (tenant_id, transaction_id);

-- ==============================================================================
-- 7. IMMUTABLE BUSINESS AUDIT LOGS (Rule 14)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,                    -- RFC 9562 UUIDv7
  tenant_id VARCHAR(64) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,                 -- User or Service Principal ID
  action VARCHAR(64) NOT NULL,                   -- e.g. 'user.password_reset'
  resource_type VARCHAR(64) NOT NULL,            -- e.g. 'Account', 'Order'
  resource_id VARCHAR(64) NOT NULL,
  diff JSONB,                                    -- Redacted state delta { before, after }
  ip_address VARCHAR(45),                        -- IPv4 or IPv6
  user_agent TEXT,
  trace_id VARCHAR(64) NOT NULL,                 -- W3C Trace Correlation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (tenant_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

-- ==============================================================================
-- 8. ROW-LEVEL SECURITY (RLS) POLICIES (Rule 18)
-- ==============================================================================
-- Enable RLS across multi-tenant tables
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create Tenant Isolation Policies based on current session setting: app.current_tenant_id
DROP POLICY IF EXISTS tenant_isolation_idempotency ON idempotency_keys;
CREATE POLICY tenant_isolation_idempotency ON idempotency_keys
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_outbox ON outbox_events;
CREATE POLICY tenant_isolation_outbox ON outbox_events
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_inbox ON inbox_events;
CREATE POLICY tenant_isolation_inbox ON inbox_events
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_dlq ON dead_letter_events;
CREATE POLICY tenant_isolation_dlq ON dead_letter_events
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_ledger ON ledger_entries;
CREATE POLICY tenant_isolation_ledger ON ledger_entries
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

DROP POLICY IF EXISTS tenant_isolation_audit ON audit_logs;
CREATE POLICY tenant_isolation_audit ON audit_logs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
