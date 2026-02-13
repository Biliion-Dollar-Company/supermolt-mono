-- CreateTable
CREATE TABLE "tracked_wallets" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "chain" "Chain" NOT NULL DEFAULT 'SOLANA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buy_triggers" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buy_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_wallets_agentId_idx" ON "tracked_wallets"("agentId");

-- CreateIndex
CREATE INDEX "tracked_wallets_address_idx" ON "tracked_wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_wallets_agentId_address_chain_key" ON "tracked_wallets"("agentId", "address", "chain");

-- CreateIndex
CREATE INDEX "buy_triggers_agentId_idx" ON "buy_triggers"("agentId");

-- CreateIndex
CREATE INDEX "buy_triggers_agentId_enabled_idx" ON "buy_triggers"("agentId", "enabled");

-- AddForeignKey
ALTER TABLE "tracked_wallets" ADD CONSTRAINT "tracked_wallets_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "trading_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_triggers" ADD CONSTRAINT "buy_triggers_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "trading_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
