import * as jwt from 'jose';
import { db } from '../lib/db';
import { getArchetype } from '../lib/archetypes';
import { generateUniqueName } from '../lib/name-generator';
import { createOnboardingTasks } from './onboarding.service';
import { createPrivySolanaWallet } from '../lib/privy';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900;

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 60 * 60;
    case 'd':
      return num * 60 * 60 * 24;
    default:
      return 900;
  }
}

export async function issueAgentTokens(
  agentId: string,
  subject: string,
  privyId?: string,
  wallet?: string
) {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set in environment and be at least 32 characters');
  }

  const secret = new TextEncoder().encode(JWT_SECRET);

  // Include privyId and wallet to make agent JWT compatible with authMiddleware
  const token = await new jwt.SignJWT({
    sub: subject,
    agentId,
    type: 'agent',
    ...(privyId && { privyId }),
    ...(wallet && { wallet }),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secret);

  const refreshToken = await new jwt.SignJWT({
    sub: subject,
    agentId,
    type: 'agent_refresh',
    ...(privyId && { privyId }),
    ...(wallet && { wallet }),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
    .sign(secret);

  return {
    token,
    refreshToken,
    expiresIn: parseExpiry(JWT_EXPIRES_IN),
  };
}

export async function ensurePrivyWallet(agentId: string, privyUserId: string) {
  const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
  if (!agent || agent.privyWalletId) return;

  // Only create Privy wallets for Privy-authenticated users (did:privy:*)
  if (!privyUserId.startsWith('did:privy:')) return;

  try {
    const wallet = await createPrivySolanaWallet(privyUserId);
    const existingConfig = (agent.config as Record<string, unknown>) || {};
    await db.tradingAgent.update({
      where: { id: agentId },
      data: {
        privyWalletId: wallet.id,
        config: { ...existingConfig, privyWalletAddress: wallet.address },
      },
    });
    console.log(`[AgentSession] Created Privy wallet for agent ${agentId}: ${wallet.address}`);
  } catch (error) {
    console.error(`[AgentSession] Failed to create Privy wallet for agent ${agentId}:`, error);
  }
}

export async function ensureOnboardingForAgent(agentId: string) {
  const existing = await db.agentTaskCompletion.findFirst({
    where: {
      agentId,
      task: { tokenMint: null },
    },
  });

  if (!existing) {
    await createOnboardingTasks(agentId);
  }
}

export async function ensureScannerForAgent(options: {
  agentId: string;
  agentName: string;
  agentUserId: string;
  archetypeId: string;
  walletAddress?: string | null;
}) {
  const existing = await db.scanner.findFirst({
    where: { agentId: options.agentId },
  });

  if (existing) {
    return existing;
  }

  const pubkey = options.walletAddress || `user:${options.agentUserId}`;

  try {
    return await db.scanner.create({
      data: {
        agentId: options.agentId,
        name: options.agentName,
        pubkey,
        privateKey: '',
        strategy: options.archetypeId || 'user_agent',
        description: 'User-created agent',
        active: true,
      },
    });
  } catch (error) {
    console.error('Failed to create scanner for agent:', error);
    return null;
  }
}

export async function getOrCreateQuickstartAgent(options: {
  userId: string;
  walletAddress?: string | null;
  archetypeId?: string;
  name?: string;
  displayName?: string;
  twitterUsername?: string;
  avatarUrl?: string;
}) {
  const existing = await db.tradingAgent.findFirst({
    where: { userId: options.userId },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    // Backfill profile data on re-login (only if not already set)
    const updates: Record<string, any> = {};

    if (options.displayName && !existing.displayName) {
      updates.displayName = options.displayName;
    }
    if (options.twitterUsername && !existing.twitterHandle) {
      updates.twitterHandle = `@${options.twitterUsername}`;
    }
    if (options.avatarUrl && !existing.avatarUrl) {
      updates.avatarUrl = options.avatarUrl;
    }

    // Mark as Twitter-verified via Privy OAuth
    if (options.twitterUsername && !existing.twitterHandle) {
      const existingConfig = (existing.config as Record<string, unknown>) || {};
      updates.config = {
        ...existingConfig,
        twitterVerified: true,
        twitterVerifiedVia: 'privy_oauth',
        twitterVerifiedAt: new Date().toISOString(),
      };
    }

    if (Object.keys(updates).length > 0) {
      await db.tradingAgent.update({
        where: { id: existing.id },
        data: updates,
      });
    }

    await ensureOnboardingForAgent(existing.id);
    await ensurePrivyWallet(existing.id, options.userId);
    await ensureScannerForAgent({
      agentId: existing.id,
      agentName: existing.name,
      agentUserId: existing.userId,
      archetypeId: existing.archetypeId,
      walletAddress: options.walletAddress,
    });

    return existing;
  }

  const archetype = getArchetype(options.archetypeId || 'degen_hunter') || getArchetype('degen_hunter');
  if (!archetype) {
    throw new Error('No default archetype configured');
  }

  const agentName = options.name
    || await generateUniqueName(async (candidate) => {
      const found = await db.tradingAgent.findFirst({ where: { name: candidate } });
      return !!found;
    });

  const agent = await db.tradingAgent.create({
    data: {
      userId: options.userId,
      archetypeId: archetype.id,
      name: agentName,
      displayName: options.displayName || null,
      twitterHandle: options.twitterUsername ? `@${options.twitterUsername}` : null,
      avatarUrl: options.avatarUrl || null,
      status: 'TRAINING',
      config: {
        ...archetype.tradingParams,
        origin: 'quickstart',
        walletAddress: options.walletAddress || null,
        ...(options.twitterUsername ? {
          twitterVerified: true,
          twitterVerifiedVia: 'privy_oauth',
          twitterVerifiedAt: new Date().toISOString(),
        } : {}),
      },
    },
  });

  await ensureOnboardingForAgent(agent.id);
  await ensurePrivyWallet(agent.id, options.userId);
  await ensureScannerForAgent({
    agentId: agent.id,
    agentName: agent.name,
    agentUserId: agent.userId,
    archetypeId: agent.archetypeId,
    walletAddress: options.walletAddress,
  });

  return agent;
}
