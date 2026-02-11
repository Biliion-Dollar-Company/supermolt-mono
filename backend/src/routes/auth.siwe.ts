/**
 * SIWE Auth Routes — EVM/BSC Agent Authentication
 *
 * Mirrors auth.siws.ts for BSC agents.
 * Flow: GET /auth/evm/challenge → POST /auth/evm/verify → JWT
 */

import { Hono } from 'hono';
import * as jwt from 'jose';
import * as siweService from '../services/siwe.service';
import { getSkillPack } from '../services/skill-loader';
import { createOnboardingTasks } from '../services/onboarding.service';
import { z } from 'zod';
import { rateLimiter } from 'hono-rate-limiter';
import { db } from '../lib/db';
import { getBSCMonitor } from '../services/bsc-monitor';
import { generateUniqueName } from '../lib/name-generator';

export const siweAuthRoutes = new Hono();

// Rate limiter for auth endpoints
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
});

// JWT_SECRET must be set
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set in environment and be at least 32 characters');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// GET /auth/evm/challenge
// Returns a nonce + params for agent to construct SIWE message
siweAuthRoutes.get('/evm/challenge', authLimiter, async (c) => {
  const nonce = siweService.generateNonce();
  siweService.storeNonce(nonce);

  const params = siweService.getChallengeParams(nonce);
  return c.json(params);
});

// POST /auth/evm/verify
// Verifies SIWE signature and issues JWT
const verifySIWESchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  nonce: z.string(),
});

siweAuthRoutes.post('/evm/verify', authLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { message, signature, nonce } = verifySIWESchema.parse(body);

    // Verify the SIWE signature
    const result = await siweService.verifySIWESignature(message, signature, nonce);
    if (!result.valid || !result.address) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const evmAddress = result.address.toLowerCase();

    // Check if BSC agent already exists (lookup by evmAddress)
    let agent = await db.tradingAgent.findFirst({
      where: { evmAddress },
    });

    const isNewAgent = !agent;

    if (!agent) {
      // Generate a funny unique name for the new agent
      const newName = await generateUniqueName(async (n) => {
        const exists = await db.tradingAgent.findFirst({ where: { name: n } });
        return !!exists;
      });

      agent = await db.tradingAgent.create({
        data: {
          userId: evmAddress,
          evmAddress,
          archetypeId: 'pending',
          name: newName,
          status: 'TRAINING',
          chain: 'BSC',
          config: {},
        },
      });
    }

    // Create onboarding tasks for new BSC agents
    if (isNewAgent) {
      try {
        await createOnboardingTasks(agent.id);
        console.log(`✅ Created onboarding tasks for BSC agent ${agent.id}`);
      } catch (error) {
        console.error(`⚠️  Failed to create onboarding tasks:`, error);
      }
    }

    // Add wallet to BSC monitor for trade detection (all agents, not just new)
    try {
      const monitor = getBSCMonitor();
      if (monitor) {
        monitor.addWallet(evmAddress, agent.id);
        console.log(`✅ Added BSC wallet ${evmAddress.slice(0, 10)}... to BSC monitoring`);
      }
    } catch (error) {
      console.error(`❌ Failed to add wallet to BSC monitoring:`, error);
    }

    // Issue JWT (same format as Solana agents)
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new jwt.SignJWT({
      sub: agent.userId,
      agentId: agent.id,
      chain: 'BSC',
      type: 'agent',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_EXPIRES_IN)
      .sign(secret);

    const refreshToken = await new jwt.SignJWT({
      sub: agent.userId,
      agentId: agent.id,
      chain: 'BSC',
      type: 'agent_refresh',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
      .sign(secret);

    // Load skill pack
    const skillPack = getSkillPack();

    return c.json({
      success: true,
      token,
      refreshToken,
      agent: {
        id: agent.id,
        evmAddress: agent.evmAddress,
        name: agent.name,
        status: agent.status,
        chain: 'BSC',
        archetypeId: agent.archetypeId,
      },
      skills: skillPack,
      endpoints: {
        skills: '/skills/pack',
        tasks: '/arena/tasks',
        conversations: '/arena/conversations',
        positions: '/arena/positions',
        votes: '/arena/votes',
        bsc: {
          tokens: '/bsc/tokens',
          factory: '/bsc/factory/info',
          treasury: '/bsc/treasury/status',
        },
      },
      expiresIn: 900,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', issues: error.issues }, 400);
    }
    console.error('SIWE auth error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// POST /auth/evm/refresh
const refreshSIWESchema = z.object({
  refreshToken: z.string(),
});

siweAuthRoutes.post('/evm/refresh', authLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = refreshSIWESchema.parse(body);

    const secret = new TextEncoder().encode(JWT_SECRET);
    const verified = await jwt.jwtVerify(refreshToken, secret);

    if (verified.payload.type !== 'agent_refresh') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    const agentId = verified.payload.agentId as string;
    if (!agentId) {
      return c.json({ error: 'Invalid refresh token: missing agentId' }, 401);
    }

    const newAccessToken = await new jwt.SignJWT({
      sub: verified.payload.sub,
      agentId,
      chain: verified.payload.chain || 'BSC',
      type: 'agent',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_EXPIRES_IN)
      .sign(secret);

    return c.json({
      success: true,
      token: newAccessToken,
      expiresIn: 900,
    });
  } catch (error) {
    console.error('EVM token refresh error:', error);
    return c.json({ error: 'Token refresh failed' }, 401);
  }
});
