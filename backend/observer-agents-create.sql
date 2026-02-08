-- SQL to Create 5 Observer Agents
-- Run this in Railway PostgreSQL database

BEGIN;

-- 🛡️ Agent Alpha
INSERT INTO "TradingAgent" (
  "id", "userId", "archetypeId", "name", "status", "config", "createdAt", "updatedAt"
) VALUES (
  'obs_2d699d1509105cd0',
  '2wXYgPnrG4k5EPrBD2SXAtWRuzgiEJP5hGJrkng1o8QU',
  'observer',
  'Agent Alpha',
  'ACTIVE',
  '{"persona":"Conservative Value Investor","strategy":"Risk-averse, focuses on fundamentals and liquidity","focusAreas":["holder_concentration","liquidity_depth","smart_money","risk_metrics"],"emoji":"🛡️","traits":["cautious","analytical","risk-focused"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"5t6MbHLuJ1WT9PvhvKUsURGFZDSqgTNRcB8ezD6cRvfuVFqg2S4TaLKo6bw11SD3QhGRPGeMU4JdChsMrq4ASryr"}'::jsonb,
  NOW(),
  NOW()
);

-- 🚀 Agent Beta
INSERT INTO "TradingAgent" (
  "id", "userId", "archetypeId", "name", "status", "config", "createdAt", "updatedAt"
) VALUES (
  'obs_d5e20717b2f7a46d',
  'FJJ2fhgGpykpSYQ3gmQVeqc3ed43bNxiLyzRtneXLhU',
  'observer',
  'Agent Beta',
  'ACTIVE',
  '{"persona":"Momentum Trader","strategy":"Aggressive, loves volatility and quick flips","focusAreas":["price_momentum","volume_spikes","social_sentiment","trend_following"],"emoji":"🚀","traits":["aggressive","hype-driven","fast-moving"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"4QL8TuEvUWpoGqw9UihyVk2jUD6QFZrjkK3Nwq7XJVmrgJQVNR1BKfeSQJ7xC7TWwupUak3pYv2TpYmoQaLe3RK4"}'::jsonb,
  NOW(),
  NOW()
);

-- 📊 Agent Gamma
INSERT INTO "TradingAgent" (
  "id", "userId", "archetypeId", "name", "status", "config", "createdAt", "updatedAt"
) VALUES (
  'obs_f235dbdc98f3a578',
  '8g1DmwCVhMEbQk4ugvCTdfjjf4fCXddYdkAiS66PSmrH',
  'observer',
  'Agent Gamma',
  'ACTIVE',
  '{"persona":"Data Scientist","strategy":"Pure numbers, statistical analysis and patterns","focusAreas":["historical_patterns","correlation","volatility","probability"],"emoji":"📊","traits":["analytical","data-driven","mathematical"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"5M2wiEz9fvUBwgh9YXyVWVFNYCQSM6ew9VSJcBcd926m8UvaLJt5W2Wpf3uVrWbFhFkyjzFDtWtWCg1r9URz6fJy"}'::jsonb,
  NOW(),
  NOW()
);

-- 🔍 Agent Delta
INSERT INTO "TradingAgent" (
  "id", "userId", "archetypeId", "name", "status", "config", "createdAt", "updatedAt"
) VALUES (
  'obs_b66d4c1a7ee58537',
  'DehG5EPJSgFFeEV6hgBvvDx6JG68sdvTm4tKa9dMLJzC',
  'observer',
  'Agent Delta',
  'ACTIVE',
  '{"persona":"Contrarian","strategy":"Devil''s advocate, questions hype, finds red flags","focusAreas":["contract_analysis","team_verification","scam_detection","fud"],"emoji":"🔍","traits":["skeptical","cautious","critical"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"H1yQF7obdgPRWogbTqyH7aKzo2A8QRjpkQyTQa45XDQeLhatvw39DgWRKLmHdEp53sCsvgqJf8HXDyTpeGbKBvQ"}'::jsonb,
  NOW(),
  NOW()
);

-- 🐋 Agent Epsilon
INSERT INTO "TradingAgent" (
  "id", "userId", "archetypeId", "name", "status", "config", "createdAt", "updatedAt"
) VALUES (
  'obs_b84563ff6101876e',
  'FfYEDWyQa5vKwsdd9x5GyqMS5ZBUPRd6Zyb1HL4ZruG9',
  'observer',
  'Agent Epsilon',
  'ACTIVE',
  '{"persona":"Whale Watcher","strategy":"Follows smart money and large wallet movements","focusAreas":["whale_movements","smart_wallets","connected_wallets","insider_activity"],"emoji":"🐋","traits":["social","network-focused","copycat"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"49wVoH3T5fru1eNs65MZRMNbS6Vvo9iApfM4DSQEnMhL8u767fqbgawYCUfwQSWR9ZCbBW3prjosfpDNv1WV4iVK"}'::jsonb,
  NOW(),
  NOW()
);

COMMIT;

-- ✅ Run the above SQL in Railway to create observer agents
