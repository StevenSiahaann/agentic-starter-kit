---
name: zero-downtime-migration
description: >-
  Authors and validates backward-compatible database migrations using the Expand-and-Contract pattern,
  enforcing 3NF, UUIDv7, Foreign Key B-Tree indexes, and lock-free DDL operations.
  Use when creating, altering, or reviewing SQL/ORM database migrations.
---

# Zero-Downtime Database Migration (Expand-and-Contract)

Use this skill whenever creating or reviewing database schema changes to prevent production downtime and table locking, adhering to [04-database-and-cqrs.md](../../rules/04-database-and-cqrs.md).

## Rules for Zero-Downtime DDL

1. **Never Rename or Drop Columns Directly in One Release**:
   - Renaming or dropping a column while old application containers are still running causes immediate `500 Internal Server Error` during rolling deployments.
   - Always follow the 3-phase **Expand-and-Contract** pattern:
     - **Phase 1 (Expand)**: Add the new column as `NULL`-able (or with a non-locking default). Deploy code that dual-writes to both old and new columns.
     - **Phase 2 (Backfill)**: Backfill historical rows in small batches ($1,000$ rows per transaction) without holding long table locks. Transition read queries to the new column.
     - **Phase 3 (Contract)**: Remove references to the old column in code, deploy, and only then drop the old column in a subsequent migration.

2. **Prevent Full-Table Locks on Indexes & Constraints**:
   - In PostgreSQL, always use `CREATE INDEX CONCURRENTLY` on existing large tables.
   - When adding a `NOT NULL` or `FOREIGN KEY` constraint to a populated table, create the constraint as `NOT VALID` first, then run `VALIDATE CONSTRAINT` in a separate step.

3. **Mandatory Schema Standards Check**:
   - Primary key must be `UUID` (generated via RFC 9562 **UUIDv7**).
   - Every table must include: `id`, `version INT NOT NULL DEFAULT 1`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `created_by UUID NULL`, `deleted_at TIMESTAMPTZ NULL`.
   - Every Foreign Key column must have an explicit B-Tree index (`CREATE INDEX idx_<table>_<fk> ON <table>(<fk>);`) and explicit `ON DELETE` clause.
