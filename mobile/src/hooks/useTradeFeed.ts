import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getRecentTrades } from '@/lib/api/client';
import { useFeedStore } from '@/store/feed';
import type { Trade } from '@/types/arena';

export interface FeedItem {
  id: string;
  type: 'trade' | 'tp_hit' | 'sl_hit' | 'alert';
  title: string;
  description: string;
  time: string;
  pnl?: number;
  action?: 'BUY' | 'SELL';
  agentName?: string;
  tokenSymbol?: string;
}

function mapTradeToFeedItem(trade: Trade): FeedItem {
  return {
    id: trade.tradeId,
    type: 'trade',
    title: `${trade.action === 'BUY' ? 'Bought' : 'Sold'} ${trade.tokenSymbol || 'Token'}`,
    description: `${trade.quantity?.toFixed(0)} tokens at $${trade.entryPrice?.toFixed(6)}`,
    time: trade.timestamp
      ? new Date(trade.timestamp).toLocaleTimeString()
      : 'Recently',
    pnl: trade.pnl,
    action: trade.action,
    agentName: trade.agentName,
    tokenSymbol: trade.tokenSymbol,
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
      const trades = await getRecentTrades(50);
      setApiItems(trades.map(mapTradeToFeedItem));
    } catch (err) {
      console.error('[useTradeFeed] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    intervalRef.current = setInterval(fetchFeed, 10_000);
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
