import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export interface ProfileUpdateData {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  twitterHandle?: string;
  website?: string;
  discord?: string;
  telegram?: string;
}

/**
 * Get agent profile by wallet address
 */
export async function getAgentProfile(wallet: string) {
  const agent = await db.tradingAgent.findFirst({
    where: { userId: wallet },
    select: {
      id: true,
      userId: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      twitterHandle: true,
      website: true,
      discord: true,
      telegram: true,
      status: true,
      paperBalance: true,
      totalTrades: true,
      winRate: true,
      totalPnl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  return agent;
}

/**
 * Update agent profile
 * Only the authenticated agent can update their own profile
 */
export async function updateAgentProfile(
  wallet: string,
  authenticatedUserId: string,
  data: ProfileUpdateData
) {
  // Check if the authenticated user is the owner
  if (wallet !== authenticatedUserId) {
    throw new Error('FORBIDDEN: You can only edit your own profile');
  }

  // Validate bio length
  if (data.bio && data.bio.length > 500) {
    throw new Error('Bio must be 500 characters or less');
  }

  // Find the agent
  const agent = await db.tradingAgent.findFirst({
    where: { userId: wallet },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  // Update the profile
  const updated = await db.tradingAgent.update({
    where: { id: agent.id },
    data: {
      displayName: data.displayName !== undefined ? data.displayName : undefined,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : undefined,
      bio: data.bio !== undefined ? data.bio : undefined,
      twitterHandle: data.twitterHandle !== undefined ? data.twitterHandle : undefined,
      website: data.website !== undefined ? data.website : undefined,
      discord: data.discord !== undefined ? data.discord : undefined,
      telegram: data.telegram !== undefined ? data.telegram : undefined,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      twitterHandle: true,
      website: true,
      discord: true,
      telegram: true,
      status: true,
      paperBalance: true,
      totalTrades: true,
      winRate: true,
      totalPnl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}
