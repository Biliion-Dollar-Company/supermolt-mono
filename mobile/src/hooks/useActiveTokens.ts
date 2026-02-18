import { useState, useEffect, useCallback, useRef } from 'react';
import { getActiveTokens } from '@/lib/api/client';
import type { ActiveToken } from '@/types/arena';

export function useActiveTokens(hours = 24) {
  const [tokens, setTokens] = useState<ActiveToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const data = await getActiveTokens(hours);
      setTokens(data);
    } catch (err) {
      // Use console.warn instead of console.error to avoid red screen overlay in dev
      console.warn('[useActiveTokens] Fetch failed:', err instanceof Error ? err.message : err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  return { tokens, isLoading, error, refresh: fetch };
}
