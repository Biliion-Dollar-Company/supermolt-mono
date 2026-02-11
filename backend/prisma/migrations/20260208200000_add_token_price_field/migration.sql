-- AlterTable: Add tokenPrice to PaperTrade
-- Stores the actual token price in USD at entry time
-- (entryPrice stores SOL/USD price, tokenPrice stores the token's own USD price)
ALTER TABLE "paper_trades" ADD COLUMN "tokenPrice" DECIMAL(24, 12);
