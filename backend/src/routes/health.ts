import { Hono } from 'hono';
import { checkDbConnection } from '../lib/db';
import { redis } from '../lib/redis';

const health = new Hono();

health.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
  });
});

health.get('/ready', async (c) => {
  const dbOk = await checkDbConnection();

  let redisOk = true;
  if (redis) {
    try {
      await redis.ping();
    } catch {
      redisOk = false;
    }
  }

  const allOk = dbOk && redisOk;

  return c.json(
    {
      success: allOk,
      data: {
        status: allOk ? 'ready' : 'degraded',
        services: {
          database: dbOk ? 'ok' : 'error',
          redis: redis ? (redisOk ? 'ok' : 'error') : 'disabled',
        },
      },
    },
    allOk ? 200 : 503
  );
});

// Temporary setup endpoint (no auth required) - REMOVE AFTER SETUP
health.post('/setup-observers', async (c) => {
  const { db } = await import('../lib/db');

  try {
    console.log('🚀 Creating 5 Observer Agents for SuperRouter Analysis...');

    const OBSERVER_AGENTS = [
      {
        id: 'obs_2d699d1509105cd0',
        userId: '2wXYgPnrG4k5EPrBD2SXAtWRuzgiEJP5hGJrkng1o8QU',
        name: 'Agent Alpha',
        persona: 'Conservative Value Investor',
        strategy: 'Risk-averse, focuses on fundamentals and liquidity',
        focusAreas: ['holder_concentration', 'liquidity_depth', 'smart_money', 'risk_metrics'],
        emoji: '🛡️',
        traits: ['cautious', 'analytical', 'risk-focused'],
        secretKey: '5t6MbHLuJ1WT9PvhvKUsURGFZDSqgTNRcB8ezD6cRvfuVFqg2S4TaLKo6bw11SD3QhGRPGeMU4JdChsMrq4ASryr'
      },
      {
        id: 'obs_d5e20717b2f7a46d',
        userId: 'FJJ2fhgGpykpSYQ3gmQVeqc3ed43bNxiLyzRtneXLhU',
        name: 'Agent Beta',
        persona: 'Momentum Trader',
        strategy: 'Aggressive, loves volatility and quick flips',
        focusAreas: ['price_momentum', 'volume_spikes', 'social_sentiment', 'trend_following'],
        emoji: '🚀',
        traits: ['aggressive', 'hype-driven', 'fast-moving'],
        secretKey: '4QL8TuEvUWpoGqw9UihyVk2jUD6QFZrjkK3Nwq7XJVmrgJQVNR1BKfeSQJ7xC7TWwupUak3pYv2TpYmoQaLe3RK4'
      },
      {
        id: 'obs_f235dbdc98f3a578',
        userId: '8g1DmwCVhMEbQk4ugvCTdfjjf4fCXddYdkAiS66PSmrH',
        name: 'Agent Gamma',
        persona: 'Data Scientist',
        strategy: 'Pure numbers, statistical analysis and patterns',
        focusAreas: ['historical_patterns', 'correlation', 'volatility', 'probability'],
        emoji: '📊',
        traits: ['analytical', 'data-driven', 'mathematical'],
        secretKey: '5M2wiEz9fvUBwgh9YXyVWVFNYCQSM6ew9VSJcBcd926m8UvaLJt5W2Wpf3uVrWbFhFkyjzFDtWtWCg1r9URz6fJy'
      },
      {
        id: 'obs_b66d4c1a7ee58537',
        userId: 'DehG5EPJSgFFeEV6hgBvvDx6JG68sdvTm4tKa9dMLJzC',
        name: 'Agent Delta',
        persona: 'Contrarian',
        strategy: "Devil's advocate, questions hype, finds red flags",
        focusAreas: ['contract_analysis', 'team_verification', 'scam_detection', 'fud'],
        emoji: '🔍',
        traits: ['skeptical', 'cautious', 'critical'],
        secretKey: 'H1yQF7obdgPRWogbTqyH7aKzo2A8QRjpkQyTQa45XDQeLhatvw39DgWRKLmHdEp53sCsvgqJf8HXDyTpeGbKBvQ'
      },
      {
        id: 'obs_b84563ff6101876e',
        userId: 'FfYEDWyQa5vKwsdd9x5GyqMS5ZBUPRd6Zyb1HL4ZruG9',
        name: 'Agent Epsilon',
        persona: 'Whale Watcher',
        strategy: 'Follows smart money and large wallet movements',
        focusAreas: ['whale_movements', 'smart_wallets', 'connected_wallets', 'insider_activity'],
        emoji: '🐋',
        traits: ['social', 'network-focused', 'copycat'],
        secretKey: '49wVoH3T5fru1eNs65MZRMNbS6Vvo9iApfM4DSQEnMhL8u767fqbgawYCUfwQSWR9ZCbBW3prjosfpDNv1WV4iVK'
      }
    ];

    const createdAgents = [];
    const skippedAgents = [];

    for (const agentData of OBSERVER_AGENTS) {
      const existing = await db.tradingAgent.findUnique({
        where: { id: agentData.id }
      });

      if (existing) {
        console.log(`⚠️  ${agentData.emoji} ${agentData.name} already exists`);
        skippedAgents.push(agentData.name);
        continue;
      }

      const agent = await db.tradingAgent.create({
        data: {
          id: agentData.id,
          userId: agentData.userId,
          archetypeId: 'observer',
          name: agentData.name,
          status: 'ACTIVE',
          paperBalance: 0,
          config: {
            persona: agentData.persona,
            strategy: agentData.strategy,
            focusAreas: agentData.focusAreas,
            emoji: agentData.emoji,
            traits: agentData.traits,
            role: 'observer',
            observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
            secretKey: agentData.secretKey
          }
        }
      });

      console.log(`✅ Created ${agentData.emoji} ${agentData.name}`);
      createdAgents.push(agent);
    }

    const allObservers = await db.tradingAgent.findMany({
      where: { archetypeId: 'observer' },
      select: {
        id: true,
        name: true,
        status: true,
        config: true
      }
    });

    console.log(`✅ Observer agents setup complete! Created: ${createdAgents.length}, Skipped: ${skippedAgents.length}`);

    return c.json({
      success: true,
      data: {
        created: createdAgents.length,
        skipped: skippedAgents.length,
        skippedNames: skippedAgents,
        agents: allObservers
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create observer agents';
    console.error('Create observer agents error:', error);
    return c.json(
      { success: false, error: { code: 'SETUP_ERROR', message } },
      500
    );
  }
});

export { health };
