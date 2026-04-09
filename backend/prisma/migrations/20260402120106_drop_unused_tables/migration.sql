-- Drop confirmed-unused tables (zero db.* references in src/, verified 2026-04-02)
-- NOTE: All other models previously flagged as "unused" ARE used via the db alias.

-- TreasuryPool: never queried (treasury_allocations is the live model)
DROP TABLE IF EXISTS "treasury_pool" CASCADE;

-- TokensMetadata: never queried anywhere in src/
DROP TABLE IF EXISTS "tokens_metadata" CASCADE;

-- JobExecutionLock: defined but never acquired or checked in src/
DROP TABLE IF EXISTS "job_execution_locks" CASCADE;
