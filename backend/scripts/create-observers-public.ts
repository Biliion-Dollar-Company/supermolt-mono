/**
 * Create Observer Agents via Public Database Connection
 */

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'caboose.proxy.rlwy.net',
  port: 16739,
  user: 'postgres',
  password: 'GrHgoylHRBnWygCwOkovCKkmVgprCAXP',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function createObservers() {
  console.log('🚀 Connecting to Railway database...\n');

  try {
    await client.connect();
    console.log('✅ Connected!\n');

    const sql = `
      INSERT INTO "trading_agents" ("id", "userId", "archetypeId", "name", "status", "paperBalance", "config", "createdAt", "updatedAt") VALUES
      ('obs_2d699d1509105cd0', '2wXYgPnrG4k5EPrBD2SXAtWRuzgiEJP5hGJrkng1o8QU', 'observer', 'Agent Alpha', 'ACTIVE', 0, '{"persona":"Conservative Value Investor","strategy":"Risk-averse, focuses on fundamentals and liquidity","focusAreas":["holder_concentration","liquidity_depth","smart_money","risk_metrics"],"emoji":"🛡️","traits":["cautious","analytical","risk-focused"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"5t6MbHLuJ1WT9PvhvKUsURGFZDSqgTNRcB8ezD6cRvfuVFqg2S4TaLKo6bw11SD3QhGRPGeMU4JdChsMrq4ASryr"}'::jsonb, NOW(), NOW()),
      ('obs_d5e20717b2f7a46d', 'FJJ2fhgGpykpSYQ3gmQVeqc3ed43bNxiLyzRtneXLhU', 'observer', 'Agent Beta', 'ACTIVE', 0, '{"persona":"Momentum Trader","strategy":"Aggressive, loves volatility and quick flips","focusAreas":["price_momentum","volume_spikes","social_sentiment","trend_following"],"emoji":"🚀","traits":["aggressive","hype-driven","fast-moving"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"4QL8TuEvUWpoGqw9UihyVk2jUD6QFZrjkK3Nwq7XJVmrgJQVNR1BKfeSQJ7xC7TWwupUak3pYv2TpYmoQaLe3RK4"}'::jsonb, NOW(), NOW()),
      ('obs_f235dbdc98f3a578', '8g1DmwCVhMEbQk4ugvCTdfjjf4fCXddYdkAiS66PSmrH', 'observer', 'Agent Gamma', 'ACTIVE', 0, '{"persona":"Data Scientist","strategy":"Pure numbers, statistical analysis and patterns","focusAreas":["historical_patterns","correlation","volatility","probability"],"emoji":"📊","traits":["analytical","data-driven","mathematical"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"5M2wiEz9fvUBwgh9YXyVWVFNYCQSM6ew9VSJcBcd926m8UvaLJt5W2Wpf3uVrWbFhFkyjzFDtWtWCg1r9URz6fJy"}'::jsonb, NOW(), NOW()),
      ('obs_b66d4c1a7ee58537', 'DehG5EPJSgFFeEV6hgBvvDx6JG68sdvTm4tKa9dMLJzC', 'observer', 'Agent Delta', 'ACTIVE', 0, '{"persona":"Contrarian","strategy":"Devil''s advocate, questions hype, finds red flags","focusAreas":["contract_analysis","team_verification","scam_detection","fud"],"emoji":"🔍","traits":["skeptical","cautious","critical"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"H1yQF7obdgPRWogbTqyH7aKzo2A8QRjpkQyTQa45XDQeLhatvw39DgWRKLmHdEp53sCsvgqJf8HXDyTpeGbKBvQ"}'::jsonb, NOW(), NOW()),
      ('obs_b84563ff6101876e', 'FfYEDWyQa5vKwsdd9x5GyqMS5ZBUPRd6Zyb1HL4ZruG9', 'observer', 'Agent Epsilon', 'ACTIVE', 0, '{"persona":"Whale Watcher","strategy":"Follows smart money and large wallet movements","focusAreas":["whale_movements","smart_wallets","connected_wallets","insider_activity"],"emoji":"🐋","traits":["social","network-focused","copycat"],"role":"observer","observing":"9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn","secretKey":"49wVoH3T5fru1eNs65MZRMNbS6Vvo9iApfM4DSQEnMhL8u767fqbgawYCUfwQSWR9ZCbBW3prjosfpDNv1WV4iVK"}'::jsonb, NOW(), NOW())
    `;

    console.log('📝 Inserting 5 observer agents...\n');
    
    const result = await client.query(sql);
    
    console.log('✅ Successfully created 5 observer agents!\n');
    console.log('🛡️ Agent Alpha - Conservative Value Investor');
    console.log('🚀 Agent Beta - Momentum Trader');
    console.log('📊 Agent Gamma - Data Scientist');
    console.log('🔍 Agent Delta - Contrarian');
    console.log('🐋 Agent Epsilon - Whale Watcher');
    console.log('\n🎉 All agents are now active and monitoring SuperRouter!\n');
    
  } catch (error: any) {
    if (error.code === '23505') {
      console.log('ℹ️  Agents already exist in database.');
      console.log('✅ No action needed - observer system is ready!\n');
    } else {
      console.error('❌ Error creating observers:', error.message);
      throw error;
    }
  } finally {
    await client.end();
  }
}

createObservers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
