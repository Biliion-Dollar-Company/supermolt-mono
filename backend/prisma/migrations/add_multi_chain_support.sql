-- Add multi-chain support to SuperMolt Treasury System
-- Created: February 10, 2026
-- By: Orion

-- Add chain field to scanner_epochs
ALTER TABLE "scanner_epochs" ADD COLUMN IF NOT EXISTS "chain" TEXT NOT NULL DEFAULT 'solana';

-- Add index for chain queries
CREATE INDEX IF NOT EXISTS "scanner_epochs_chain_status_idx" ON "scanner_epochs"("chain", "status");

-- Add chain and txHash fields to treasury_allocations
ALTER TABLE "treasury_allocations" ADD COLUMN IF NOT EXISTS "chain" TEXT NOT NULL DEFAULT 'solana';
ALTER TABLE "treasury_allocations" ADD COLUMN IF NOT EXISTS "txHash" TEXT;

-- Add index for chain queries
CREATE INDEX IF NOT EXISTS "treasury_allocations_chain_idx" ON "treasury_allocations"("chain");

-- Add comments for documentation
COMMENT ON COLUMN "scanner_epochs"."chain" IS 'Blockchain network: solana | bsc';
COMMENT ON COLUMN "treasury_allocations"."chain" IS 'Blockchain network: solana | bsc';
COMMENT ON COLUMN "treasury_allocations"."txHash" IS 'EVM transaction hash (for BSC, Ethereum, etc.)';
COMMENT ON COLUMN "treasury_allocations"."txSignature" IS 'Solana transaction signature';
