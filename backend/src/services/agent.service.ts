import { prisma } from '../lib/db';
import { getArchetype } from '../lib/archetypes';
import type { AgentStatus } from '@prisma/client';

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

  return prisma.tradingAgent.create({
    data: {
      userId,
      archetypeId,
      name,
      config: JSON.parse(JSON.stringify(archetype.tradingParams)),
    },
  });
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

  return prisma.tradingAgent.delete({
    where: { id: agentId },
  });
}
