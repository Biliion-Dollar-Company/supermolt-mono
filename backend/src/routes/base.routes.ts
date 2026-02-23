/**
 * Base Chain Routes — Clanker Token Deployer + Monitor Status
 *
 * POST /base/tokens/create   — Deploy new token via Clanker v4 (auth required)
 * GET  /base/tokens/:agentId — List tokens deployed by agent on Base
 * GET  /base/monitor/status  — Base trade monitor health check
 */

import { Hono } from 'hono';
import * as jwt from 'jose';
import { z } from 'zod';
import * as clankerFactory from '../services/clanker-token-factory.service';
import { getBaseMonitor } from '../services/base-monitor';

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
