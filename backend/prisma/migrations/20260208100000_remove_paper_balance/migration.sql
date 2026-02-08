-- AlterTable: Remove paperBalance column from TradingAgent
ALTER TABLE "TradingAgent" DROP COLUMN IF EXISTS "paperBalance";
