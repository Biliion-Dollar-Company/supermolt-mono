-- CreateEnum
CREATE TYPE "PredictionPlatform" AS ENUM ('KALSHI', 'DRIFT_BET', 'POLYMARKET', 'HEDGEHOG');

-- CreateEnum
CREATE TYPE "PredictionOutcome" AS ENUM ('PENDING', 'YES', 'NO', 'VOID');

-- CreateEnum
CREATE TYPE "PredictionSide" AS ENUM ('YES', 'NO');

-- CreateTable
CREATE TABLE "prediction_markets" (
    "id" TEXT NOT NULL,
    "platform" "PredictionPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subtitle" TEXT,
    "yesPrice" DECIMAL(8,4) NOT NULL,
    "noPrice" DECIMAL(8,4) NOT NULL,
    "volume" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outcome" "PredictionOutcome" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prediction_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_predictions" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" "PredictionSide" NOT NULL,
    "contracts" INTEGER NOT NULL DEFAULT 1,
    "avgPrice" DECIMAL(8,4) NOT NULL,
    "totalCost" DECIMAL(18,6) NOT NULL,
    "payout" DECIMAL(18,6),
    "pnl" DECIMAL(18,6),
    "outcome" "PredictionOutcome" NOT NULL DEFAULT 'PENDING',
    "confidence" INTEGER,
    "reasoning" TEXT,
    "realOrder" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_stats" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "totalPredictions" INTEGER NOT NULL DEFAULT 0,
    "correctPredictions" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "brierScore" DECIMAL(8,6) NOT NULL DEFAULT 1,
    "roi" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalPayout" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prediction_markets_platform_externalId_key" ON "prediction_markets"("platform", "externalId");

-- CreateIndex
CREATE INDEX "prediction_markets_category_idx" ON "prediction_markets"("category");

-- CreateIndex
CREATE INDEX "prediction_markets_outcome_idx" ON "prediction_markets"("outcome");

-- CreateIndex
CREATE INDEX "prediction_markets_expiresAt_idx" ON "prediction_markets"("expiresAt");

-- CreateIndex
CREATE INDEX "prediction_markets_status_idx" ON "prediction_markets"("status");

-- CreateIndex
CREATE INDEX "agent_predictions_agentId_idx" ON "agent_predictions"("agentId");

-- CreateIndex
CREATE INDEX "agent_predictions_marketId_idx" ON "agent_predictions"("marketId");

-- CreateIndex
CREATE INDEX "agent_predictions_agentId_outcome_idx" ON "agent_predictions"("agentId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_stats_agentId_key" ON "prediction_stats"("agentId");

-- CreateIndex
CREATE INDEX "prediction_stats_accuracy_idx" ON "prediction_stats"("accuracy");

-- CreateIndex
CREATE INDEX "prediction_stats_brierScore_idx" ON "prediction_stats"("brierScore");

-- AddForeignKey
ALTER TABLE "agent_predictions" ADD CONSTRAINT "agent_predictions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "prediction_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
