/**
 * Arena Service
 *
 * Public-facing data layer for the arena page.
 * Transforms internal DB models into the exact response shapes
 * the frontend expects (see web/lib/types.ts).
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ── Agent name lookup cache (per-request) ─────────────────

async function buildAgentNameMap(agentIds: string[]): Promise<Map<string, string>> {
  if (agentIds.length === 0) return new Map();

  // Try TradingAgent first, then Scanner
  const [tradingAgents, scanners] = await Promise.all([
    db.tradingAgent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    }),
    db.scanner.findMany({
      where: { agentId: { in: agentIds } },
      select: { agentId: true, name: true },
    }),
  ]);

  const nameMap = new Map<string, string>();
  for (const s of scanners) nameMap.set(s.agentId, s.name);
  for (const a of tradingAgents) nameMap.set(a.id, a.name);
  return nameMap;
}

// ── Leaderboard ───────────────────────────────────────────

export async function getLeaderboard() {
  // Get active epoch for USDC pool display
  const activeEpoch = await db.scannerEpoch.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startAt: 'desc' },
  });

  // Get ALL active trading agents (SuperRouter + authenticated agents + observers)
  const agents = await db.tradingAgent.findMany({
    where: { status: 'ACTIVE' },
  });

  if (agents.length === 0) {
    return {
      success: true,
      data: {
        epochId: activeEpoch?.id || '',
        epochName: activeEpoch?.name || 'Live Arena',
        epochNumber: activeEpoch?.epochNumber || 1,
        startAt: activeEpoch?.startAt?.toISOString() || new Date().toISOString(),
        endAt: activeEpoch?.endAt?.toISOString() || new Date().toISOString(),
        status: activeEpoch?.status || 'ACTIVE',
        usdcPool: activeEpoch ? parseFloat(activeEpoch.usdcPool.toString()) : 0,
        baseAllocation: activeEpoch ? parseFloat(activeEpoch.baseAllocation.toString()) : 0,
        rankings: [],
      },
    };
  }

  const agentIds = agents.map((a) => a.id);

  // Get AgentStats for sortino ratios (populated by sortino cron)
  const [stats, tradeCounts] = await Promise.all([
    db.agentStats.findMany({
      where: { agentId: { in: agentIds } },
    }),
    db.agentTrade.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds } },
      _count: { agentId: true },
      _sum: { solAmount: true },
    }),
  ]);

  const statsMap = new Map(stats.map((s) => [s.agentId, s]));
  const tradeMap = new Map(
    tradeCounts.map((tc) => [
      tc.agentId,
      {
        count: tc._count.agentId,
        volume: tc._sum.solAmount ? parseFloat(tc._sum.solAmount.toString()) : 0,
      },
    ])
  );

  const rankings = agents.map((agent) => {
    const agentStats = statsMap.get(agent.id);
    const tradeData = tradeMap.get(agent.id);
    const winRate = parseFloat(agent.winRate.toString());
    const totalPnl = parseFloat(agent.totalPnl.toString());
    const sortinoRatio = agentStats ? parseFloat(agentStats.sortinoRatio.toString()) : 0;

    return {
      agentId: agent.id,
      agentName: agent.displayName || agent.name,
      walletAddress: agent.userId,
      sortino_ratio: sortinoRatio,
      win_rate: winRate,
      total_pnl: totalPnl,
      trade_count: tradeData?.count || agent.totalTrades,
      total_volume: tradeData?.volume || 0,
      average_win: totalPnl > 0 && agent.totalTrades > 0 ? totalPnl / agent.totalTrades : 0,
      average_loss: totalPnl < 0 && agent.totalTrades > 0 ? totalPnl / agent.totalTrades : 0,
      max_win: 0,
      max_loss: 0,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  });

  // Sort: trade_count desc (most active first), then sortino, win rate, PnL
  rankings.sort((a, b) => {
    if (b.trade_count !== a.trade_count) return b.trade_count - a.trade_count;
    if (b.sortino_ratio !== a.sortino_ratio) return b.sortino_ratio - a.sortino_ratio;
    if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
    return b.total_pnl - a.total_pnl;
  });

  return {
    success: true,
    data: {
      epochId: activeEpoch?.id || '',
      epochName: activeEpoch?.name || 'Live Arena',
      epochNumber: activeEpoch?.epochNumber || 1,
      startAt: activeEpoch?.startAt?.toISOString() || new Date().toISOString(),
      endAt: activeEpoch?.endAt?.toISOString() || new Date().toISOString(),
      status: activeEpoch?.status || 'ACTIVE',
      usdcPool: activeEpoch ? parseFloat(activeEpoch.usdcPool.toString()) : 0,
      baseAllocation: activeEpoch ? parseFloat(activeEpoch.baseAllocation.toString()) : 0,
      rankings,
    },
  };
}

// ── Recent Trades ─────────────────────────────────────────

export async function getRecentTrades(limit: number) {
  // Use AgentTrade (real on-chain trades with signatures)
  const trades = await db.agentTrade.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  if (trades.length > 0) {
    return {
      trades: trades.map((t) => ({
        tradeId: t.id,
        agentId: t.agentId,
        tokenMint: t.tokenMint,
        tokenSymbol: t.tokenSymbol || 'UNKNOWN',
        action: t.action as 'BUY' | 'SELL',
        quantity: parseFloat(t.tokenAmount.toString()),
        entryPrice: parseFloat(t.solAmount.toString()),
        exitPrice: undefined,
        pnl: 0,
        pnlPercent: 0,
        txHash: t.signature,
        timestamp: t.createdAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.createdAt.toISOString(),
      })),
    };
  }

  // Fallback: PaperTrade with filters (exclude ACTIVITY markers and zero-price junk)
  const paperTrades = await db.paperTrade.findMany({
    where: {
      NOT: [{ tokenSymbol: 'ACTIVITY' }, { entryPrice: 0 }],
    },
    orderBy: { openedAt: 'desc' },
    take: limit,
  });

  return {
    trades: paperTrades.map((t) => ({
      tradeId: t.id,
      agentId: t.agentId,
      tokenMint: t.tokenMint,
      tokenSymbol: t.tokenSymbol,
      action: t.action as 'BUY' | 'SELL',
      quantity: t.tokenAmount ? parseFloat(t.tokenAmount.toString()) : parseFloat(t.amount.toString()),
      entryPrice: parseFloat(t.entryPrice.toString()),
      exitPrice: t.exitPrice ? parseFloat(t.exitPrice.toString()) : undefined,
      pnl: t.pnl ? parseFloat(t.pnl.toString()) : 0,
      pnlPercent: t.pnlPercent ? parseFloat(t.pnlPercent.toString()) : 0,
      txHash: `tx_${t.id}`,
      timestamp: t.openedAt.toISOString(),
      createdAt: t.openedAt.toISOString(),
      updatedAt: (t.closedAt ?? t.openedAt).toISOString(),
    })),
  };
}

// ── Positions ─────────────────────────────────────────────

export async function getAllPositions() {
  const positions = await db.agentPosition.findMany({
    where: {
      NOT: [
        { tokenSymbol: 'UNKNOWN' },
        { tokenSymbol: 'ACTIVITY' },
      ],
      entryPrice: { gt: 0 },
      quantity: { gt: 0 },
    },
    orderBy: { openedAt: 'desc' },
  });

  // Gather agent names
  const agentIds = [...new Set(positions.map((p) => p.agentId))];
  const nameMap = await buildAgentNameMap(agentIds);

  return {
    positions: positions.map((pos) => {
      const quantity = parseFloat(pos.quantity.toString());
      const entryPrice = parseFloat(pos.entryPrice.toString());
      const currentValue = pos.currentValue ? parseFloat(pos.currentValue.toString()) : quantity * entryPrice;
      const currentPrice = quantity > 0 ? currentValue / quantity : entryPrice;

      return {
        positionId: pos.id,
        agentId: pos.agentId,
        agentName: nameMap.get(pos.agentId) ?? 'Unknown',
        tokenMint: pos.tokenMint,
        tokenSymbol: pos.tokenSymbol,
        quantity,
        entryPrice,
        currentPrice,
        currentValue,
        pnl: pos.pnl ? parseFloat(pos.pnl.toString()) : 0,
        pnlPercent: pos.pnlPercent ? parseFloat(pos.pnlPercent.toString()) : 0,
        openedAt: pos.openedAt.toISOString(),
      };
    }),
  };
}

// ── Conversations ─────────────────────────────────────────

export async function getConversations() {
  const conversations = await db.agentConversation.findMany({
    include: {
      messages: {
        take: 1,
        orderBy: { timestamp: 'desc' },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // For participant count, query distinct agentIds per conversation
  const convIds = conversations.map((c) => c.id);
  const participantCounts = new Map<string, number>();

  if (convIds.length > 0) {
    const msgs = await db.agentMessage.findMany({
      where: { conversationId: { in: convIds } },
      select: { conversationId: true, agentId: true },
      distinct: ['conversationId', 'agentId'],
    });

    for (const m of msgs) {
      participantCounts.set(m.conversationId, (participantCounts.get(m.conversationId) ?? 0) + 1);
    }
  }

  return {
    conversations: conversations.map((conv) => ({
      conversationId: conv.id,
      topic: conv.topic,
      tokenMint: conv.tokenMint ?? undefined,
      tokenSymbol: conv.tokenMint ? undefined : undefined, // tokenSymbol not stored; frontend handles undefined
      participantCount: participantCounts.get(conv.id) ?? 0,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0]?.message ?? undefined,
      lastMessageAt: conv.messages[0]?.timestamp.toISOString() ?? conv.createdAt.toISOString(),
      createdAt: conv.createdAt.toISOString(),
    })),
  };
}

// ── Conversation Messages ─────────────────────────────────

export async function getConversationMessages(conversationId: string) {
  const conversation = await db.agentConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    return null; // route handler returns 404
  }

  const messages = await db.agentMessage.findMany({
    where: { conversationId },
    orderBy: { timestamp: 'asc' },
  });

  const agentIds = [...new Set(messages.map((m) => m.agentId))];
  const nameMap = await buildAgentNameMap(agentIds);

  return {
    messages: messages.map((msg) => ({
      messageId: msg.id,
      conversationId: msg.conversationId,
      agentId: msg.agentId,
      agentName: nameMap.get(msg.agentId) ?? 'Unknown',
      content: msg.message, // DB field "message" -> frontend field "content"
      tokenMint: conversation.tokenMint ?? undefined,
      tokenSymbol: undefined,
      timestamp: msg.timestamp.toISOString(),
    })),
  };
}

// ── Votes (all) ───────────────────────────────────────────

export async function getAllVotes() {
  const proposals = await db.voteProposal.findMany({
    include: { votes: true },
    orderBy: { createdAt: 'desc' },
  });

  const proposerIds = [...new Set(proposals.map((p) => p.proposerId))];
  const nameMap = await buildAgentNameMap(proposerIds);

  return {
    votes: proposals.map((p) => {
      const yesVotes = p.votes.filter((v) => v.vote === 'YES').length;
      const noVotes = p.votes.filter((v) => v.vote === 'NO').length;

      return {
        voteId: p.id,
        proposerId: p.proposerId,
        proposerName: nameMap.get(p.proposerId) ?? 'Unknown',
        action: p.action as 'BUY' | 'SELL',
        tokenMint: p.tokenMint ?? '',
        tokenSymbol: p.token,
        reason: p.reason,
        yesVotes,
        noVotes,
        totalVotes: p.votes.length,
        status: p.status.toLowerCase() as 'active' | 'passed' | 'failed' | 'expired',
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        completedAt: p.status !== 'ACTIVE' ? p.expiresAt.toISOString() : undefined,
      };
    }),
  };
}

// ── Active Votes ──────────────────────────────────────────

export async function getActiveVotes() {
  const proposals = await db.voteProposal.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    include: { votes: true },
    orderBy: { createdAt: 'desc' },
  });

  const proposerIds = [...new Set(proposals.map((p) => p.proposerId))];
  const nameMap = await buildAgentNameMap(proposerIds);

  return {
    votes: proposals.map((p) => {
      const yesVotes = p.votes.filter((v) => v.vote === 'YES').length;
      const noVotes = p.votes.filter((v) => v.vote === 'NO').length;

      return {
        voteId: p.id,
        proposerId: p.proposerId,
        proposerName: nameMap.get(p.proposerId) ?? 'Unknown',
        action: p.action as 'BUY' | 'SELL',
        tokenMint: p.tokenMint ?? '',
        tokenSymbol: p.token,
        reason: p.reason,
        yesVotes,
        noVotes,
        totalVotes: p.votes.length,
        status: 'active' as const,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
      };
    }),
  };
}

// ── Vote Detail ───────────────────────────────────────────

export async function getVoteDetail(voteId: string) {
  const proposal = await db.voteProposal.findUnique({
    where: { id: voteId },
    include: { votes: true },
  });

  if (!proposal) {
    return null; // route handler returns 404
  }

  // Get proposer + voter names
  const allAgentIds = [proposal.proposerId, ...proposal.votes.map((v) => v.agentId)];
  const nameMap = await buildAgentNameMap([...new Set(allAgentIds)]);

  const yesVotes = proposal.votes.filter((v) => v.vote === 'YES').length;
  const noVotes = proposal.votes.filter((v) => v.vote === 'NO').length;

  return {
    vote: {
      voteId: proposal.id,
      proposerId: proposal.proposerId,
      proposerName: nameMap.get(proposal.proposerId) ?? 'Unknown',
      action: proposal.action as 'BUY' | 'SELL',
      tokenMint: proposal.tokenMint ?? '',
      tokenSymbol: proposal.token,
      reason: proposal.reason,
      yesVotes,
      noVotes,
      totalVotes: proposal.votes.length,
      status: proposal.status.toLowerCase() as 'active' | 'passed' | 'failed' | 'expired',
      createdAt: proposal.createdAt.toISOString(),
      expiresAt: proposal.expiresAt.toISOString(),
      completedAt: proposal.status !== 'ACTIVE' ? proposal.expiresAt.toISOString() : undefined,
      votes: proposal.votes.map((v) => ({
        agentId: v.agentId,
        agentName: nameMap.get(v.agentId) ?? 'Unknown',
        vote: v.vote.toLowerCase() as 'yes' | 'no',
        timestamp: v.timestamp.toISOString(),
      })),
    },
  };
}
