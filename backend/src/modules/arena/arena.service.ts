/**
 * Arena Service
 *
 * Public-facing data layer for the arena page.
 * Transforms internal DB models into the exact response shapes
 * the frontend expects (see web/lib/types.ts).
 */

import { getTokenPrice } from '../../lib/birdeye';
import { treasuryManager } from '../../services/treasury-manager.service';
import { db } from '../../lib/db';

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
  // Also get PaperTrade counts as fallback volume source (AgentTrade may be empty)
  const [stats, agentTradeCounts, paperTradeCounts] = await Promise.all([
    db.agentStats.findMany({
      where: { agentId: { in: agentIds } },
    }),
    db.agentTrade.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agentIds } },
      _count: { agentId: true },
      _sum: { solAmount: true },
    }),
    db.paperTrade.groupBy({
      by: ['agentId'],
      where: {
        agentId: { in: agentIds },
      },
      _count: { agentId: true },
      _sum: { amount: true },
    }),
  ]);

  const statsMap = new Map(stats.map((s) => [s.agentId, s]));
  const agentTradeMap = new Map(
    agentTradeCounts.map((tc) => [
      tc.agentId,
      {
        count: tc._count.agentId,
        volume: tc._sum.solAmount ? parseFloat(tc._sum.solAmount.toString()) : 0,
      },
    ])
  );
  const paperTradeMap = new Map(
    paperTradeCounts.map((tc) => [
      tc.agentId,
      {
        count: tc._count.agentId,
        volume: tc._sum.amount ? parseFloat(tc._sum.amount.toString()) : 0,
      },
    ])
  );

  const rankings = agents.map((agent) => {
    const agentStats = statsMap.get(agent.id);
    const atData = agentTradeMap.get(agent.id);
    const ptData = paperTradeMap.get(agent.id);
    const winRate = parseFloat(agent.winRate.toString());
    const totalPnl = parseFloat(agent.totalPnl.toString());
    const sortinoRatio = agentStats ? parseFloat(agentStats.sortinoRatio.toString()) : 0;

    // Use AgentTrade data if available, otherwise fall back to PaperTrade, then agent.totalTrades
    const tradeCount = atData?.count || ptData?.count || agent.totalTrades;
    const totalVolume = atData?.volume || ptData?.volume || 0;

    return {
      agentId: agent.id,
      agentName: agent.displayName || agent.name,
      walletAddress: agent.userId,
      avatarUrl: agent.avatarUrl || undefined, // NEW
      twitterHandle: agent.twitterHandle || undefined, // NEW
      chain: agent.chain,
      evmAddress: agent.evmAddress || undefined,
      sortino_ratio: sortinoRatio,
      win_rate: winRate,
      total_pnl: totalPnl,
      trade_count: tradeCount,
      total_volume: totalVolume,
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

// ── Symbol Resolution (DexScreener + cache) ──────────────

/** In-memory cache: mint → resolved symbol. Survives across requests, resets on redeploy. */
const symbolCache = new Map<string, string>();

/** Check if a symbol looks unresolved (UNKNOWN or short mint stub) */
function isUnresolved(symbol: string | null | undefined): boolean {
  if (!symbol || symbol === 'UNKNOWN') return true;
  // If it looks like a truncated mint (6 hex-ish chars), treat as unresolved
  if (symbol.length <= 6 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(symbol)) return true;
  return false;
}

/** Resolve a single symbol synchronously from cache, or return short mint fallback */
function resolveSymbol(symbol: string | null | undefined, mint: string): string {
  if (symbol && symbol !== 'UNKNOWN') return symbol;
  return symbolCache.get(mint) || mint.slice(0, 6);
}

/**
 * Batch-resolve symbols for a list of mints via DexScreener.
 * Populates the in-memory cache. Call before mapping results.
 */
async function batchResolveSymbols(items: { symbol: string | null | undefined; mint: string }[]): Promise<void> {
  const toResolve = items
    .filter((i) => isUnresolved(i.symbol) && !symbolCache.has(i.mint))
    .map((i) => i.mint);

  // Deduplicate
  const unique = [...new Set(toResolve)];
  if (unique.length === 0) return;

  // Resolve in parallel (DexScreener is free, no key needed)
  await Promise.all(
    unique.map(async (mint) => {
      try {
        const price = await getTokenPrice(mint);
        if (price?.symbol) {
          symbolCache.set(mint, price.symbol);
        }
      } catch {
        // Leave uncached — will use short mint fallback
      }
    })
  );
}

// ── Recent Trades ─────────────────────────────────────────

export async function getRecentTrades(limit: number) {
  // Fetch from BOTH tables and merge (AgentTrade may be empty due to signature issues)
  const [agentTrades, paperTrades] = await Promise.all([
    db.agentTrade.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.paperTrade.findMany({
      orderBy: { openedAt: 'desc' },
      take: limit,
    }),
  ]);

  // Batch-resolve unknown symbols from DexScreener
  await batchResolveSymbols([
    ...agentTrades.map((t) => ({ symbol: t.tokenSymbol, mint: t.tokenMint })),
    ...paperTrades.map((t) => ({ symbol: t.tokenSymbol, mint: t.tokenMint })),
  ]);

  // Collect agent IDs for name resolution
  const allAgentIds = new Set([
    ...agentTrades.map((t) => t.agentId),
    ...paperTrades.map((t) => t.agentId),
  ]);
  const nameMap = await buildAgentNameMap([...allAgentIds]);

  // Map PaperTrades FIRST — they have PnL data from FIFO close
  const seenSigs = new Set<string>();
  const mapped: Array<{
    tradeId: string; agentId: string; agentName: string;
    tokenMint: string; tokenSymbol: string; tokenName: string | undefined;
    action: 'BUY' | 'SELL'; quantity: number; entryPrice: number;
    exitPrice: number | undefined; pnl: number; pnlPercent: number;
    txHash: string; timestamp: string; createdAt: string; updatedAt: string;
  }> = [];

  for (const t of paperTrades) {
    const sig = (t.metadata as any)?.signature;
    if (sig) seenSigs.add(sig);

    mapped.push({
      tradeId: t.id,
      agentId: t.agentId,
      agentName: nameMap.get(t.agentId) ?? 'Unknown',
      tokenMint: t.tokenMint,
      tokenSymbol: resolveSymbol(t.tokenSymbol, t.tokenMint),
      tokenName: t.tokenName || undefined,
      action: t.action as 'BUY' | 'SELL',
      quantity: t.tokenAmount ? parseFloat(t.tokenAmount.toString()) : parseFloat(t.amount.toString()),
      entryPrice: t.tokenPrice ? parseFloat(t.tokenPrice.toString()) : parseFloat(t.entryPrice.toString()),
      exitPrice: t.exitPrice ? parseFloat(t.exitPrice.toString()) : undefined,
      pnl: t.pnl ? parseFloat(t.pnl.toString()) : 0,
      pnlPercent: t.pnlPercent ? parseFloat(t.pnlPercent.toString()) : 0,
      txHash: sig || `tx_${t.id}`,
      timestamp: t.openedAt.toISOString(),
      createdAt: t.openedAt.toISOString(),
      updatedAt: (t.closedAt ?? t.openedAt).toISOString(),
    });
  }

  // Add AgentTrades that don't duplicate PaperTrades
  for (const t of agentTrades) {
    if (seenSigs.has(t.signature)) continue;

    mapped.push({
      tradeId: t.id,
      agentId: t.agentId,
      agentName: nameMap.get(t.agentId) ?? 'Unknown',
      tokenMint: t.tokenMint,
      tokenSymbol: resolveSymbol(t.tokenSymbol, t.tokenMint),
      tokenName: t.tokenName || undefined,
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
    });
  }

  // Sort combined results by timestamp desc and apply limit
  mapped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { trades: mapped.slice(0, limit) };
}

// ── Positions ─────────────────────────────────────────────

export async function getAllPositions() {
  const positions = await db.agentPosition.findMany({
    where: {
      quantity: { gt: 0 },
    },
    orderBy: { openedAt: 'desc' },
  });

  // Batch-resolve unknown symbols from DexScreener
  await batchResolveSymbols(
    positions.map((p) => ({ symbol: p.tokenSymbol, mint: p.tokenMint }))
  );

  // Fetch live prices for all unique mints (parallel, with 5s timeout)
  const uniqueMints = [...new Set(positions.map((p) => p.tokenMint))];
  const priceMap = new Map<string, number>();
  await Promise.all(
    uniqueMints.map(async (mint) => {
      try {
        const price = await getTokenPrice(mint);
        if (price?.priceUsd) priceMap.set(mint, price.priceUsd);
      } catch {
        // Use cached DB value if live price fails
      }
    })
  );

  // Gather agent names
  const agentIds = [...new Set(positions.map((p) => p.agentId))];
  const nameMap = await buildAgentNameMap(agentIds);

  return {
    positions: positions.map((pos) => {
      const quantity = parseFloat(pos.quantity.toString());
      const entryPrice = parseFloat(pos.entryPrice.toString());

      // Use live price if available; for dead tokens without price, assume $0
      const livePrice = priceMap.get(pos.tokenMint);
      const currentPrice = livePrice ?? (pos.currentValue
        ? parseFloat(pos.currentValue.toString()) / quantity
        : 0); // Dead tokens with no price → $0, not entryPrice
      const currentValue = quantity * currentPrice;
      const costBasis = quantity * entryPrice;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      return {
        positionId: pos.id,
        agentId: pos.agentId,
        agentName: nameMap.get(pos.agentId) ?? 'Unknown',
        tokenMint: pos.tokenMint,
        tokenSymbol: resolveSymbol(pos.tokenSymbol, pos.tokenMint),
        tokenName: pos.tokenName,
        quantity,
        entryPrice,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
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

// ── Agent Conversations ───────────────────────────────────

export async function getAgentConversations(agentId: string) {
  // Find all conversations this agent has participated in
  const messages = await db.agentMessage.findMany({
    where: { agentId },
    select: { conversationId: true },
    distinct: ['conversationId'],
  });

  const convIds = messages.map((m) => m.conversationId);
  if (convIds.length === 0) return { conversations: [] };

  const conversations = await db.agentConversation.findMany({
    where: { id: { in: convIds } },
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

  // Parallel: participant counts + per-agent message counts
  const [allMsgs, agentMsgCounts] = await Promise.all([
    db.agentMessage.findMany({
      where: { conversationId: { in: convIds } },
      select: { conversationId: true, agentId: true },
      distinct: ['conversationId', 'agentId'],
    }),
    db.agentMessage.groupBy({
      by: ['conversationId'],
      where: { agentId, conversationId: { in: convIds } },
      _count: { id: true },
    }),
  ]);

  const participantCounts = new Map<string, number>();
  for (const m of allMsgs) {
    participantCounts.set(m.conversationId, (participantCounts.get(m.conversationId) ?? 0) + 1);
  }
  const agentMsgMap = new Map(agentMsgCounts.map((c) => [c.conversationId, c._count.id]));

  return {
    conversations: conversations.map((conv) => ({
      conversationId: conv.id,
      topic: conv.topic,
      tokenMint: conv.tokenMint ?? undefined,
      participantCount: participantCounts.get(conv.id) ?? 0,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0]?.message ?? undefined,
      lastMessageAt: conv.messages[0]?.timestamp.toISOString() ?? conv.createdAt.toISOString(),
      agentMessageCount: agentMsgMap.get(conv.id) ?? 0,
      createdAt: conv.createdAt.toISOString(),
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

// ── Epoch Rewards ─────────────────────────────────────────

export async function getEpochRewards() {
  // Get active epoch (or most recent ended/paid epoch)
  const epoch = await db.scannerEpoch.findFirst({
    where: { status: { in: ['ACTIVE', 'ENDED', 'PAID'] } },
    orderBy: { startAt: 'desc' },
  });

  if (!epoch) {
    return {
      epoch: null,
      allocations: [],
      bscAllocations: [],
      treasury: { balance: 0, distributed: 0, available: 0 },
      bscTreasury: { balance: 0, distributed: 0, available: 0 },
      distributions: [],
      bscDistributions: [],
    };
  }

  // Calculate projected allocations from TradingAgents
  let allocations: Array<{
    agentId: string;
    agentName: string;
    walletAddress: string;
    avatarUrl?: string; // NEW
    twitterHandle?: string; // NEW
    rank: number;
    usdcAmount: number;
    multiplier: number;
    txSignature?: string;
    status: 'preview' | 'completed' | 'failed';
  }> = [];

  try {
    const calculated = await treasuryManager.calculateAgentAllocations(epoch.id);
    allocations = calculated.map((a) => ({
      agentId: a.agentId,
      agentName: a.agentName,
      walletAddress: a.walletAddress,
      avatarUrl: a.avatarUrl, // NEW
      twitterHandle: a.twitterHandle, // NEW
      rank: a.rank,
      usdcAmount: a.usdcAmount,
      multiplier: a.multiplier,
      status: 'preview' as const,
    }));
  } catch {
    // No agents or other calculation error — return empty allocations
  }

  // Fetch completed TreasuryAllocation records for this epoch (TradingAgent rewards)
  const completedAllocations = await db.treasuryAllocation.findMany({
    where: {
      epochId: epoch.id,
      tradingAgentId: { not: null },
    },
    orderBy: { rank: 'asc' },
  });

  // If there are completed distributions, use those instead of previews
  if (completedAllocations.length > 0) {
    // Look up agent names
    const agentIds = completedAllocations.map((a) => a.tradingAgentId!);
    const agents = await db.tradingAgent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, displayName: true, userId: true, avatarUrl: true, twitterHandle: true },
    });
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    allocations = completedAllocations.map((a) => {
      const agent = agentMap.get(a.tradingAgentId!);
      return {
        agentId: a.tradingAgentId!,
        agentName: agent?.displayName || agent?.name || 'Unknown',
        walletAddress: agent?.userId || '',
        avatarUrl: agent?.avatarUrl || undefined, // NEW
        twitterHandle: agent?.twitterHandle || undefined, // NEW
        rank: a.rank,
        usdcAmount: Number(a.amount),
        multiplier: RANK_MULTIPLIERS[a.rank] || 0.5,
        txSignature: a.txSignature || undefined,
        status: (a.status === 'completed' ? 'completed' : 'failed') as 'completed' | 'failed',
      };
    });
  }

  // Get treasury balance
  let treasuryBalance = 0;
  try {
    treasuryBalance = await treasuryManager.getBalance();
  } catch {
    // Treasury wallet not loaded — show 0
  }

  // Calculate totals
  const totalDistributed = completedAllocations
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  // Build distributions list (completed ones with tx signatures)
  const distributions = completedAllocations
    .filter((a) => a.status === 'completed' && a.txSignature)
    .map((a) => {
      const agent = allocations.find((al) => al.agentId === a.tradingAgentId);
      return {
        agentName: agent?.agentName || 'Unknown',
        amount: Number(a.amount),
        txSignature: a.txSignature!,
        completedAt: a.completedAt?.toISOString() || a.createdAt.toISOString(),
      };
    });

  // Calculate BSC SMOLT allocations
  let bscAllocations: Array<{
    agentId: string;
    agentName: string;
    evmAddress: string;
    avatarUrl?: string; // NEW
    twitterHandle?: string; // NEW
    rank: number;
    usdcAmount: number;
    multiplier: number;
    status: 'preview' | 'completed' | 'failed';
  }> = [];
  let bscTreasuryStatus = { balance: 0, distributed: 0, available: 0 };

  try {
    const { calculateBSCAllocations, getBSCTreasuryStatus } = await import('../../services/bsc-treasury.service');
    const bscCalc = await calculateBSCAllocations(epoch.id);
    bscAllocations = bscCalc.map((a) => ({ ...a, status: 'preview' as const }));

    const status = await getBSCTreasuryStatus();
    bscTreasuryStatus = {
      balance: status.balance,
      distributed: status.distributed,
      available: status.available,
    };
  } catch (error) {
    console.error('[Arena] BSC allocations error:', error);
  }

  return {
    epoch: {
      id: epoch.id,
      name: epoch.name,
      number: epoch.epochNumber,
      startAt: epoch.startAt.toISOString(),
      endAt: epoch.endAt.toISOString(),
      status: epoch.status,
      usdcPool: Number(epoch.usdcPool),
    },
    allocations,
    bscAllocations,
    treasury: {
      balance: Math.round(treasuryBalance * 100) / 100,
      distributed: Math.round(totalDistributed * 100) / 100,
      available: Math.round((treasuryBalance - totalDistributed) * 100) / 100,
    },
    bscTreasury: bscTreasuryStatus,
    distributions,
    bscDistributions: [],
  };
}

// ── Agent By ID ───────────────────────────────────────────

export async function getAgentById(agentId: string) {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent) return null;

  // Get AgentStats for sortino ratio (agentId is @unique, no orderBy needed)
  const stats = await db.agentStats.findUnique({
    where: { agentId },
  });

  const { getLevelName } = await import('../../services/onboarding.service');

  return {
    agentId: agent.id,
    agentName: agent.displayName || agent.name,
    walletAddress: agent.userId,
    chain: agent.chain,
    evmAddress: agent.evmAddress || undefined,
    xp: agent.xp,
    level: agent.level,
    levelName: getLevelName(agent.level),
    sortino_ratio: stats ? parseFloat(stats.sortinoRatio.toString()) : 0,
    win_rate: parseFloat(agent.winRate.toString()),
    total_pnl: parseFloat(agent.totalPnl.toString()),
    trade_count: agent.totalTrades,
    total_volume: 0,
    average_win: 0,
    average_loss: 0,
    max_win: 0,
    max_loss: 0,
    bio: agent.bio,
    avatarUrl: agent.avatarUrl,
    twitterHandle: agent.twitterHandle,
    status: agent.status,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

// ── Agent Trades By ID ────────────────────────────────────

export async function getAgentTradesById(agentId: string, limit: number) {
  const [agentTrades, paperTrades] = await Promise.all([
    db.agentTrade.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.paperTrade.findMany({
      where: { agentId },
      orderBy: { openedAt: 'desc' },
      take: limit,
    }),
  ]);

  // Batch-resolve unknown symbols
  await batchResolveSymbols([
    ...agentTrades.map((t) => ({ symbol: t.tokenSymbol, mint: t.tokenMint })),
    ...paperTrades.map((t) => ({ symbol: t.tokenSymbol, mint: t.tokenMint })),
  ]);

  const mapped = agentTrades.map((t) => ({
    tradeId: t.id,
    agentId: t.agentId,
    tokenMint: t.tokenMint,
    tokenSymbol: resolveSymbol(t.tokenSymbol, t.tokenMint),
    action: t.action as 'BUY' | 'SELL',
    quantity: parseFloat(t.tokenAmount.toString()),
    entryPrice: parseFloat(t.solAmount.toString()),
    exitPrice: undefined as number | undefined,
    pnl: 0,
    pnlPercent: 0,
    txHash: t.signature,
    timestamp: t.createdAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.createdAt.toISOString(),
  }));

  const seenSigs = new Set(agentTrades.map((t) => t.signature));

  for (const t of paperTrades) {
    const sig = (t.metadata as any)?.signature;
    if (sig && seenSigs.has(sig)) continue;

    mapped.push({
      tradeId: t.id,
      agentId: t.agentId,
      tokenMint: t.tokenMint,
      tokenSymbol: resolveSymbol(t.tokenSymbol, t.tokenMint),
      action: t.action as 'BUY' | 'SELL',
      quantity: t.tokenAmount ? parseFloat(t.tokenAmount.toString()) : parseFloat(t.amount.toString()),
      entryPrice: parseFloat(t.entryPrice.toString()),
      exitPrice: t.exitPrice ? parseFloat(t.exitPrice.toString()) : undefined,
      pnl: t.pnl ? parseFloat(t.pnl.toString()) : 0,
      pnlPercent: t.pnlPercent ? parseFloat(t.pnlPercent.toString()) : 0,
      txHash: sig || `tx_${t.id}`,
      timestamp: t.openedAt.toISOString(),
      createdAt: t.openedAt.toISOString(),
      updatedAt: (t.closedAt ?? t.openedAt).toISOString(),
    });
  }

  mapped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { trades: mapped.slice(0, limit) };
}

// ── Agent Positions By ID ─────────────────────────────────

export async function getAgentPositionsById(agentId: string) {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
    select: { userId: true, name: true, displayName: true },
  });

  if (!agent) return { positions: [] };

  const positions = await db.agentPosition.findMany({
    where: {
      agentId,
      quantity: { gt: 0 },
    },
    orderBy: { openedAt: 'desc' },
  });

  await batchResolveSymbols(
    positions.map((p) => ({ symbol: p.tokenSymbol, mint: p.tokenMint }))
  );

  // Fetch live prices for all unique mints
  const uniqueMints = [...new Set(positions.map((p) => p.tokenMint))];
  const priceMap = new Map<string, number>();
  await Promise.all(
    uniqueMints.map(async (mint) => {
      try {
        const price = await getTokenPrice(mint);
        if (price?.priceUsd) priceMap.set(mint, price.priceUsd);
      } catch {
        // Use cached DB value if live price fails
      }
    })
  );

  const agentName = agent.displayName || agent.name;

  return {
    positions: positions.map((pos) => {
      const quantity = parseFloat(pos.quantity.toString());
      const entryPrice = parseFloat(pos.entryPrice.toString());

      const livePrice = priceMap.get(pos.tokenMint);
      const currentPrice = livePrice ?? (pos.currentValue
        ? parseFloat(pos.currentValue.toString()) / quantity
        : 0); // Dead tokens with no price → $0
      const currentValue = quantity * currentPrice;
      const costBasis = quantity * entryPrice;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      return {
        positionId: pos.id,
        agentId: pos.agentId,
        agentName,
        tokenMint: pos.tokenMint,
        tokenSymbol: resolveSymbol(pos.tokenSymbol, pos.tokenMint),
        tokenName: pos.tokenName,
        quantity,
        entryPrice,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
        openedAt: pos.openedAt.toISOString(),
      };
    }),
  };
}

// Re-export RANK_MULTIPLIERS for use in getEpochRewards
const RANK_MULTIPLIERS: { [key: number]: number } = {
  1: 2.0,
  2: 1.5,
  3: 1.0,
  4: 0.75,
  5: 0.5,
};
