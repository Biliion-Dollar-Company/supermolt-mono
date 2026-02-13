import { useState, useCallback, useEffect, useRef } from 'react';
import { getActiveVotes, getAllVotes } from '@/lib/api/client';
import type { Vote } from '@/types/arena';

export function useVotes(mode: 'active' | 'all' = 'active') {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchVotes = useCallback(async () => {
    try {
      setError(null);
      const data = mode === 'active' ? await getActiveVotes() : await getAllVotes();
      setVotes(data);
    } catch (err) {
      console.error('[useVotes] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch votes');
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchVotes();
    intervalRef.current = setInterval(fetchVotes, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchVotes]);

  return { votes, isLoading, error, refresh: fetchVotes };
}
