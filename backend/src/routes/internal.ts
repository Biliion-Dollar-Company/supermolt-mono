import { Hono } from 'hono';
import { z } from 'zod';
import { internalAuthMiddleware } from '../middleware/internal';
import * as tradeService from '../services/trade.service';
import { createSortinoService } from '../services/sortino.service';
import { treasuryManager } from '../services/treasury-manager.service';
import { db } from '../lib/db';
import { analyzeSuperRouterTrade } from '../services/agent-analyzer';
import { fetchTokenMetrics, analyzeSmartMoneyFlow } from '../services/token-data.service';
import { getTwitterAPI } from '../services/twitter-api.service';

const internal = new Hono();
const sortinoService = createSortinoService(db);

// All internal routes require API key
internal.use('*', internalAuthMiddleware);

const createTradeSchema = z.object({
  agentId: z.string().min(1),
  tokenMint: z.string().min(1),
  tokenSymbol: z.string().min(1),
  tokenName: z.string().min(1),
  action: z.enum(['BUY', 'SELL']),
  entryPrice: z.number().positive(),
  amount: z.number().positive(),
  tokenAmount: z.number().positive().optional(),
  signalSource: z.string().min(1),
  confidence: z.number().int().min(0).max(100),
  marketCap: z.number().positive().optional(),
  liquidity: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const closeTradeSchema = z.object({
  tradeId: z.string().min(1),
  exitPrice: z.number().positive(),
  pnl: z.number(),
  pnlPercent: z.number(),
});

const narrativeAnalyzeSchema = z.object({
  tokenMint: z.string().min(1),
  tokenSymbol: z.string().optional(),
  tokenName: z.string().optional(),
  action: z.enum(['BUY', 'SELL']).default('BUY'),
  amount: z.number().positive().default(1),
  includeSocial: z.boolean().optional(),
  metrics: z.object({
    holders: z.number().optional(),
    liquidity: z.number().optional(),
    volume24h: z.number().optional(),
    priceChange24h: z.number().optional(),
    marketCap: z.number().optional(),
    smartMoneyFlow: z.enum(['IN', 'OUT', 'NEUTRAL']).optional(),
    recentTweets: z.array(z.string()).optional(),
    tweetCount: z.number().optional(),
  }).optional(),
});

// POST /internal/trades — DevPrint creates a paper trade
internal.post('/trades', async (c) => {
  try {
    const body = await c.req.json();
    const input = createTradeSchema.parse(body);

    const trade = await tradeService.createPaperTrade(input);

    return c.json({ success: true, data: trade }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to create trade';
    console.error('Internal create trade error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/trades/close — DevPrint closes a paper trade
internal.post('/trades/close', async (c) => {
  try {
    const body = await c.req.json();
    const input = closeTradeSchema.parse(body);

    const trade = await tradeService.closePaperTrade(input);

    return c.json({ success: true, data: trade });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to close trade';
    console.error('Internal close trade error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/narrative/analyze — Debug narrative analysis with live LLM
internal.post('/narrative/analyze', async (c) => {
  try {
    const body = await c.req.json();
    const input = narrativeAnalyzeSchema.parse(body);

    const tokenMetrics = await fetchTokenMetrics(input.tokenMint);
    const mergedMetrics = {
      ...tokenMetrics,
      ...input.metrics,
    };
    if (!mergedMetrics.smartMoneyFlow) {
      mergedMetrics.smartMoneyFlow = analyzeSmartMoneyFlow(mergedMetrics);
    }

    if (input.includeSocial) {
      try {
        const twitter = getTwitterAPI();
        const symbol = input.tokenSymbol || '';
        const name = input.tokenName || '';
        if (symbol && symbol.length > 2) {
          const queryParts = [`$${symbol}`, '-is:retweet'];
          if (name && name.length > 2) {
            queryParts.push(`"${name}"`);
          }
          const query = queryParts.join(' ');
          const tweets = await twitter.searchTweets(query, 8);
          if (tweets.length > 0) {
            mergedMetrics.recentTweets = Array.from(new Set(tweets.map(t => t.text))).slice(0, 5);
            mergedMetrics.tweetCount = tweets.length;
          }
        }
      } catch {
        // Ignore social failures
      }
    }

    const analyses = await analyzeSuperRouterTrade(
      {
        signature: 'internal-debug',
        walletAddress: 'internal',
        tokenMint: input.tokenMint,
        tokenSymbol: input.tokenSymbol,
        tokenName: input.tokenName,
        action: input.action,
        amount: input.amount,
        timestamp: new Date(),
      },
      mergedMetrics
    );

    return c.json({ success: true, data: analyses });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to analyze narrative';
    console.error('Internal narrative analyze error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/leaderboard/recalculate — Recalculate all Sortino ratios
internal.post('/leaderboard/recalculate', async (c) => {
  try {
    console.log('🔄 Starting Sortino recalculation...');
    const startTime = Date.now();

    await sortinoService.calculateAllAgents();

    const duration = Date.now() - startTime;
    console.log(`✅ Recalculation complete in ${duration}ms`);

    return c.json({
      success: true,
      data: {
        message: 'Sortino ratios recalculated',
        duration: `${duration}ms`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to recalculate';
    console.error('Recalculation error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/agents/create-observers — Create 5 observer agents
internal.post('/agents/create-observers', async (c) => {
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
      // Check if agent already exists
      const existing = await db.tradingAgent.findUnique({
        where: { id: agentData.id }
      });

      if (existing) {
        console.log(`⚠️  ${agentData.emoji} ${agentData.name} already exists`);
        skippedAgents.push(agentData.name);
        continue;
      }

      // Create the agent
      const agent = await db.tradingAgent.create({
        data: {
          id: agentData.id,
          userId: agentData.userId,
          archetypeId: 'observer',
          name: agentData.name,
          status: 'ACTIVE',
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

    // Get all observer agents
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
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/agents/create-two-more — Create agents 6 & 7
internal.post('/agents/create-two-more', async (c) => {
  try {
    console.log('🚀 Creating Agents #6 and #7...');

    const NEW_AGENTS = [
      {
        id: 'obs_6a9f8e2c1d5b4a3f',
        userId: 'AFKqWBiPYstDy2zNqVWNNG9JXmKLtq2XmJ8XEnhQsEpT',
        name: 'Agent Zeta',
        persona: 'Technical Analyst',
        strategy: 'Charts, indicators, and price action patterns',
        focusAreas: ['support_resistance', 'fibonacci', 'rsi', 'macd', 'chart_patterns'],
        emoji: '📈',
        traits: ['technical', 'chart-focused', 'pattern-recognition'],
        secretKey: 'n3FT19SBKhdh91NUXBjk54DBsiSu176s14zuf1ZpaAbZjRADJbYPJyVj6YJGLrXsemUaK3d6p4Edmq3LdTonp2P'
      },
      {
        id: 'obs_7b8c9d3e2f6g5h4i',
        userId: 'AQbvJQYc5T3JwQ5Gx1VTcA1rP6nXnCux65PGaNAftiPv',
        name: 'Agent Theta',
        persona: 'Sentiment Tracker',
        strategy: 'Social media, community vibes, and narrative strength',
        focusAreas: ['twitter_sentiment', 'telegram_activity', 'narrative', 'community_strength'],
        emoji: '🧠',
        traits: ['social', 'sentiment-driven', 'community-focused'],
        secretKey: '2h5VvFiXMnYdatVbrzq5ZybFDF1omo6iiBYeWkrzeqb2QjaC88hteGocqs9ngThdAmsJKgQ1MWiyjw4Tuh6LDrtC'
      }
    ];

    const createdAgents = [];
    const skippedAgents = [];

    for (const agentData of NEW_AGENTS) {
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
      select: { id: true, name: true, status: true, config: true }
    });

    console.log(`✅ Complete! Created: ${createdAgents.length}, Total: ${allObservers.length}`);

    return c.json({
      success: true,
      data: {
        created: createdAgents.length,
        skipped: skippedAgents.length,
        totalObservers: allObservers.length,
        agents: allObservers
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create agents';
    console.error('Create agents error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/epoch/distribute — Execute USDC distribution to TradingAgents
internal.post('/epoch/distribute', async (c) => {
  try {
    const body = await c.req.json();
    const { epochId } = z.object({ epochId: z.string().min(1) }).parse(body);

    console.log(`💰 Starting USDC distribution for epoch ${epochId}...`);
    const startTime = Date.now();

    const result = await treasuryManager.distributeAgentRewards(epochId);

    const duration = Date.now() - startTime;
    console.log(`✅ Distribution complete in ${duration}ms — ${result.summary.successful} succeeded, ${result.summary.failed} failed`);

    return c.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to distribute rewards';
    console.error('Distribution error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/cleanup/purge-non-superrouter — Delete all fake data for non-SR agents
internal.post('/cleanup/purge-non-superrouter', async (c) => {
  try {
    console.log('🧹 Starting purge of non-SuperRouter agent data...');

    const KEEP_IDS = [
      'cml7389hz0000qu01djafchsn',  // SuperRouter
      'obs_2d699d1509105cd0',        // Alpha
      'obs_d5e20717b2f7a46d',        // Beta
      'obs_f235dbdc98f3a578',        // Gamma
      'obs_b66d4c1a7ee58537',        // Delta
      'obs_b84563ff6101876e',        // Epsilon
      'obs_6a9f8e2c1d5b4a3f',        // Zeta
      'obs_7b8c9d3e2f6g5h4i',        // Theta
    ];

    // Count before
    const totalAgentsBefore = await db.tradingAgent.count();
    const keepCount = await db.tradingAgent.count({ where: { id: { in: KEEP_IDS } } });

    // 1. Delete AgentStats for non-preserved agents
    const deletedStats = await db.agentStats.deleteMany({
      where: { agentId: { notIn: KEEP_IDS } },
    });
    console.log(`  Deleted ${deletedStats.count} AgentStats`);

    // 2. Delete AgentPositions for non-preserved agents
    const deletedPositions = await db.agentPosition.deleteMany({
      where: { agentId: { notIn: KEEP_IDS } },
    });
    console.log(`  Deleted ${deletedPositions.count} AgentPositions`);

    // 3. Delete AgentTrades for non-preserved agents
    const deletedAgentTrades = await db.agentTrade.deleteMany({
      where: { agentId: { notIn: KEEP_IDS } },
    });
    console.log(`  Deleted ${deletedAgentTrades.count} AgentTrades`);

    // 4. Delete TradingAgent records (cascades PaperTrade + TradeFeedback)
    const deletedAgents = await db.tradingAgent.deleteMany({
      where: { id: { notIn: KEEP_IDS } },
    });
    console.log(`  Deleted ${deletedAgents.count} TradingAgents (+ cascaded PaperTrades & Feedback)`);

    // Count after
    const totalAgentsAfter = await db.tradingAgent.count();
    const remainingPositions = await db.agentPosition.count();
    const remainingTrades = await db.agentTrade.count();

    const summary = {
      before: { totalAgents: totalAgentsBefore, preserved: keepCount },
      deleted: {
        agentStats: deletedStats.count,
        agentPositions: deletedPositions.count,
        agentTrades: deletedAgentTrades.count,
        tradingAgents: deletedAgents.count,
      },
      after: {
        totalAgents: totalAgentsAfter,
        remainingPositions,
        remainingTrades,
      },
    };

    console.log('🧹 Purge complete:', JSON.stringify(summary, null, 2));
    return c.json({ success: true, data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to purge data';
    console.error('Purge error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

/**
 * POST /internal/test-agent-reactor
 * Manually fire the agent signal reactor with a test event.
 * Useful for verifying the LLM pipeline is working.
 */
internal.post('/test-agent-reactor', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const eventType = body.eventType || 'signal_detected';
    const testData = {
      tokenMint: body.tokenMint || 'So11111111111111111111111111111111111111112',
      tokenSymbol: body.tokenSymbol || 'TEST',
      liquidity: body.liquidity || 500000,
      volume24h: body.volume24h || 2000000,
      priceChange24h: body.priceChange24h || 12.5,
      marketCap: body.marketCap || 5000000,
      reason: body.reason || 'Manual test trigger',
      type: eventType,
    };

    const { agentSignalReactor } = await import('../services/agent-signal-reactor.js');
    await agentSignalReactor.react(eventType, testData);

    return c.json({ success: true, data: { message: 'Reactor triggered', eventType, tokenMint: testData.tokenMint } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to trigger reactor';
    console.error('Test reactor error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

export { internal };
