/**
 * BSC Routes — Four.Meme Token Launcher, Treasury, and BSC-specific endpoints
 *
 * POST /bsc/tokens/create   — Deploy new token via Four.Meme (auth required)
 * GET  /bsc/tokens/:agentId — List tokens deployed by agent
 * GET  /bsc/factory/info    — Four.Meme factory contract info
 * GET  /bsc/treasury/status — BSC treasury balance & distribution stats
 * POST /bsc/treasury/distribute — Distribute BSC rewards for epoch (auth required)
 */

import { Hono } from 'hono';
import * as jwt from 'jose';
import { z } from 'zod';
import * as tokenFactory from '../services/token-factory.service';
import * as bscTreasury from '../services/bsc-treasury.service';
import { getFourMemeMonitor } from '../services/fourmeme-monitor';

export const bscRoutes = new Hono();

const JWT_SECRET = process.env.JWT_SECRET;

// Simple JWT auth middleware
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
    c.set('agentChain', payload.chain || 'SOLANA');
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// ── Token Factory ────────────────────────────────────────

// POST /bsc/tokens/create
const createTokenSchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
  totalSupply: z.string().optional(),  // IGNORED — Four.Meme fixed at 1B. Kept for backwards compat.
  description: z.string().max(500).optional(),
  label: z.enum(['Meme', 'AI', 'Defi', 'Games', 'Infra', 'De-Sci', 'Social', 'Depin', 'Charity', 'Others']).optional(),
  imageUrl: z.string().url().optional(),
  presaleBNB: z.string().optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  website: z.string().optional(),
});

bscRoutes.post('/tokens/create', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createTokenSchema.parse(body);
    const agentId = c.get('agentId') as string;

    const result = await tokenFactory.createTokenForAgent(agentId, {
      name: parsed.name,
      symbol: parsed.symbol,
      description: parsed.description,
      label: parsed.label,
      imageUrl: parsed.imageUrl,
      presaleBNB: parsed.presaleBNB,
      twitter: parsed.twitter,
      telegram: parsed.telegram,
      website: parsed.website,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[BSC] Token creation failed:', error);
    return c.json({ error: error.message || 'Token creation failed' }, 500);
  }
});

// GET /bsc/tokens/:agentId
bscRoutes.get('/tokens/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const tokens = await tokenFactory.getAgentTokens(agentId);
    return c.json({ success: true, data: tokens });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET /bsc/factory/info
bscRoutes.get('/factory/info', async (c) => {
  try {
    const info = await tokenFactory.getFactoryInfo();
    return c.json({ success: true, data: info });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ── Treasury ─────────────────────────────────────────────

// GET /bsc/treasury/status
bscRoutes.get('/treasury/status', async (c) => {
  try {
    const status = await bscTreasury.getBSCTreasuryStatus();
    return c.json({ success: true, data: status });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// POST /bsc/treasury/distribute
const distributeSchema = z.object({
  epochId: z.string().min(1),
});

bscRoutes.post('/treasury/distribute', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { epochId } = distributeSchema.parse(body);

    const result = await bscTreasury.distributeBSCRewards(epochId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[BSC] Distribution failed:', error);
    return c.json({ error: error.message || 'Distribution failed' }, 500);
  }
});

// ── 4meme Migrations ──────────────────────────────────────

const formatTokenResponse = (m: any) => ({
  id: m.id,
  tokenAddress: m.tokenAddress,
  tokenName: m.tokenName,
  tokenSymbol: m.tokenSymbol,
  txHash: m.factoryTxHash,
  chain: m.chain,
  platform: m.platform || null,
  bondingCurveGraduated: m.bondingCurveGraduated,
  graduationTxHash: m.graduationTxHash,
  graduationTime: m.graduationTime?.toISOString() || null,
  pairAddress: m.pairAddress || null,
  quoteToken: m.quoteToken || null,
  explorerUrl: `https://bscscan.com/address/${m.tokenAddress}`,
  platformUrl: m.platform === 'flap'
    ? `https://flap.sh/token/${m.tokenAddress}`
    : `https://four.meme/token/${m.tokenAddress}`,
  pancakeSwapUrl: m.bondingCurveGraduated
    ? `https://pancakeswap.finance/swap?outputCurrency=${m.tokenAddress}&chain=bsc`
    : null,
  createdAt: m.createdAt.toISOString(),
});

// GET /bsc/migrations — Only graduated tokens (migrated to PancakeSwap)
bscRoutes.get('/migrations', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const monitor = getFourMemeMonitor();
    if (monitor) {
      const migrations = await monitor.getRecentMigrations(Math.min(limit, 100));
      return c.json({
        success: true,
        count: migrations.length,
        data: migrations.map(formatTokenResponse),
        platforms: ['four.meme', 'flap'],
      });
    }

    // Fallback: query DB directly if monitor not running
    const { db: prisma } = await import('../lib/db');
    const migrations = await prisma.tokenDeployment.findMany({
      where: { chain: 'BSC', bondingCurveGraduated: true },
      orderBy: { graduationTime: 'desc' },
      take: Math.min(limit, 100),
    });
    return c.json({
      success: true,
      count: migrations.length,
      data: migrations.map(formatTokenResponse),
      platforms: ['four.meme', 'flap'],
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET /bsc/migrations/stats — Quick stats on token creations vs graduations
bscRoutes.get('/migrations/stats', async (c) => {
  try {
    const { db: prisma } = await import('../lib/db');
    const [total, graduated, fourMemeGrad, flapGrad] = await Promise.all([
      prisma.tokenDeployment.count({ where: { chain: 'BSC' } }),
      prisma.tokenDeployment.count({ where: { chain: 'BSC', bondingCurveGraduated: true } }),
      prisma.tokenDeployment.count({ where: { chain: 'BSC', bondingCurveGraduated: true, platform: 'four.meme' } }),
      prisma.tokenDeployment.count({ where: { chain: 'BSC', bondingCurveGraduated: true, platform: 'flap' } }),
    ]);
    return c.json({
      success: true,
      data: {
        totalCreated: total,
        totalGraduated: graduated,
        graduationRate: total > 0 ? +(graduated / total * 100).toFixed(2) : 0,
        byPlatform: {
          'four.meme': fourMemeGrad,
          'flap': flapGrad,
        },
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
