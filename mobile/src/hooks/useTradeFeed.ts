import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getRecentTrades, getConversations, getArenaTasks, getActiveVotes } from '@/lib/api/client';
import { useFeedStore } from '@/store/feed';
import type { Trade, Conversation, AgentTaskType, Vote } from '@/types/arena';

export type ActivityType = 'trade' | 'conversation' | 'task' | 'vote';

export interface FeedItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  time: string;
  timestamp: number; // epoch ms for sorting
  pnl?: number;
  action?: 'BUY' | 'SELL';
  agentName?: string;
  tokenSymbol?: string;
  meta?: Record<string, string | number>;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function mapTrade(t: Trade): FeedItem {
  return {
    id: `trade-${t.tradeId}`,
    type: 'trade',
    title: `${t.action === 'BUY' ? 'Bought' : 'Sold'} ${t.tokenSymbol || 'Token'}`,
    description: t.agentName
      ? `by ${t.agentName}`
      : `${t.quantity?.toFixed(0) ?? '?'} tokens`,
    time: t.timestamp ? relativeTime(t.timestamp) : 'now',
    timestamp: t.timestamp ? new Date(t.timestamp).getTime() : Date.now(),
    pnl: t.pnl,
    action: t.action,
    agentName: t.agentName,
    tokenSymbol: t.tokenSymbol,
  };
}

function mapConversation(c: Conversation): FeedItem {
  return {
    id: `conv-${c.conversationId}`,
    type: 'conversation',
    title: c.topic || `Discussion on $${c.tokenSymbol || 'token'}`,
    description: `${c.participantCount} agents · ${c.messageCount} messages`,
    time: c.lastMessageAt ? relativeTime(c.lastMessageAt) : relativeTime(c.createdAt),
    timestamp: new Date(c.lastMessageAt || c.createdAt).getTime(),
    tokenSymbol: c.tokenSymbol ?? undefined,
    meta: { participants: c.participantCount, messages: c.messageCount },
  };
}

function mapTask(t: AgentTaskType): FeedItem {
  const completedBy = t.completions.filter((c) => c.status === 'VALIDATED');
  const desc = completedBy.length > 0
    ? `${completedBy.length} completed · +${t.xpReward} XP`
    : `+${t.xpReward} XP · ${t.status.toLowerCase()}`;
  return {
    id: `task-${t.taskId}`,
    type: 'task',
    title: t.title,
    description: desc,
    time: relativeTime(t.createdAt),
    timestamp: new Date(t.createdAt).getTime(),
    tokenSymbol: t.tokenSymbol ?? undefined,
    meta: { xp: t.xpReward, completions: completedBy.length },
  };
}

function mapVote(v: Vote): FeedItem {
  const total = v.yesVotes + v.noVotes;
  return {
    id: `vote-${v.voteId}`,
    type: 'vote',
    title: `${v.action} $${v.tokenSymbol}`,
    description: `${v.yesVotes} yes · ${v.noVotes} no${total > 0 ? ` · ${total} votes` : ''}`,
    time: relativeTime(v.createdAt),
    timestamp: new Date(v.createdAt).getTime(),
    action: v.action,
    agentName: v.proposerName,
    tokenSymbol: v.tokenSymbol,
    meta: { yes: v.yesVotes, no: v.noVotes, status: v.status },
  };
}

export function useTradeFeed() {
  const [apiItems, setApiItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const realtimeItems = useFeedStore((s) => s.realtimeItems);

  const fetchFeed = useCallback(async () => {
    try {
      setError(null);
      const [trades, conversations, tasks, votes] = await Promise.all([
        getRecentTrades(50).catch(() => [] as Trade[]),
        getConversations().catch(() => [] as Conversation[]),
        getArenaTasks().catch(() => [] as AgentTaskType[]),
        getActiveVotes().catch(() => [] as Vote[]),
      ]);

      const all: FeedItem[] = [
        ...trades.map(mapTrade),
        ...conversations.map(mapConversation),
        ...tasks.map(mapTask),
        ...votes.map(mapVote),
      ];

      // Sort newest first
      all.sort((a, b) => b.timestamp - a.timestamp);

      setApiItems(all);
    } catch (err) {
      console.error('[useTradeFeed] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    intervalRef.current = setInterval(fetchFeed, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFeed]);

  // Merge realtime items (WS) at top, then API items (deduped by id)
  const items = useMemo(() => {
    const apiIds = new Set(apiItems.map((i) => i.id));
    const uniqueRealtime = realtimeItems.filter((i) => !apiIds.has(i.id));
    return [...uniqueRealtime, ...apiItems];
  }, [apiItems, realtimeItems]);

  return {
    items,
    isLoading,
    error,
    refresh: fetchFeed,
  };
}
