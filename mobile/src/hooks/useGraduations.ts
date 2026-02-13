import { useState, useCallback, useEffect, useRef } from 'react';
import { getBSCMigrations } from '@/lib/api/client';
import type { BSCTokenGraduation } from '@/types/arena';

export function useGraduations(limit = 10) {
  const [graduations, setGraduations] = useState<BSCTokenGraduation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchGraduations = useCallback(async () => {
    try {
      const data = await getBSCMigrations(limit);
      setGraduations(data);
    } catch (err) {
      console.error('[useGraduations] Fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchGraduations();
    intervalRef.current = setInterval(fetchGraduations, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchGraduations]);

  return { graduations, isLoading, refresh: fetchGraduations };
}
