import { useState, useCallback, useEffect, useRef } from 'react';
import { getLeaderboard, getXPLeaderboard } from '@/lib/api/client';
import type { Agent, XPLeaderboardEntry } from '@/types/arena';

export type LeaderboardMode = 'trades' | 'xp';

// Unified row type so arena can render both modes with same component
export interface LeaderboardAgent {
  agentId: string;
  agentName: string;
  sortino_ratio?: number;
  win_rate?: number;
  total_pnl?: number;
  trade_count?: number;
  xp?: number;
  level?: number;
  levelName?: string;
}

export function useLeaderboard(mode: LeaderboardMode = 'trades') {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      if (mode === 'xp') {
        const data = await getXPLeaderboard();
        setAgents(data.map((e) => ({
          agentId: e.agentId,
          agentName: e.name,
          xp: e.xp,
          level: e.level,
          levelName: e.levelName,
          trade_count: e.totalTrades,
        })));
      } else {
        const data = await getLeaderboard();
        setAgents(data.map((a) => ({
          agentId: a.agentId,
          agentName: a.agentName,
          sortino_ratio: a.sortino_ratio,
          win_rate: a.win_rate,
          total_pnl: a.total_pnl,
          trade_count: a.trade_count,
        })));
      }
    } catch (err) {
      console.error('[useLeaderboard] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return { agents, isLoading, error, refresh: fetchData };
}
