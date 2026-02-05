/**
 * Hook: usePonzinomicsTokens
 * Fetch trending tokens and token-specific data from Ponzinomics
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';

export interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  verified?: boolean;
}

export interface TokenSignal {
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  reason: string;
  priceTarget?: number;
  stopLoss?: number;
  updatedAt: string;
}

export interface TokenAnalytics {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  liquidityUSD: number;
}

interface TokenDetails {
  metadata: Token;
  signal: TokenSignal;
  analytics: TokenAnalytics;
}

export const useTrendingTokens = (limit = 10) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrendingTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetch<Token[]>(
        `/ponzinomics/tokens/trending?limit=${limit}`
      );

      setTokens(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch trending tokens';
      setError(message);
      console.error('[useTrendingTokens]', message);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTrendingTokens();
  }, [fetchTrendingTokens]);

  return {
    tokens,
    isLoading,
    error,
    refresh: fetchTrendingTokens,
  };
};

export const useTokenDetails = (mint: string | null) => {
  const [token, setToken] = useState<TokenDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenDetails = useCallback(async () => {
    if (!mint) {
      setToken(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetch<TokenDetails>(
        `/ponzinomics/tokens/${mint}`
      );

      setToken(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch token details';
      setError(message);
      console.error('[useTokenDetails]', message);
    } finally {
      setIsLoading(false);
    }
  }, [mint]);

  useEffect(() => {
    fetchTokenDetails();
  }, [fetchTokenDetails]);

  return {
    token,
    isLoading,
    error,
    refresh: fetchTokenDetails,
  };
};

export const useTokensBySignal = (signal: TokenSignal['signal'] | null, limit = 20) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokensBySignal = useCallback(async () => {
    if (!signal) {
      setTokens([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetch<Token[]>(
        `/ponzinomics/signals/all?signal=${signal}&limit=${limit}`
      );

      setTokens(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tokens by signal';
      setError(message);
      console.error('[useTokensBySignal]', message);
    } finally {
      setIsLoading(false);
    }
  }, [signal, limit]);

  useEffect(() => {
    fetchTokensBySignal();
  }, [fetchTokensBySignal]);

  return {
    tokens,
    isLoading,
    error,
    refresh: fetchTokensBySignal,
  };
};

export const useExecuteTrade = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const executeTrade = useCallback(
    async (mint: string, amount: number, slippage: number) => {
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        const result = await apiFetch('/ponzinomics/trades/execute', {
          method: 'POST',
          headers: {
            'X-Wallet-Address': 'user-wallet-address',
          },
          body: JSON.stringify({
            mint,
            amount,
            slippage,
          }),
        });

        if (result) {
          setSuccess(true);
          return result;
        } else {
          throw new Error('Trade execution failed');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Trade execution failed';
        setError(message);
        console.error('[useExecuteTrade]', message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return {
    executeTrade,
    isLoading,
    error,
    success,
    reset,
  };
};

export const useCopyTrade = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const copyTrade = useCallback(
    async (fromAgent: string, tradeId: string, scalePercent = 100) => {
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        const result = await apiFetch('/ponzinomics/trades/copy', {
          method: 'POST',
          headers: {
            'X-Wallet-Address': 'user-wallet-address',
          },
          body: JSON.stringify({
            fromAgent,
            tradeId,
            scalePercent,
          }),
        });

        if (result) {
          setSuccess(true);
          return result;
        } else {
          throw new Error('Copy trade failed');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Copy trade failed';
        setError(message);
        console.error('[useCopyTrade]', message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return {
    copyTrade,
    isLoading,
    error,
    success,
    reset,
  };
};

export const useTradeHistory = (walletAddress: string | null, limit = 50) => {
  const [trades, setTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTradeHistory = useCallback(async () => {
    if (!walletAddress) {
      setTrades([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await apiFetch<any[]>(
        `/ponzinomics/trades/history?limit=${limit}`,
        {
          headers: {
            'X-Wallet-Address': walletAddress,
          },
        }
      );

      setTrades(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch trade history';
      setError(message);
      console.error('[useTradeHistory]', message);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, limit]);

  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  return {
    trades,
    isLoading,
    error,
    refresh: fetchTradeHistory,
  };
};
