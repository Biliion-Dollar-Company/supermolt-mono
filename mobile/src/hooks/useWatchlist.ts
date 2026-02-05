/**
 * useWatchlist Hook - Watchlist tokens for home screen
 * Provides list of tokens agent is monitoring
 */

import { useState, useCallback } from 'react';

export interface WatchlistToken {
  symbol: string;
  mint?: string;
  iconUrl?: string;
}

// Mock watchlist data
const MOCK_WATCHLIST: WatchlistToken[] = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'PYTH', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' },
  { symbol: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { symbol: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
];

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistToken[]>(MOCK_WATCHLIST);
  const [isLoading, setIsLoading] = useState(false);

  const addToken = useCallback((token: WatchlistToken) => {
    setWatchlist(prev => {
      if (prev.some(t => t.symbol === token.symbol)) return prev;
      return [...prev, token];
    });
  }, []);

  const removeToken = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(t => t.symbol !== symbol));
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
  }, []);

  return {
    watchlist,
    isLoading,
    addToken,
    removeToken,
    refresh,
  };
}
