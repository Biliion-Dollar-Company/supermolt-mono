/**
 * usePnLHistory Hook - PnL chart data
 * Derives cumulative PnL from agent trades via arena API
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { getRecentTrades } from '@/lib/api/client';

export interface PnLDataPoint {
  timestamp: number;
  value: number; // cumulative PnL
}

export type Timeframe = '1D' | '3D' | '7D' | '30D';

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '3D': 3 * 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000,
};

function buildPnLCurve(
  trades: { timestamp: string; pnl: number }[],
  timeframe: Timeframe,
): PnLDataPoint[] {
  const now = Date.now();
  const cutoff = now - TIMEFRAME_MS[timeframe];

  // Filter to timeframe and sort oldest first
  const filtered = trades
    .filter((t) => new Date(t.timestamp).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  if (filtered.length === 0) {
    // Return flat line at 0
    return [
      { timestamp: cutoff, value: 0 },
      { timestamp: now, value: 0 },
    ];
  }

  // Build cumulative PnL curve
  let cumulative = 0;
  const points: PnLDataPoint[] = [
    { timestamp: cutoff, value: 0 }, // start at 0
  ];

  for (const trade of filtered) {
    cumulative += trade.pnl;
    points.push({
      timestamp: new Date(trade.timestamp).getTime(),
      value: cumulative,
    });
  }

  // Add current point
  points.push({ timestamp: now, value: cumulative });

  return points;
}

export function usePnLHistory() {
  const [timeframe, setTimeframe] = useState<Timeframe>('3D');
  const [isLoading, setIsLoading] = useState(true);
  const [trades, setTrades] = useState<
    { timestamp: string; pnl: number }[]
  >([]);

  const fetchTrades = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getRecentTrades(200);
      setTrades(
        data.map((t) => ({
          timestamp: t.timestamp,
          pnl: t.pnl ?? 0,
        })),
      );
    } catch (err) {
      console.error('[usePnLHistory] Fetch failed:', err);
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const data = useMemo(
    () => buildPnLCurve(trades, timeframe),
    [trades, timeframe],
  );

  const changeTimeframe = useCallback((newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
  }, []);

  const currentValue = data[data.length - 1]?.value ?? 0;
  const startValue = data[0]?.value ?? 0;
  const pnlChange = currentValue - startValue;
  const pnlChangePercent =
    startValue !== 0 ? (pnlChange / Math.abs(startValue)) * 100 : 0;

  return {
    data,
    timeframe,
    changeTimeframe,
    isLoading,
    currentValue,
    pnlChange,
    pnlChangePercent,
  };
}
