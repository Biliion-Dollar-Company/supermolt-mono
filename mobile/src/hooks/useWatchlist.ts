/**
 * useWatchlist Hook - Watchlist tokens for home screen
 * Derives token list from open positions via arena API
 */

import { useState, useCallback, useEffect } from 'react';
import { getAllPositions } from '@/lib/api/client';

export interface WatchlistToken {
  symbol: string;
  mint?: string;
  iconUrl?: string;
}

// Fallback tokens shown when no positions exist
const DEFAULT_TOKENS: WatchlistToken[] = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
];

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistToken[]>(DEFAULT_TOKENS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWatchlist = useCallback(async () => {
    try {
      setIsLoading(true);
      const positions = await getAllPositions();

      if (positions.length > 0) {
        // Deduplicate by tokenMint, keep unique symbols
        const seen = new Set<string>();
        const tokens: WatchlistToken[] = [];

        for (const pos of positions) {
          if (!seen.has(pos.tokenMint)) {
            seen.add(pos.tokenMint);
            tokens.push({
              symbol: pos.tokenSymbol,
              mint: pos.tokenMint,
            });
          }
        }

        setWatchlist(tokens.length > 0 ? tokens : DEFAULT_TOKENS);
      }
    } catch (err) {
      console.error('[useWatchlist] Fetch failed:', err);
      // Keep existing watchlist on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const addToken = useCallback((token: WatchlistToken) => {
    setWatchlist((prev) => {
      if (prev.some((t) => t.symbol === token.symbol)) return prev;
      return [...prev, token];
    });
  }, []);

  const removeToken = useCallback((symbol: string) => {
    setWatchlist((prev) => prev.filter((t) => t.symbol !== symbol));
  }, []);

  return {
    watchlist,
    isLoading,
    addToken,
    removeToken,
    refresh: fetchWatchlist,
  };
}
