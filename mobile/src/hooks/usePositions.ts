import { useCallback, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolio';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://devprint-v2-production.up.railway.app';

export function usePositions() {
  const {
    positions,
    totalValue,
    totalPnl,
    totalPnlPct,
    isLoading,
    error,
    updatePositions,
    setLoading,
    setError,
  } = usePortfolioStore();

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/trading/holdings`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Map API response to our Position type
        const mapped = data.data.map((h: any) => ({
          id: h.id || h.token_mint,
          tokenMint: h.token_mint,
          tokenSymbol: h.symbol || 'UNKNOWN',
          tokenName: h.name || h.symbol || 'Unknown Token',
          entryPrice: h.entry_price || 0,
          currentPrice: h.current_price || 0,
          quantity: h.quantity || 0,
          entrySol: h.entry_sol || h.invested_sol || 0,
          currentValueSol: h.current_value_sol || 0,
          unrealizedPnlPct: h.unrealized_pnl_pct || 0,
          unrealizedPnlSol: h.unrealized_pnl_sol || 0,
          targetsHit: h.targets_hit || [],
          nextTargetMultiplier: h.next_target_multiplier,
          targetProgress: h.target_progress,
          buyCount: h.buy_count || 1,
          sellCount: h.sell_count || 0,
          createdAt: h.created_at || new Date().toISOString(),
        }));

        updatePositions(mapped);
      } else {
        // No positions or error
        updatePositions([]);
      }
    } catch (err) {
      console.error('Failed to fetch positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    }
  }, [updatePositions, setLoading, setError]);

  // Fetch on mount
  useEffect(() => {
    fetchPositions();
  }, []);

  return {
    positions,
    totalValue,
    pnl: {
      value: totalPnl,
      percentage: totalPnlPct,
    },
    isLoading,
    error,
    refresh: fetchPositions,
  };
}
