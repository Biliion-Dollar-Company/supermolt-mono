import { prisma } from '../lib/db';
import type { TradeAction, TradeStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ─── User-facing queries ─────────────────────────────────

export async function getAgentTrades(
  agentId: string,
  userId: string,
  opts: { status?: TradeStatus; limit?: number; offset?: number } = {}
) {
  // Verify ownership
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId },
    select: { userId: true },
  });
  if (!agent || agent.userId !== userId) {
    throw new Error('Agent not found');
  }

  const { status, limit = 50, offset = 0 } = opts;

  const [trades, total] = await Promise.all([
    prisma.paperTrade.findMany({
      where: {
        agentId,
        ...(status ? { status } : {}),
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        feedbacks: {
          where: { userId },
          select: { rating: true, tags: true },
        },
      },
    }),
    prisma.paperTrade.count({
      where: {
        agentId,
        ...(status ? { status } : {}),
      },
    }),
  ]);

  return { trades, total };
}

export async function getTrade(tradeId: string, userId: string) {
  const trade = await prisma.paperTrade.findUnique({
    where: { id: tradeId },
    include: {
      agent: { select: { userId: true, archetypeId: true, name: true } },
      feedbacks: {
        where: { userId },
        select: { rating: true, tags: true, note: true },
      },
    },
  });

  if (!trade || trade.agent.userId !== userId) {
    throw new Error('Trade not found');
  }

  return trade;
}

// ─── Internal (DevPrint → SR-Mobile) ─────────────────────

export interface CreateTradeInput {
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  action: TradeAction;
  entryPrice: number;
  amount: number;
  tokenAmount?: number;
  signalSource: string;
  confidence: number;
  marketCap?: number;
  liquidity?: number;
  metadata?: Record<string, unknown>;
}

export async function createPaperTrade(input: CreateTradeInput) {
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: input.agentId },
    select: { id: true, status: true },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  return prisma.paperTrade.create({
    data: {
      agentId: input.agentId,
      tokenMint: input.tokenMint,
      tokenSymbol: input.tokenSymbol,
      tokenName: input.tokenName,
      action: input.action,
      entryPrice: input.entryPrice,
      amount: input.amount,
      tokenAmount: input.tokenAmount ?? null,
      signalSource: input.signalSource,
      confidence: input.confidence,
      marketCap: input.marketCap ?? null,
      liquidity: input.liquidity ?? null,
      metadata: (input.metadata ?? {}) as Record<string, string | number | boolean | null>,
    },
  });
}

export interface CloseTradeInput {
  tradeId: string;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
}

export async function closePaperTrade(input: CloseTradeInput) {
  const trade = await prisma.paperTrade.findUnique({
    where: { id: input.tradeId },
    select: { id: true, status: true, agentId: true, action: true },
  });

  if (!trade) {
    throw new Error('Trade not found');
  }
  if (trade.status !== 'OPEN') {
    throw new Error('Trade is not open');
  }

  // Update trade and agent stats in a transaction
  return prisma.$transaction(async (tx) => {
    const closedTrade = await tx.paperTrade.update({
      where: { id: input.tradeId },
      data: {
        exitPrice: input.exitPrice,
        pnl: input.pnl,
        pnlPercent: input.pnlPercent,
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    await recalculateAgentStatsInTx(trade.agentId, tx, input.pnl);

    return closedTrade;
  });
}

/**
 * Recalculate agent stats (totalTrades, winRate, totalPnl) from CLOSED PaperTrades.
 * Works inside an existing Prisma transaction context.
 */
async function recalculateAgentStatsInTx(
  agentId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pnlIncrement?: number
) {
  const closedTradeFilter = {
    agentId,
    status: 'CLOSED' as const,
  };

  const stats = await tx.paperTrade.aggregate({
    where: closedTradeFilter,
    _count: true,
    _sum: { pnl: true },
  });

  const winCount = await tx.paperTrade.count({
    where: {
      ...closedTradeFilter,
      pnl: { gt: 0 },
    },
  });

  const totalTrades = stats._count;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
  const totalPnl = stats._sum.pnl ?? new Decimal(0);

  await tx.tradingAgent.update({
    where: { id: agentId },
    data: {
      totalTrades,
      winRate,
      totalPnl,
    },
  });
}

/**
 * Recalculate agent stats standalone (outside an existing transaction).
 * Used by webhooks.ts for partial trade splits.
 */
export async function recalculateAgentStats(agentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await recalculateAgentStatsInTx(agentId, tx);
  });
}
