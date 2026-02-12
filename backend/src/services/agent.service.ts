import { prisma } from '../lib/db';
import { getArchetype } from '../lib/archetypes';
import type { AgentStatus } from '@prisma/client';
import { ensureOnboardingForAgent, ensureScannerForAgent } from './agent-session.service';

// Dynamic import to avoid circular dependency issues
let heliusMonitor: any = null;
async function getHeliusMonitor() {
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

export async function createAgent(userId: string, archetypeId: string, name: string) {
  const archetype = getArchetype(archetypeId);
  if (!archetype) {
    throw new Error(`Unknown archetype: ${archetypeId}`);
  }

  // Check if user already has an agent with this archetype
  const existing = await prisma.tradingAgent.findFirst({
    where: { userId, archetypeId },
  });
  if (existing) {
    throw new Error('You already have an agent with this archetype');
  }

  const agent = await prisma.tradingAgent.create({
    data: {
      userId,
      archetypeId,
      name,
      config: JSON.parse(JSON.stringify(archetype.tradingParams)),
    },
  });

  try {
    await ensureOnboardingForAgent(agent.id);
  } catch (error) {
    console.error('Failed to create onboarding tasks:', error);
  }

  try {
    await ensureScannerForAgent({
      agentId: agent.id,
      agentName: agent.name,
      agentUserId: agent.userId,
      archetypeId: agent.archetypeId,
    });
  } catch (error) {
    console.error('Failed to create scanner record:', error);
  }

  return agent;
}

export async function getUserAgents(userId: string) {
  return prisma.tradingAgent.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          paperTrades: true,
          feedbacks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAgent(agentId: string, userId: string) {
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId },
    include: {
      _count: {
        select: {
          paperTrades: true,
          feedbacks: true,
        },
      },
    },
  });

  if (!agent || agent.userId !== userId) {
    throw new Error('Agent not found');
  }

  return agent;
}

export async function updateAgentStatus(agentId: string, userId: string, status: AgentStatus) {
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent || agent.userId !== userId) {
    throw new Error('Agent not found');
  }

  return prisma.tradingAgent.update({
    where: { id: agentId },
    data: { status },
  });
}

export async function deleteAgent(agentId: string, userId: string) {
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent || agent.userId !== userId) {
    throw new Error('Agent not found');
  }

  // Remove wallet from Helius monitoring if this is a SIWS agent
  // (SIWS agents have their wallet pubkey as userId)
  if (agent.userId.length >= 32 && agent.userId.length <= 44) {
    try {
      const monitor = await getHeliusMonitor();
      if (monitor) {
        monitor.removeWallet(agent.userId);
        console.log(`✅ Removed wallet ${agent.userId.slice(0, 8)}... from Helius monitoring`);
      }
    } catch (error) {
      // Don't block deletion if Helius fails
      console.error(`❌ Failed to remove wallet from Helius monitoring:`, error);
    }
  }

  return prisma.tradingAgent.delete({
    where: { id: agentId },
  });
}
