-- Create test agents for Polymarket integration
INSERT INTO "TradingAgent" (id, "userId", "archetypeId", name, status, "createdAt", "updatedAt")
VALUES 
  ('agent-alpha-politics', 'system', 'politics-specialist', 'Agent Alpha (Politics)', 'ACTIVE', NOW(), NOW()),
  ('agent-beta-crypto', 'system', 'crypto-specialist', 'Agent Beta (Crypto)', 'ACTIVE', NOW(), NOW()),
  ('agent-gamma-sentiment', 'system', 'sentiment-analyzer', 'Agent Gamma (Sentiment)', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "archetypeId" = EXCLUDED."archetypeId",
  "updatedAt" = NOW();
