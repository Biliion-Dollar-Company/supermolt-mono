import { prisma } from '../lib/db';
import type { FeedbackRating } from '@prisma/client';

export interface SubmitFeedbackInput {
  tradeId: string;
  agentId: string;
  userId: string;
  rating: FeedbackRating;
  tags?: string[];
  note?: string;
}

export async function submitFeedback(input: SubmitFeedbackInput) {
  // Verify the trade belongs to the user's agent
  const trade = await prisma.paperTrade.findUnique({
    where: { id: input.tradeId },
    include: { agent: { select: { userId: true } } },
  });

  if (!trade || trade.agent.userId !== input.userId) {
    throw new Error('Trade not found');
  }

  if (trade.agentId !== input.agentId) {
    throw new Error('Trade does not belong to this agent');
  }

  return prisma.tradeFeedback.upsert({
    where: {
      tradeId_userId: {
        tradeId: input.tradeId,
        userId: input.userId,
      },
    },
    create: {
      tradeId: input.tradeId,
      agentId: input.agentId,
      userId: input.userId,
      rating: input.rating,
      tags: input.tags ?? [],
      note: input.note ?? null,
    },
    update: {
      rating: input.rating,
      tags: input.tags ?? [],
      note: input.note ?? null,
    },
  });
}

export async function getAgentFeedbackStats(agentId: string, userId: string) {
  // Verify ownership
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId },
    select: { userId: true },
  });
  if (!agent || agent.userId !== userId) {
    throw new Error('Agent not found');
  }

  const [total, good, bad, skip] = await Promise.all([
    prisma.tradeFeedback.count({ where: { agentId } }),
    prisma.tradeFeedback.count({ where: { agentId, rating: 'GOOD' } }),
    prisma.tradeFeedback.count({ where: { agentId, rating: 'BAD' } }),
    prisma.tradeFeedback.count({ where: { agentId, rating: 'SKIP' } }),
  ]);

  // Pending: trades without feedback from this user
  const pendingFeedback = await prisma.paperTrade.count({
    where: {
      agentId,
      status: 'CLOSED',
      feedbacks: {
        none: { userId },
      },
    },
  });

  return { total, good, bad, skip, pendingFeedback };
}
