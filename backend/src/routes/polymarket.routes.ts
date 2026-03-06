/**
 * Polymarket Routes
 * 
 * Endpoints for browsing Polymarket markets and sharing signals
 */

import { Hono } from 'hono';
import { Context, Next } from 'hono';
import * as jose from 'jose';
import { z } from 'zod';
import { db } from '../lib/db';
import { polymarketSyncService } from '../services/polymarket/polymarket.sync';
import { polymarketArbScanner } from '../services/polymarket/polymarket.arb-scanner';
import { polymarketLatencyScanner } from '../services/polymarket/polymarket.latency-scanner';
import { polymarketWeatherScanner } from '../services/polymarket/polymarket.weather-scanner';

const polymarketRoutes = new Hono();
const JWT_SECRET = process.env.JWT_SECRET;

// ── JWT Auth Middleware ──────────────────────────────────

async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Authorization required' }, 401);
  }

  if (!JWT_SECRET) {
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    const token = authHeader.slice(7);
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    if (payload.type !== 'agent') {
      return c.json({ success: false, error: 'Invalid token type' }, 401);
    }
    c.set('agentId', payload.agentId as string);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
}

// ── Validation Schemas ──────────────────────────────────

const signalSchema = z.object({
  marketId: z.string(),
  side: z.enum(['YES', 'NO']),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().max(2000).optional(),
  entryPrice: z.number().min(0).max(1).optional(),
  contracts: z.number().int().min(1).max(1000).default(1),
});

// ── Public Routes ───────────────────────────────────────

// GET /polymarket/markets — Browse Polymarket markets
polymarketRoutes.get('/markets', async (c) => {
  try {
    const category = c.req.query('category');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const daysAhead = parseInt(c.req.query('daysAhead') || '30');
    
    // Calculate cutoff date (now + N days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const markets = await db.predictionMarket.findMany({
      where: {
        platform: 'POLYMARKET',
        status: 'open',
        expiresAt: {
          lte: cutoffDate, // Only markets closing within N days
        },
        ...(category ? { category } : {}),
      },
      orderBy: { volume: 'desc' },
      take: limit,
    });

    return c.json({
      success: true,
      data: markets.map(m => ({
        id: m.id,
        externalId: m.externalId,
        title: m.title,
        category: m.category,
        yesPrice: Number(m.yesPrice),
        noPrice: Number(m.noPrice),
        volume: Number(m.volume),
        status: m.status,
        expiresAt: m.expiresAt.toISOString(),
        metadata: m.metadata,
      })),
      count: markets.length,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error: any) {
    console.error('[Polymarket] GET /markets error:', error);
    return c.json({ success: false, error: 'Failed to fetch markets' }, 500);
  }
});

// GET /polymarket/markets/:id — Single market detail
polymarketRoutes.get('/markets/:id', async (c) => {
  try {
    const marketId = c.req.param('id');

    const market = await db.predictionMarket.findUnique({
      where: { id: marketId },
      include: {
        predictions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!market || market.platform !== 'POLYMARKET') {
      return c.json({ success: false, error: 'Market not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...market,
        yesPrice: Number(market.yesPrice),
        noPrice: Number(market.noPrice),
        volume: Number(market.volume),
      },
    });
  } catch (error: any) {
    console.error('[Polymarket] GET /markets/:id error:', error);
    return c.json({ success: false, error: 'Failed to fetch market' }, 500);
  }
});

// GET /polymarket/signals — List recent signals
polymarketRoutes.get('/signals', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

    const signals = await db.agentPrediction.findMany({
      where: {
        market: {
          platform: 'POLYMARKET',
        },
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            category: true,
            yesPrice: true,
            noPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return c.json({
      success: true,
      data: signals.map(s => ({
        id: s.id,
        agentId: s.agentId,
        market: s.market,
        side: s.side,
        confidence: s.confidence,
        reasoning: s.reasoning,
        avgPrice: Number(s.avgPrice),
        contracts: s.contracts,
        createdAt: s.createdAt.toISOString(),
      })),
      count: signals.length,
    });
  } catch (error: any) {
    console.error('[Polymarket] GET /signals error:', error);
    return c.json({ success: false, error: 'Failed to fetch signals' }, 500);
  }
});

// GET /polymarket/sync/status — Sync status
polymarketRoutes.get('/sync/status', async (c) => {
  const stats = polymarketSyncService.getStats();
  
  return c.json({
    success: true,
    data: stats,
  });
});

// POST /polymarket/import — Import markets from external sources (News Scanner, Jupiter API)
polymarketRoutes.post('/import', async (c) => {
  try {
    const importMarketsSchema = z.object({
      markets: z.array(z.object({
        externalId: z.string(),
        title: z.string(),
        category: z.string().optional().default('Unknown'),
        yesPrice: z.number().min(0).max(1),
        noPrice: z.number().min(0).max(1),
        volume: z.number().optional().default(0),
        expiresAt: z.string().datetime(),
        metadata: z.record(z.any()).optional().default({}),
      })),
      source: z.string().optional().default('unknown'),
    });

    const body = await c.req.json();
    const parsed = importMarketsSchema.parse(body);

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const marketData of parsed.markets) {
      try {
        // Check if market already exists
        const existing = await db.predictionMarket.findUnique({
          where: {
            platform_externalId: {
              platform: 'POLYMARKET',
              externalId: marketData.externalId,
            },
          },
        });

        if (existing) {
          // Update prices and volume
          await db.predictionMarket.update({
            where: { id: existing.id },
            data: {
              yesPrice: marketData.yesPrice,
              noPrice: marketData.noPrice,
              volume: marketData.volume,
              updatedAt: new Date(),
            },
          });
          results.updated++;
        } else {
          // Create new market
          await db.predictionMarket.create({
            data: {
              platform: 'POLYMARKET',
              externalId: marketData.externalId,
              title: marketData.title,
              category: marketData.category,
              yesPrice: marketData.yesPrice,
              noPrice: marketData.noPrice,
              volume: marketData.volume,
              expiresAt: new Date(marketData.expiresAt),
              status: 'open',
              outcome: 'PENDING',
              metadata: marketData.metadata,
            },
          });
          results.created++;
        }
      } catch (err: any) {
        results.errors.push(`${marketData.externalId}: ${err.message}`);
        results.skipped++;
      }
    }

    return c.json({
      success: true,
      data: {
        source: parsed.source,
        totalProcessed: parsed.markets.length,
        ...results,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Invalid request body', details: error.errors }, 400);
    }
    console.error('[Polymarket] POST /import error:', error);
    return c.json({ success: false, error: 'Failed to import markets' }, 500);
  }
});

// ── Authenticated Routes ────────────────────────────────

// POST /polymarket/signals — Share a market signal
polymarketRoutes.post('/signals', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    if (!agentId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    const body = signalSchema.parse(await c.req.json());

    // Verify market exists
    const market = await db.predictionMarket.findUnique({
      where: { id: body.marketId },
    });

    if (!market || market.platform !== 'POLYMARKET') {
      return c.json({ success: false, error: 'Market not found' }, 404);
    }

    // Create prediction
    const avgPrice = body.entryPrice || (body.side === 'YES' ? Number(market.yesPrice) : Number(market.noPrice));
    const totalCost = avgPrice * body.contracts;

    const prediction = await db.agentPrediction.create({
      data: {
        agentId,
        marketId: body.marketId,
        side: body.side,
        confidence: body.confidence,
        reasoning: body.reasoning,
        contracts: body.contracts,
        avgPrice,
        totalCost,
        outcome: 'PENDING',
        realOrder: false, // Paper trading for now
      },
      include: {
        market: true,
      },
    });

    // Update prediction stats
    await db.predictionStats.upsert({
      where: { agentId },
      create: {
        agentId,
        totalPredictions: 1,
        totalCost,
      },
      update: {
        totalPredictions: { increment: 1 },
        totalCost: { increment: totalCost },
      },
    });

    // TODO: Post to feed (implement feed service integration)
    console.log(`[Polymarket] Signal created: ${agentId} → ${body.side} on "${market.title}"`);

    return c.json({
      success: true,
      data: {
        id: prediction.id,
        market,
        side: prediction.side,
        confidence: prediction.confidence,
        reasoning: prediction.reasoning,
        avgPrice: Number(prediction.avgPrice),
        contracts: prediction.contracts,
        createdAt: prediction.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Invalid request body', details: error.errors }, 400);
    }
    console.error('[Polymarket] POST /signals error:', error);
    return c.json({ success: false, error: 'Failed to create signal' }, 500);
  }
});

// GET /polymarket/my-signals — Get agent's own signals
polymarketRoutes.get('/my-signals', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

    const signals = await db.agentPrediction.findMany({
      where: {
        agentId,
        market: {
          platform: 'POLYMARKET',
        },
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            category: true,
            yesPrice: true,
            noPrice: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return c.json({
      success: true,
      data: signals,
      count: signals.length,
    });
  } catch (error: any) {
    console.error('[Polymarket] GET /my-signals error:', error);
    return c.json({ success: false, error: 'Failed to fetch signals' }, 500);
  }
});

// ── Arb Scanner Routes ──────────────────────────────────

// GET /polymarket/arb/stats — Scanner statistics
polymarketRoutes.get('/arb/stats', (c) => {
  return c.json({ success: true, data: polymarketArbScanner.getStats() });
});

// GET /polymarket/arb/opportunities — Recent arb opportunities
polymarketRoutes.get('/arb/opportunities', async (c) => {
  try {
    const opportunities = await db.agentPrediction.findMany({
      where: { agentId: 'arb-scanner' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { market: true },
    });

    return c.json({ success: true, data: opportunities, count: opportunities.length });
  } catch (error: any) {
    console.error('[Polymarket] GET /arb/opportunities error:', error);
    return c.json({ success: false, error: 'Failed to fetch arb opportunities' }, 500);
  }
});

// ── Latency Scanner Routes ──────────────────────────────

// GET /polymarket/latency/stats — Latency scanner statistics
polymarketRoutes.get('/latency/stats', (c) => {
  return c.json({ success: true, data: polymarketLatencyScanner.getStats() });
});

// GET /polymarket/latency/opportunities — Recent latency arb opportunities
polymarketRoutes.get('/latency/opportunities', async (c) => {
  try {
    const opportunities = await db.agentPrediction.findMany({
      where: { agentId: 'latency-scanner' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { market: true },
    });

    return c.json({ success: true, data: opportunities, count: opportunities.length });
  } catch (error: any) {
    console.error('[Polymarket] GET /latency/opportunities error:', error);
    return c.json({ success: false, error: 'Failed to fetch latency opportunities' }, 500);
  }
});

// ── Weather Scanner Routes ────────────────────────────────

// GET /polymarket/weather/stats — Weather scanner statistics
polymarketRoutes.get('/weather/stats', (c) => {
  return c.json({ success: true, data: polymarketWeatherScanner.getStats() });
});

// GET /polymarket/weather/opportunities — Recent weather arb opportunities
polymarketRoutes.get('/weather/opportunities', async (c) => {
  try {
    const opportunities = await db.agentPrediction.findMany({
      where: { agentId: 'weather-scanner' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { market: true },
    });

    return c.json({ success: true, data: opportunities, count: opportunities.length });
  } catch (error: any) {
    console.error('[Polymarket] GET /weather/opportunities error:', error);
    return c.json({ success: false, error: 'Failed to fetch weather opportunities' }, 500);
  }
});

export default polymarketRoutes;
