import { useState, useCallback, useEffect } from 'react';
import { getMyAgent } from '@/lib/api/client';
import { useMyAgentStore } from '@/store/agent';
import { useAuthStore } from '@/store/auth';

export function useMyAgent() {
  const { agent, hasChecked, setAgent, setHasChecked } = useMyAgentStore();
  const setAgentMe = useAuthStore((s) => s.setAgentMe);
  const [isLoading, setIsLoading] = useState(!hasChecked);
  const [error, setError] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getMyAgent();

      if (data?.agent) {
        // Store basic agent info in agent store
        setAgent({
          id: data.agent.id,
          userId: data.agent.pubkey || '',
          archetypeId: '',
          name: data.agent.name,
          status: 'ACTIVE',
          paperBalance: 0,
          totalTrades: data.stats?.totalTrades ?? 0,
          winRate: data.stats?.winRate ?? 0,
          totalPnl: data.stats?.totalPnl ?? 0,
          config: {},
          createdAt: data.agent.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Store full profile data in auth store
        setAgentMe({
          agent: data.agent,
          stats: data.stats ?? null,
          onboarding: data.onboarding ?? { tasks: [], completedTasks: 0, totalTasks: 0, progress: 0 },
        });
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
  }, [setAgent, setHasChecked, setAgentMe]);

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
  };
}
