import { useState, useCallback, useEffect } from 'react';
import { getEpochRewards } from '@/lib/api/client';
import type { EpochReward } from '@/types/arena';

export function useEpochRewards() {
  const [rewards, setRewards] = useState<EpochReward | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const data = await getEpochRewards();
      setRewards(data);
    } catch (err) {
      console.error('[useEpochRewards] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch epoch rewards');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rewards, isLoading, error, refresh: fetch };
}
