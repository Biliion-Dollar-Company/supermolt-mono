import { useState, useCallback, useEffect } from 'react';
import { getArenaTokens } from '@/lib/api/client';
import type { TrendingToken } from '@/types/arena';

export function useTrendingTokens() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const data = await getArenaTokens();
      setTokens(data);
    } catch (err) {
      console.error('[useTrendingTokens] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trending tokens');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { tokens, isLoading, error, refresh: fetch };
}
