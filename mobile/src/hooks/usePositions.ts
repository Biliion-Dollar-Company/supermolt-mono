import { useState, useCallback, useEffect } from 'react';
import { getAllPositions } from '@/lib/api/client';
import type { PositionData } from '@/components/trading';

export function usePositions() {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllPositions();

      const mapped: PositionData[] = data.map((p) => ({
        id: p.positionId,
        mint: p.tokenMint,
        ticker: p.tokenSymbol,
        tokenName: p.tokenSymbol,
        entryMcap: 0,
        entrySolValue: p.entryPrice * p.quantity,
        entryTime: p.openedAt,
        currentMcap: 0,
        multiplier: p.entryPrice > 0 ? p.currentPrice / p.entryPrice : 1,
        pnlPct: p.pnlPercent,
        pnlSol: p.pnl,
        peakPnlPct: p.pnlPercent,
        nextTarget: 0,
        targetProgress: 0,
        targetsHit: [],
      }));

      setPositions(mapped);
    } catch (err) {
      console.error('[usePositions] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      // Keep existing positions on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const totalValue = positions.reduce(
    (sum, p) => sum + p.entrySolValue + p.pnlSol,
    0,
  );
  const totalPnl = positions.reduce((sum, p) => sum + p.pnlSol, 0);
  const totalInvested = positions.reduce((sum, p) => sum + p.entrySolValue, 0);
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

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
