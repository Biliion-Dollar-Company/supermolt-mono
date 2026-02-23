/**
 * Base Chain Routes — Multi-Platform Token Launches + Trade Monitor
 *
 * POST /base/tokens/create    — Deploy new token via Clanker v4 (auth required)
 * GET  /base/tokens/:agentId  — List tokens deployed by agent on Base
 * GET  /base/monitor/status   — Base trade monitor health check
 * GET  /base/launches         — Recent token launches: Clanker + Zora + Flaunch (?platform=filter)
 * GET  /base/launches/stats   — Launch stats across all Base platforms
 */

import { Hono } from 'hono';
import * as jwt from 'jose';
import { z } from 'zod';
import * as clankerFactory from '../services/clanker-token-factory.service';
import { getBaseMonitor } from '../services/base-monitor';
import { getClankerMonitor } from '../services/clanker-monitor';

export const baseRoutes = new Hono();

const JWT_SECRET = process.env.JWT_SECRET;

async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwt.jwtVerify(token, secret);

    if (payload.type !== 'agent') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    c.set('agentId', payload.agentId as string);
    c.set('agentSub', payload.sub as string);
    c.set('agentChain', payload.chain || 'BASE');
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// POST /base/tokens/create
const createTokenSchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  devBuyEth: z.number().min(0).max(10).optional(),
  vaultPercentage: z.number().min(0).max(90).optional(),
  vaultLockupDays: z.number().min(7).max(365).optional(),
});

baseRoutes.post('/tokens/create', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createTokenSchema.parse(body);
    const agentId = c.get('agentId') as string;

    const result = await clankerFactory.createTokenOnBase(agentId, {
      name: parsed.name,
      symbol: parsed.symbol,
      description: parsed.description,
      imageUrl: parsed.imageUrl,
      devBuyEth: parsed.devBuyEth,
      vaultPercentage: parsed.vaultPercentage,
      vaultLockupDays: parsed.vaultLockupDays,
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[Base] Token creation failed:', error);
    return c.json({ error: error.message || 'Token creation failed' }, 500);
  }
});

// GET /base/tokens/:agentId
baseRoutes.get('/tokens/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const tokens = await clankerFactory.getAgentBaseTokens(agentId);
    return c.json({ success: true, data: tokens });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET /base/monitor/status
baseRoutes.get('/monitor/status', async (c) => {
  try {
    const monitor = getBaseMonitor();
    const { db } = await import('../lib/db');

    const state = await db.monitorState.findUnique({
      where: { id: 'base-trade-monitor' },
    });

    const trackedWallets = await db.tradingAgent.count({
      where: { chain: 'BASE', evmAddress: { not: null } },
    });

    return c.json({
      success: true,
      data: {
        running: monitor !== null,
        lastBlock: state?.lastBlock || 0,
        lastUpdated: state?.updatedAt?.toISOString() || null,
        trackedWallets,
        rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ── Base Token Launches (All Platforms) ──────────────────

const formatLaunchResponse = (t: any) => {
  const platform = t.platform || 'unknown';
  const platformUrl = platform === 'clanker'
    ? `https://clanker.world/clanker/${t.tokenAddress}`
    : platform === 'zora'
    ? `https://zora.co/coin/base:${t.tokenAddress}`
    : platform === 'flaunch'
    ? `https://flaunch.gg/base/token/${t.tokenAddress}`
    : null;

  return {
    id: t.id,
    tokenAddress: t.tokenAddress,
    tokenName: t.tokenName,
    tokenSymbol: t.tokenSymbol,
    txHash: t.factoryTxHash,
    chain: t.chain,
    platform,
    bondingCurveGraduated: t.bondingCurveGraduated,
    pairAddress: t.pairAddress || null,
    quoteToken: t.quoteToken || null,
    explorerUrl: `https://basescan.org/address/${t.tokenAddress}`,
    platformUrl,
    uniswapUrl: `https://app.uniswap.org/swap?outputCurrency=${t.tokenAddress}&chain=base`,
    createdAt: t.createdAt.toISOString(),
  };
};

// GET /base/launches — Recent token launches across all Base platforms
// Query params: ?limit=20&platform=clanker|zora|flaunch
baseRoutes.get('/launches', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const platform = c.req.query('platform'); // optional filter
    const monitor = getClankerMonitor();

    if (monitor && !platform) {
      const launches = await monitor.getRecentCreations(Math.min(limit, 100));
      return c.json({
        success: true,
        count: launches.length,
        data: launches.map(formatLaunchResponse),
        platforms: ['clanker', 'zora', 'flaunch'],
      });
    }

    if (monitor && platform) {
      const launches = await monitor.getRecentByPlatform(platform, Math.min(limit, 100));
      return c.json({
        success: true,
        count: launches.length,
        data: launches.map(formatLaunchResponse),
        platforms: [platform],
      });
    }

    // Fallback: query DB directly
    const { db } = await import('../lib/db');
    const where: any = { chain: 'BASE' };
    if (platform) where.platform = platform;

    const launches = await db.tokenDeployment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return c.json({
      success: true,
      count: launches.length,
      data: launches.map(formatLaunchResponse),
      platforms: platform ? [platform] : ['clanker', 'zora', 'flaunch'],
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET /base/launches/stats — Launch stats across all Base platforms
baseRoutes.get('/launches/stats', async (c) => {
  try {
    const { db } = await import('../lib/db');
    const [total, clankerCount, zoraCount, flaunchCount] = await Promise.all([
      db.tokenDeployment.count({ where: { chain: 'BASE' } }),
      db.tokenDeployment.count({ where: { chain: 'BASE', platform: 'clanker' } }),
      db.tokenDeployment.count({ where: { chain: 'BASE', platform: 'zora' } }),
      db.tokenDeployment.count({ where: { chain: 'BASE', platform: 'flaunch' } }),
    ]);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24h = await db.tokenDeployment.count({
      where: { chain: 'BASE', createdAt: { gte: oneDayAgo } },
    });

    const monitor = getClankerMonitor();
    const monitorState = await db.monitorState.findUnique({
      where: { id: 'base-launch-monitor' },
    });

    return c.json({
      success: true,
      data: {
        totalCreated: total,
        byPlatform: { clanker: clankerCount, zora: zoraCount, flaunch: flaunchCount },
        last24h,
        monitorRunning: monitor !== null,
        monitorStats: monitor?.getStats() || null,
        lastBlock: monitorState?.lastBlock || 0,
        lastUpdated: monitorState?.updatedAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
