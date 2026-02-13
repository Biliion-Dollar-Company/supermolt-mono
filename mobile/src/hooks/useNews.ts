import { useState, useCallback, useEffect, useRef } from 'react';
import { getNewsFeed } from '@/lib/api/client';
import type { NewsItem } from '@/types/arena';

export function useNews(limit = 10) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchNews = useCallback(async () => {
    try {
      setError(null);
      const items = await getNewsFeed(limit);
      setNews(items);
    } catch (err) {
      console.error('[useNews] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchNews();
    intervalRef.current = setInterval(fetchNews, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNews]);

  return { news, isLoading, error, refresh: fetchNews };
}
