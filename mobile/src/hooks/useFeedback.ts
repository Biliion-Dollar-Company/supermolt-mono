import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useMyAgentStore, FeedbackStats } from '@/store/agent';

interface SubmitFeedbackParams {
  tradeId: string;
  rating: 'GOOD' | 'BAD' | 'SKIP';
  tags?: string[];
  note?: string;
}

export function useFeedback() {
  const agent = useMyAgentStore((s) => s.agent);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = useCallback(
    async ({ tradeId, rating, tags, note }: SubmitFeedbackParams) => {
      if (!agent) throw new Error('No agent');

      try {
        setIsLoading(true);
        setError(null);

        await apiFetch(`/trades/${agent.id}/${tradeId}/feedback`, {
          method: 'POST',
          body: JSON.stringify({ rating, tags, note }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit feedback';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [agent?.id],
  );

  const fetchStats = useCallback(async () => {
    if (!agent) return;

    try {
      const data = await apiFetch<FeedbackStats>(
        `/trades/${agent.id}/feedback/stats`,
      );
      setStats(data);
    } catch (err) {
      console.error('[useFeedback] Stats fetch failed:', err);
    }
  }, [agent?.id]);

  return {
    submitFeedback,
    fetchStats,
    stats,
    isLoading,
    error,
  };
}
