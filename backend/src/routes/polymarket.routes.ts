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

    const markets = await db.predictionMarket.findMany({
      where: {
        platform: 'POLYMARKET',
        status: 'open',
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

// ── Authenticated Routes ────────────────────────────────

// POST /polymarket/signals — Share a market signal
polymarketRoutes.post('/signals', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
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
        market: prediction.market,
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

export default polymarketRoutes;
