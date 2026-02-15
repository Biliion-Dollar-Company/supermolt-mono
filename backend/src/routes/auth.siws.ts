import { Hono } from 'hono';
import * as jwt from 'jose';
import * as siwsService from '../services/siws.service';
import { getSkillPack } from '../services/skill-loader';
import { createOnboardingTasks } from '../services/onboarding.service';
import { z } from 'zod';
import { rateLimiter } from 'hono-rate-limiter';
import { db } from '../lib/db';
import { generateUniqueName } from '../lib/name-generator';

// Dynamic import to avoid circular dependency issues
let heliusMonitor: any = null;
async function getHeliusMonitorInstance() {
  if (!heliusMonitor) {
    try {
      const indexModule = await import('../index.js');
      heliusMonitor = indexModule.getHeliusMonitor();
    } catch (error) {
      console.warn('⚠️  Could not import heliusMonitor:', error);
    }
  }
  return heliusMonitor;
}

// Initialize Hono router
export const siwsAuthRoutes = new Hono();

// SECURITY: Rate limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 requests per window per IP
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
});

// SECURITY: JWT_SECRET must be set - no fallback allowed
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set in environment and be at least 32 characters');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// GET /auth/agent/challenge
// Returns a nonce for agent to sign
siwsAuthRoutes.get('/agent/challenge', authLimiter, async (c) => {
  const nonce = siwsService.generateNonce();
  siwsService.storeNonce(nonce);

  return c.json({
    nonce,
    statement: 'Sign this message to authenticate your Solana agent with Trench',
    expiresIn: 300 // 5 minutes
  });
});

// POST /auth/agent/verify
// Verifies agent signature and issues JWT
const verifySIWSSchema = z.object({
  pubkey: z.string().min(32).max(44), // Solana address length
  signature: z.string(), // base64-encoded signature
  nonce: z.string()
});

siwsAuthRoutes.post('/agent/verify', authLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { pubkey, signature, nonce } = verifySIWSSchema.parse(body);

    // Verify the signature
    const isValid = siwsService.verifySIWSSignature(pubkey, signature, nonce);
    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // 🔥 WALLET VALIDATION: Minimum 0.2 SOL balance required
    try {
      const { Connection, LAMPORTS_PER_SOL, PublicKey } = await import('@solana/web3.js');
      // ALWAYS use mainnet for wallet validation (production wallets are on mainnet)
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const balance = await connection.getBalance(new PublicKey(pubkey));
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      if (solBalance < 0.2) {
        return c.json({
          error: `Insufficient wallet balance. Need minimum 0.2 SOL, you have ${solBalance.toFixed(4)} SOL`,
          code: 'WALLET_INELIGIBLE'
        }, 403);
      }
    } catch (error) {
      console.error('Wallet validation error:', error);
      return c.json({ error: 'Failed to validate wallet balance' }, 500);
    }

    // Check if agent already exists
    let agent = await db.tradingAgent.findFirst({
      where: { userId: pubkey } // Use pubkey as userId for agents
    });

    // Track if this is a new agent (for Helius monitoring)
    const isNewAgent = !agent;

    // If not, create new agent registration
    if (!agent) {
      // Generate a funny unique name for the new agent
      const newName = await generateUniqueName(async (n) => {
        const exists = await db.tradingAgent.findFirst({ where: { name: n } });
        return !!exists;
      });

      agent = await db.tradingAgent.create({
        data: {
          userId: pubkey, // Pubkey is the agent ID
          archetypeId: 'pending', // Will be set by user later
          name: newName,
          status: 'TRAINING',
          config: {} // Will be populated when archetype is chosen
        }
      });
    }

    // 🔥 AUTO-CREATE SCANNER: Create Scanner record for leaderboard/calls system
    if (isNewAgent) {
      try {
        const scanner = await db.scanner.create({
          data: {
            agentId: agent.id,
            name: agent.name,
            pubkey: pubkey,
            privateKey: '', // Not needed for observer agents
            strategy: 'general',
            description: 'Auto-created agent scanner',
            active: true
          }
        });
        console.log(`✅ Created Scanner record for agent ${agent.id}`);
      } catch (error) {
        console.error(`⚠️  Failed to create Scanner record:`, error);
        // Don't block if scanner creation fails
      }

      // Create onboarding tasks for the new agent
      try {
        await createOnboardingTasks(agent.id);
        console.log(`✅ Created onboarding tasks for agent ${agent.id}`);
      } catch (error) {
        console.error(`⚠️  Failed to create onboarding tasks:`, error);
        // Don't block registration
      }
    }

    // 🔥 DYNAMIC WALLET MONITORING: Add this wallet to Helius monitor (all agents, not just new ones)
    try {
      const monitor = await getHeliusMonitorInstance();
      if (monitor) {
        monitor.addWallet(pubkey);
        console.log(`✅ Added wallet ${pubkey.slice(0, 8)}... to Helius monitoring`);
      } else {
        console.warn(`⚠️  Helius monitor not available, wallet ${pubkey.slice(0, 8)}... not added to monitoring`);
      }
    } catch (error) {
      // Don't block registration if Helius fails
      console.error(`❌ Failed to add wallet to Helius monitoring:`, error);
    }

    // Issue JWT for this agent
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new jwt.SignJWT({
      sub: agent.userId, // Subject is the pubkey
      agentId: agent.id,
      type: 'agent'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_EXPIRES_IN)
      .sign(secret);

    // Optional: Issue refresh token for long-lived sessions
    const refreshToken = await new jwt.SignJWT({
      sub: agent.userId,
      agentId: agent.id,
      type: 'agent_refresh'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
      .sign(secret);

    // Agent last activity is tracked via updatedAt field (auto-updated by Prisma)

    // Load skill pack so agent knows what it can do immediately
    const skillPack = getSkillPack();

    return c.json({
      success: true,
      token,
      refreshToken,
      agent: {
        id: agent.id,
        pubkey: agent.userId,
        name: agent.name,
        status: agent.status,
        archetypeId: agent.archetypeId
      },
      skills: skillPack,
      endpoints: {
        skills: '/skills/pack',
        tasks: '/arena/tasks',
        conversations: '/arena/conversations',
        positions: '/arena/positions',
        votes: '/arena/votes',
        twitter: {
          request: '/agent-auth/twitter/request',
          verify: '/agent-auth/twitter/verify',
        },
      },
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', issues: error.issues }, 400);
    }
    console.error('SIWS auth error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// POST /auth/agent/refresh
// Refresh agent JWT token
const refreshSIWSSchema = z.object({
  refreshToken: z.string()
});

siwsAuthRoutes.post('/agent/refresh', authLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = refreshSIWSSchema.parse(body);

    const secret = new TextEncoder().encode(JWT_SECRET);
    const verified = await jwt.jwtVerify(refreshToken, secret);

    if (verified.payload.type !== 'agent_refresh') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    const agentPubkey = verified.payload.sub;
    const agentId = verified.payload.agentId as string;

    if (!agentId) {
      return c.json({ error: 'Invalid refresh token: missing agentId' }, 401);
    }

    // Issue new access token
    const newAccessToken = await new jwt.SignJWT({
      sub: agentPubkey,
      agentId,
      type: 'agent'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(JWT_EXPIRES_IN)
      .sign(secret);

    return c.json({
      success: true,
      token: newAccessToken,
      expiresIn: 900
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'Token refresh failed' }, 401);
  }
});
