-- SuperMolt XP System Migration
-- Run this on Railway PostgreSQL database

-- Add XP and Level columns to trading_agents
ALTER TABLE "trading_agents" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trading_agents" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;

-- Index for leaderboard queries by XP
CREATE INDEX IF NOT EXISTS "trading_agents_xp_idx" ON "trading_agents"("xp");

-- Make tokenMint optional on agent_tasks (for onboarding tasks that aren't token-bound)
ALTER TABLE "agent_tasks" ALTER COLUMN "tokenMint" DROP NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'trading_agents' 
AND column_name IN ('xp', 'level');

-- Verify tokenMint is now nullable
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agent_tasks' 
AND column_name = 'tokenMint';
