import { useState, useCallback, useEffect } from 'react';
import { getConversations } from '@/lib/api/client';
import type { Conversation } from '@/types/arena';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error('[useConversations] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { conversations, isLoading, error, refresh: fetch };
}
