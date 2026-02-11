/**
 * Pump.fun Routes — Solana Token Launcher
 *
 * POST /pumpfun/tokens/create   — Deploy new token via pump.fun (auth required)
 * GET  /pumpfun/tokens/:agentId — List tokens deployed by agent on Solana
 * GET  /pumpfun/info            — Pump.fun platform info
 */

import { Hono } from 'hono';
import * as jwt from 'jose';
import { z } from 'zod';
import * as pumpfunFactory from '../services/pumpfun-token-factory.service';

export const pumpfunRoutes = new Hono();

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
    c.set('agentChain', payload.chain || 'SOLANA');
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// ── Token Factory ────────────────────────────────────────

const createTokenSchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  initialBuySol: z.number().min(0).max(10).optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  website: z.string().optional(),
});

// POST /pumpfun/tokens/create
pumpfunRoutes.post('/tokens/create', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createTokenSchema.parse(body);
    const agentId = c.get('agentId') as string;

    const result = await pumpfunFactory.createSolanaTokenForAgent(agentId, {
      name: parsed.name,
      symbol: parsed.symbol,
      description: parsed.description,
      imageUrl: parsed.imageUrl,
      initialBuySol: parsed.initialBuySol,
      twitter: parsed.twitter,
      telegram: parsed.telegram,
      website: parsed.website,
    });

    return c.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[PumpFun] Token creation failed:', error);
    return c.json({ error: error.message || 'Token creation failed' }, 500);
  }
});

// GET /pumpfun/tokens/:agentId
pumpfunRoutes.get('/tokens/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const tokens = await pumpfunFactory.getAgentSolanaTokens(agentId);
    return c.json({ success: true, data: tokens });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET /pumpfun/info
pumpfunRoutes.get('/info', async (c) => {
  try {
    const info = pumpfunFactory.getPumpFunInfo();
    return c.json({ success: true, data: info });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
