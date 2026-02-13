import { useState, useCallback, useEffect } from 'react';
import { getArenaTasks } from '@/lib/api/client';
import type { AgentTaskType } from '@/types/arena';

export function useArenaTasks(tokenMint?: string) {
  const [tasks, setTasks] = useState<AgentTaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const data = await getArenaTasks(tokenMint);
      setTasks(data);
    } catch (err) {
      console.error('[useArenaTasks] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  }, [tokenMint]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { tasks, isLoading, error, refresh: fetch };
}
