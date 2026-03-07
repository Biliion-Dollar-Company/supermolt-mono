/**
 * Swarm Routes — REST API for the Polymarket Prediction Swarm
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  getSwarmStatus,
  runSwarmScan,
  getSwarmHistory,
  getAgentPerformance,
  analyzeSignal,
} from '../services/swarm/swarm.service';
import { MarketSignal } from '../services/swarm/swarm.types';

const swarmRoutes = new Hono();

// GET /swarm/status — Swarm health + agent roster
swarmRoutes.get('/status', async (c) => {
  try {
    const status = await getSwarmStatus();
    return c.json({ success: true, data: status });
  } catch (error) {
    console.error('[Swarm] GET /status error:', error);
    return c.json({ success: false, error: 'Failed to fetch swarm status' }, 500);
  }
});

// POST /swarm/scan — Trigger manual scan
const scanSchema = z.object({
  dryRun: z.boolean().default(true),
  marketIds: z.array(z.string()).optional(),
});

swarmRoutes.post('/scan', async (c) => {
  try {
    const body = scanSchema.parse(await c.req.json());
    const results = await runSwarmScan({
      dryRun: body.dryRun,
      marketIds: body.marketIds,
    });

    return c.json({
      success: true,
      data: {
        scanned: results.length,
        traded: results.filter((r) => r.executed).length,
        noTrade: results.filter((r) => r.decision.consensus === 'NO_TRADE').length,
        results: results.map((r) => ({
          marketId: r.decision.marketId,
          question: r.decision.question,
          consensus: r.decision.consensus,
          confidence: r.decision.confidence,
          executed: r.executed,
          votes: r.decision.votes.map((v) => ({
            agentId: v.agentId,
            vote: v.vote,
            confidence: v.confidence,
            reasoning: v.reasoning,
          })),
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Invalid request body', details: error.errors }, 400);
    }
    console.error('[Swarm] POST /scan error:', error);
    return c.json({ success: false, error: 'Scan failed' }, 500);
  }
});

// GET /swarm/decisions — Last 50 decisions with vote breakdown
swarmRoutes.get('/decisions', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const decisions = await getSwarmHistory(limit);

    return c.json({
      success: true,
      data: decisions,
      count: decisions.length,
    });
  } catch (error) {
    console.error('[Swarm] GET /decisions error:', error);
    return c.json({ success: false, error: 'Failed to fetch decisions' }, 500);
  }
});

// GET /swarm/agents — Per-agent performance stats
swarmRoutes.get('/agents', async (c) => {
  try {
    const agents = await getAgentPerformance();
    return c.json({ success: true, data: agents });
  } catch (error) {
    console.error('[Swarm] GET /agents error:', error);
    return c.json({ success: false, error: 'Failed to fetch agent stats' }, 500);
  }
});

// POST /swarm/analyze — Analyze a single market
const analyzeSchema = z.object({
  marketId: z.string(),
  question: z.string(),
  yesPrice: z.number().min(0).max(1),
  noPrice: z.number().min(0).max(1),
  category: z.string().default('Unknown'),
  endDate: z.string().transform((s) => new Date(s)),
  volume: z.number().optional(),
  liquidity: z.number().optional(),
});

swarmRoutes.post('/analyze', async (c) => {
  try {
    const body = analyzeSchema.parse(await c.req.json());

    const signal: MarketSignal = {
      marketId: body.marketId,
      question: body.question,
      yesPrice: body.yesPrice,
      noPrice: body.noPrice,
      combinedPrice: body.yesPrice + body.noPrice,
      category: body.category,
      endDate: body.endDate,
      volume: body.volume,
      liquidity: body.liquidity,
    };

    const result = await analyzeSignal(signal);

    return c.json({
      success: true,
      data: {
        marketId: result.decision.marketId,
        consensus: result.decision.consensus,
        confidence: result.decision.confidence,
        votes: result.decision.votes.map((v) => ({
          agentId: v.agentId,
          vote: v.vote,
          confidence: v.confidence,
          reasoning: v.reasoning,
        })),
        timestamp: result.decision.timestamp,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Invalid market signal', details: error.errors }, 400);
    }
    console.error('[Swarm] POST /analyze error:', error);
    return c.json({ success: false, error: 'Analysis failed' }, 500);
  }
});

export default swarmRoutes;
