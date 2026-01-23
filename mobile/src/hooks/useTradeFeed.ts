import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://devprint-v2-production.up.railway.app';

interface FeedItem {
  id: string;
  type: 'trade' | 'tp_hit' | 'sl_hit' | 'alert';
  title: string;
  description: string;
  time: string;
  pnl?: number;
}

export function useTradeFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_URL}/api/trading/history?limit=50`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const mapped: FeedItem[] = data.data.map((trade: any) => ({
          id: trade.id || trade.signature,
          type: trade.exit_reason === 'take_profit'
            ? 'tp_hit'
            : trade.exit_reason === 'stop_loss'
            ? 'sl_hit'
            : 'trade',
          title: `${trade.action === 'buy' ? 'Bought' : 'Sold'} ${trade.symbol || 'Token'}`,
          description: trade.notes || `${trade.quantity?.toFixed(0)} tokens at ${trade.price?.toFixed(8)}`,
          time: trade.timestamp
            ? new Date(trade.timestamp).toLocaleTimeString()
            : 'Recently',
          pnl: trade.pnl_sol,
        }));

        setItems(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, []);

  return {
    items,
    isLoading,
    error,
    refresh: fetchFeed,
  };
}
