import { useState, useCallback, useEffect } from 'react';
import { useAgentLiveStore } from '@/store/agentLive';
import { getAgentById } from '@/lib/api/client';
import type { Agent } from '@/types/arena';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://devprint-v2-production.up.railway.app';

/**
 * Hook for live agent dashboard status (home screen)
 */
export function useAgentLive() {
  const {
    status,
    version,
    stats,
    decisions,
    isLoading,
    setStatus,
    setStats,
    setLoading,
  } = useAgentLiveStore();

  const fetchAgentStatus = useCallback(async () => {
    try {
      setLoading(true);

      const metricsResponse = await fetch(`${API_URL}/api/metrics`);

      if (metricsResponse.ok) {
        const data = await metricsResponse.json();

        if (data.success && data.data) {
          setStats({
            todayTrades: data.data.trades_today || 0,
            winRate: data.data.win_rate || 0,
            todayPnl: data.data.pnl_today || 0,
            avgHoldTime: data.data.avg_hold_time || '0m',
          });
        }
      }

      setStatus('active');
    } catch (err) {
      console.error('Failed to fetch agent status:', err);
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, [setStatus, setStats, setLoading]);

  const toggleAgent = useCallback(async () => {
    try {
      setLoading(true);

      if (status === 'active') {
        const response = await fetch(`${API_URL}/api/trading/pause`, {
          method: 'POST',
        });
        if (response.ok) setStatus('paused');
      } else {
        const response = await fetch(`${API_URL}/api/trading/resume`, {
          method: 'POST',
        });
        if (response.ok) setStatus('active');
      }
    } catch (err) {
      console.error('Failed to toggle agent:', err);
    } finally {
      setLoading(false);
    }
  }, [status, setStatus, setLoading]);

  useEffect(() => {
    fetchAgentStatus();
  }, []);

  return {
    status,
    version,
    stats,
    decisions,
    isLoading,
    toggleAgent,
    refresh: fetchAgentStatus,
  };
}

/**
 * Hook for fetching a specific agent by ID from the arena API (agent detail screen)
 */
export function useAgent(agentId?: string) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!agentId) return;
    try {
      setError(null);
      setIsLoading(true);
      const data = await getAgentById(agentId);
      setAgent(data);
    } catch (err) {
      console.error('[useAgent] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch agent');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { agent, isLoading, error, refresh: fetch };
}
