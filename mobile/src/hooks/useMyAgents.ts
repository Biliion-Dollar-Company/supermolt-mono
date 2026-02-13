import { useState, useCallback, useEffect } from 'react';
import { getMyAgents, switchAgent, storeTokens, getMyAgent } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { successNotification, mediumImpact, errorNotification } from '@/lib/haptics';
import type { UserAgent } from '@/types/arena';

export function useMyAgents() {
  const { agents, activeAgentId, setAgents, setActiveAgentId, setAgentMe } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const data = await getMyAgents();
      setAgents(data);
    } catch (err) {
      console.error('[useMyAgents] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  }, [setAgents]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const switchToAgent = useCallback(async (agentId: string) => {
    if (agentId === activeAgentId) return;

    try {
      setIsSwitching(true);
      setError(null);

      // Call switch endpoint — gets new JWT for target agent
      const result = await switchAgent(agentId);

      // Store new tokens
      await storeTokens({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });

      setActiveAgentId(agentId);
      successNotification();

      // Refresh /arena/me for the new agent
      try {
        const meData = await getMyAgent();
        if (meData?.agent) {
          setAgentMe({
            agent: meData.agent,
            stats: meData.stats ?? null,
            onboarding: meData.onboarding ?? { tasks: [], completedTasks: 0, totalTasks: 0, progress: 0 },
          });
        }
      } catch {
        // Non-critical
      }

      console.log('[useMyAgents] Switched to agent:', agentId);
    } catch (err) {
      console.error('[useMyAgents] Switch failed:', err);
      errorNotification();
      setError(err instanceof Error ? err.message : 'Failed to switch agent');
    } finally {
      setIsSwitching(false);
    }
  }, [activeAgentId, setActiveAgentId, setAgentMe]);

  return {
    agents,
    activeAgentId,
    isLoading,
    isSwitching,
    error,
    refresh: fetchAgents,
    switchToAgent,
  };
}
