-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('SOLANA', 'BSC');

-- AlterTable: TradingAgent
ALTER TABLE "trading_agents" ADD COLUMN "chain" "Chain" NOT NULL DEFAULT 'SOLANA';
ALTER TABLE "trading_agents" ADD COLUMN "evmAddress" TEXT;

-- AlterTable: PaperTrade
ALTER TABLE "paper_trades" ADD COLUMN "chain" "Chain" NOT NULL DEFAULT 'SOLANA';

-- AlterTable: AgentTrade
ALTER TABLE "agent_trades" ADD COLUMN "chain" "Chain" NOT NULL DEFAULT 'SOLANA';

-- AlterTable: AgentPosition
ALTER TABLE "agent_positions" ADD COLUMN "chain" "Chain" NOT NULL DEFAULT 'SOLANA';

-- AlterTable: TreasuryAllocation
ALTER TABLE "treasury_allocations" ADD COLUMN "chain" "Chain" NOT NULL DEFAULT 'SOLANA';

-- CreateTable: TokenDeployment
CREATE TABLE "token_deployments" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "factoryTxHash" TEXT NOT NULL,
    "chain" "Chain" NOT NULL DEFAULT 'BSC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_deployments_tokenAddress_key" ON "token_deployments"("tokenAddress");
CREATE INDEX "token_deployments_agentId_idx" ON "token_deployments"("agentId");
CREATE INDEX "token_deployments_chain_idx" ON "token_deployments"("chain");

-- CreateIndex (chain indexes on existing tables)
CREATE INDEX "trading_agents_chain_idx" ON "trading_agents"("chain");
CREATE INDEX "agent_trades_chain_idx" ON "agent_trades"("chain");
