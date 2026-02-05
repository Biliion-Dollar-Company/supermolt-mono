import { useCallback, useEffect } from 'react';
import { useAgentLiveStore } from '@/store/agentLive';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://devprint-v2-production.up.railway.app';

export function useAgent() {
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

      // Fetch metrics for stats
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
        // Pause agent
        const response = await fetch(`${API_URL}/api/trading/pause`, {
          method: 'POST',
        });

        if (response.ok) {
          setStatus('paused');
        }
      } else {
        // Resume agent
        const response = await fetch(`${API_URL}/api/trading/resume`, {
          method: 'POST',
        });

        if (response.ok) {
          setStatus('active');
        }
      }
    } catch (err) {
      console.error('Failed to toggle agent:', err);
    } finally {
      setLoading(false);
    }
  }, [status, setStatus, setLoading]);

  // Fetch status on mount
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
