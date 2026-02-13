/**
 * Prediction Market Routes
 *
 * Browse markets, place predictions, view leaderboard.
 * Public endpoints work without Kalshi API key.
 * Order placement requires authentication + Kalshi key.
 */

import { Hono } from 'hono';
import { Context, Next } from 'hono';
import * as jose from 'jose';
import { z } from 'zod';
import { db } from '../lib/db';
import { getKalshiService } from '../services/kalshi.service';
import { calculateLevel } from '../services/onboarding.service';

const predictionRoutes = new Hono();
const JWT_SECRET = process.env.JWT_SECRET;
const XP_PREDICTION_PLACED = 25;

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

const predictSchema = z.object({
  side: z.enum(['YES', 'NO']),
  contracts: z.number().int().min(1).max(1000).default(1),
  confidence: z.number().int().min(0).max(100).optional(),
  reasoning: z.string().max(2000).optional(),
  placeRealOrder: z.boolean().default(false),
});

// ── Public Routes ───────────────────────────────────────

// GET /prediction/markets — Browse markets
predictionRoutes.get('/markets', async (c) => {
  try {
    const category = c.req.query('category');
    const status = c.req.query('status') as 'open' | 'closed' | 'settled' | undefined;
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);

    const markets = await db.predictionMarket.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { volume: 'desc' },
      take: limit,
    });

    return c.json({
      success: true,
      data: markets.map(m => ({
        id: m.id,
        platform: m.platform,
        ticker: m.externalId,
        title: m.title,
        category: m.category,
        subtitle: m.subtitle,
        yesPrice: Number(m.yesPrice),
        noPrice: Number(m.noPrice),
        volume: Number(m.volume),
        outcome: m.outcome,
        status: m.status,
        expiresAt: m.expiresAt.toISOString(),
        closesAt: m.closesAt?.toISOString(),
      })),
      count: markets.length,
    });
  } catch (error: any) {
    console.error('[Prediction] GET /markets error:', error);
    return c.json({ success: false, error: 'Failed to fetch markets' }, 500);
  }
});

// GET /prediction/markets/:ticker — Single market detail
predictionRoutes.get('/markets/:ticker', async (c) => {
  try {
    const ticker = c.req.param('ticker');
    const market = await db.predictionMarket.findFirst({
      where: { externalId: ticker },
    });

    if (!market) {
      // Try fetching from Kalshi directly
      const kalshi = getKalshiService();
      const live = await kalshi.getMarket(ticker);
      if (!live) {
        return c.json({ success: false, error: 'Market not found' }, 404);
      }
      return c.json({ success: true, data: live });
    }

    const predictionCount = await db.agentPrediction.count({
      where: { marketId: market.id },
    });

    return c.json({
      success: true,
      data: {
        id: market.id,
        platform: market.platform,
        ticker: market.externalId,
        title: market.title,
        category: market.category,
        subtitle: market.subtitle,
        yesPrice: Number(market.yesPrice),
        noPrice: Number(market.noPrice),
        volume: Number(market.volume),
        outcome: market.outcome,
        status: market.status,
        expiresAt: market.expiresAt.toISOString(),
        closesAt: market.closesAt?.toISOString(),
        metadata: market.metadata,
        predictionCount,
      },
    });
  } catch (error: any) {
    console.error('[Prediction] GET /markets/:ticker error:', error);
    return c.json({ success: false, error: 'Failed to fetch market' }, 500);
  }
});

// GET /prediction/markets/:ticker/orderbook — Live orderbook
predictionRoutes.get('/markets/:ticker/orderbook', async (c) => {
  try {
    const ticker = c.req.param('ticker');
    const kalshi = getKalshiService();
    const orderbook = await kalshi.getOrderbook(ticker);

    if (!orderbook) {
      return c.json({ success: false, error: 'Orderbook not available' }, 404);
    }

    return c.json({ success: true, data: orderbook });
  } catch (error: any) {
    console.error('[Prediction] GET /orderbook error:', error);
    return c.json({ success: false, error: 'Failed to fetch orderbook' }, 500);
  }
});

// GET /prediction/leaderboard — Top agents by prediction accuracy
predictionRoutes.get('/leaderboard', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '25'), 100);
    const minPredictions = parseInt(c.req.query('min') || '3');

    const stats = await db.predictionStats.findMany({
      where: {
        totalPredictions: { gte: minPredictions },
      },
      orderBy: [
        { accuracy: 'desc' },
        { brierScore: 'asc' },
        { totalPredictions: 'desc' },
      ],
      take: limit,
    });

    // Resolve agent names
    const agentIds = stats.map(s => s.agentId);
    const agents = await db.tradingAgent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, displayName: true, avatarUrl: true },
    });
    const agentMap = new Map(agents.map(a => [a.id, a]));

    return c.json({
      success: true,
      data: stats.map((s, idx) => {
        const agent = agentMap.get(s.agentId);
        return {
          rank: idx + 1,
          agentId: s.agentId,
          agentName: agent?.displayName || agent?.name || 'Unknown',
          avatarUrl: agent?.avatarUrl || undefined,
          totalPredictions: s.totalPredictions,
          correctPredictions: s.correctPredictions,
          accuracy: Number(s.accuracy),
          brierScore: Number(s.brierScore),
          roi: Number(s.roi),
          streak: s.streak,
          bestStreak: s.bestStreak,
        };
      }),
    });
  } catch (error: any) {
    console.error('[Prediction] GET /leaderboard error:', error);
    return c.json({ success: false, error: 'Failed to fetch leaderboard' }, 500);
  }
});

// GET /prediction/stats — Global prediction stats
predictionRoutes.get('/stats', async (c) => {
  try {
    const [marketCount, predictionCount, resolvedCount, statsAgg] = await Promise.all([
      db.predictionMarket.count(),
      db.agentPrediction.count(),
      db.agentPrediction.count({ where: { outcome: { not: 'PENDING' } } }),
      db.predictionStats.aggregate({
        _avg: { accuracy: true, brierScore: true },
        _count: { id: true },
      }),
    ]);

    return c.json({
      success: true,
      data: {
        totalMarkets: marketCount,
        totalPredictions: predictionCount,
        resolvedPredictions: resolvedCount,
        pendingPredictions: predictionCount - resolvedCount,
        activeForecasters: statsAgg._count.id,
        avgAccuracy: statsAgg._avg.accuracy ? Number(statsAgg._avg.accuracy) : 0,
        avgBrierScore: statsAgg._avg.brierScore ? Number(statsAgg._avg.brierScore) : 0,
      },
    });
  } catch (error: any) {
    console.error('[Prediction] GET /stats error:', error);
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// GET /prediction/agent/:agentId — Agent's prediction profile
predictionRoutes.get('/agent/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');

    const [stats, recentPredictions, agent] = await Promise.all([
      db.predictionStats.findUnique({ where: { agentId } }),
      db.agentPrediction.findMany({
        where: { agentId },
        include: { market: { select: { externalId: true, title: true, category: true, outcome: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.tradingAgent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true, displayName: true, avatarUrl: true },
      }),
    ]);

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.displayName || agent.name,
        avatarUrl: agent.avatarUrl,
        stats: stats ? {
          totalPredictions: stats.totalPredictions,
          correctPredictions: stats.correctPredictions,
          accuracy: Number(stats.accuracy),
          brierScore: Number(stats.brierScore),
          roi: Number(stats.roi),
          streak: stats.streak,
          bestStreak: stats.bestStreak,
        } : null,
        recentPredictions: recentPredictions.map(p => ({
          id: p.id,
          ticker: p.market.externalId,
          marketTitle: p.market.title,
          category: p.market.category,
          side: p.side,
          contracts: p.contracts,
          avgPrice: Number(p.avgPrice),
          totalCost: Number(p.totalCost),
          payout: p.payout ? Number(p.payout) : null,
          pnl: p.pnl ? Number(p.pnl) : null,
          outcome: p.outcome,
          marketOutcome: p.market.outcome,
          confidence: p.confidence,
          reasoning: p.reasoning,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    });
  } catch (error: any) {
    console.error('[Prediction] GET /agent/:agentId error:', error);
    return c.json({ success: false, error: 'Failed to fetch agent predictions' }, 500);
  }
});

// ── Authenticated Routes ────────────────────────────────

// POST /prediction/markets/:ticker/predict — Place a prediction
predictionRoutes.post('/markets/:ticker/predict', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId') as string;
    const ticker = c.req.param('ticker');
    const body = await c.req.json();
    const parsed = predictSchema.parse(body);

    // Find market
    const market = await db.predictionMarket.findFirst({
      where: { externalId: ticker },
    });

    if (!market) {
      return c.json({ success: false, error: 'Market not found. Run sync first.' }, 404);
    }

    if (market.status !== 'open') {
      return c.json({ success: false, error: 'Market is no longer open for predictions' }, 400);
    }

    if (market.outcome !== 'PENDING') {
      return c.json({ success: false, error: 'Market has already resolved' }, 400);
    }

    // Calculate price based on side
    const avgPrice = parsed.side === 'YES' ? Number(market.yesPrice) : Number(market.noPrice);
    const totalCost = avgPrice * parsed.contracts;

    // Place real order if requested and configured
    let realOrder = false;
    let orderId: string | undefined;

    if (parsed.placeRealOrder) {
      const kalshi = getKalshiService();
      if (!kalshi.isConfigured()) {
        return c.json({ success: false, error: 'Kalshi API key not configured — paper predictions only' }, 400);
      }
      try {
        const result = await kalshi.placeOrder({
          ticker,
          side: parsed.side,
          contracts: parsed.contracts,
        });
        realOrder = true;
        orderId = result.orderId;
      } catch (orderError: any) {
        return c.json({ success: false, error: `Order failed: ${orderError.message}` }, 400);
      }
    }

    // Create prediction + award XP atomically
    const prediction = await db.$transaction(async (tx) => {
      const pred = await tx.agentPrediction.create({
        data: {
          agentId,
          marketId: market.id,
          side: parsed.side,
          contracts: parsed.contracts,
          avgPrice,
          totalCost,
          confidence: parsed.confidence || null,
          reasoning: parsed.reasoning || null,
          realOrder,
          orderId: orderId || null,
        },
      });

      // Award XP for placing prediction
      const updated = await tx.tradingAgent.update({
        where: { id: agentId },
        data: { xp: { increment: XP_PREDICTION_PLACED } },
      });
      const newLevel = calculateLevel(updated.xp);
      if (updated.level !== newLevel) {
        await tx.tradingAgent.update({
          where: { id: agentId },
          data: { level: newLevel },
        });
      }

      return pred;
    });

    return c.json({
      success: true,
      data: {
        predictionId: prediction.id,
        ticker,
        side: prediction.side,
        contracts: prediction.contracts,
        avgPrice: Number(prediction.avgPrice),
        totalCost: Number(prediction.totalCost),
        realOrder,
        orderId: orderId || undefined,
        xpAwarded: XP_PREDICTION_PLACED,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ success: false, error: error.errors }, 400);
    }
    console.error('[Prediction] POST /predict error:', error);
    return c.json({ success: false, error: 'Failed to place prediction' }, 500);
  }
});

// GET /prediction/predictions — Agent's own predictions
predictionRoutes.get('/predictions', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId') as string;
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const outcome = c.req.query('outcome');

    const predictions = await db.agentPrediction.findMany({
      where: {
        agentId,
        ...(outcome ? { outcome: outcome as any } : {}),
      },
      include: {
        market: {
          select: { externalId: true, title: true, category: true, outcome: true, yesPrice: true, noPrice: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return c.json({
      success: true,
      data: predictions.map(p => ({
        id: p.id,
        ticker: p.market.externalId,
        marketTitle: p.market.title,
        category: p.market.category,
        side: p.side,
        contracts: p.contracts,
        avgPrice: Number(p.avgPrice),
        totalCost: Number(p.totalCost),
        payout: p.payout ? Number(p.payout) : null,
        pnl: p.pnl ? Number(p.pnl) : null,
        outcome: p.outcome,
        marketOutcome: p.market.outcome,
        currentYesPrice: Number(p.market.yesPrice),
        confidence: p.confidence,
        reasoning: p.reasoning,
        realOrder: p.realOrder,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[Prediction] GET /predictions error:', error);
    return c.json({ success: false, error: 'Failed to fetch predictions' }, 500);
  }
});

// ── Admin Routes ────────────────────────────────────────

// POST /prediction/sync — Trigger manual market sync
predictionRoutes.post('/sync', async (c) => {
  try {
    const internalKey = c.req.header('X-Internal-Key');
    if (internalKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === 'production') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const kalshi = getKalshiService();
    const synced = await kalshi.syncMarkets({ limit: 200 });

    return c.json({ success: true, data: { synced } });
  } catch (error: any) {
    console.error('[Prediction] POST /sync error:', error);
    return c.json({ success: false, error: 'Sync failed' }, 500);
  }
});

export { predictionRoutes };
