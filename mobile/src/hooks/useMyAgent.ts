import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useMyAgentStore, Agent } from '@/store/agent';

export function useMyAgent() {
  const { agent, hasChecked, setAgent, setHasChecked } = useMyAgentStore();
  const [isLoading, setIsLoading] = useState(!hasChecked);
  const [error, setError] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetch<Record<string, unknown>[]>('/agents');
      const agents = Array.isArray(data) ? data : [];

      if (agents.length > 0) {
        setAgent(agents[0]);
      } else {
        setAgent(null);
        setHasChecked(true);
      }
    } catch (err) {
      console.error('[useMyAgent] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch agent');
      setHasChecked(true);
    } finally {
      setIsLoading(false);
    }
  }, [setAgent, setHasChecked]);

  const updateStatus = useCallback(
    async (status: 'ACTIVE' | 'PAUSED') => {
      if (!agent) return;
      try {
        const updated = await apiFetch<Record<string, unknown>>(
          `/agents/${agent.id}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          },
        );
        setAgent(updated);
      } catch (err) {
        console.error('[useMyAgent] Status update failed:', err);
        throw err;
      }
    },
    [agent, setAgent],
  );

  // Fetch on mount if we haven't checked yet
  useEffect(() => {
    if (!hasChecked) {
      fetchAgent();
    }
  }, [hasChecked]);

  return {
    agent,
    hasChecked,
    isLoading,
    error,
    refresh: fetchAgent,
    updateStatus,
  };
}
