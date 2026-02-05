import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useMyAgentStore } from '@/store/agent';

export interface Trade {
  id: string;
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number | null;
  amount: number;
  pnl: number | null;
  pnlPercent: number | null;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  signalSource: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  // Feedback info (from GET /trades/:agentId/:tradeId)
  feedback?: {
    rating: 'GOOD' | 'BAD' | 'SKIP';
    tags: string[];
    note?: string;
  } | null;
}

export function useTrades() {
  const agent = useMyAgentStore((s) => s.agent);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!agent) return;

    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetch<{ trades?: Trade[]; data?: Trade[]; total?: number }>(
        `/trades/${agent.id}?limit=50`,
      );

      const tradeList = data.trades || data.data || (Array.isArray(data) ? data : []);
      setTrades(tradeList as Trade[]);
      setTotal(data.total || (tradeList as Trade[]).length);
    } catch (err) {
      console.error('[useTrades] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trades');
    } finally {
      setIsLoading(false);
    }
  }, [agent?.id]);

  useEffect(() => {
    if (agent) {
      fetchTrades();
    } else {
      setTrades([]);
      setIsLoading(false);
    }
  }, [agent?.id]);

  return {
    trades,
    total,
    isLoading,
    error,
    refresh: fetchTrades,
  };
}
