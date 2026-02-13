'use client';

import { useState, useCallback, useEffect } from 'react';
import { ArrowDownCircle, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';
import { useTradeRecommendations } from '@/lib/hooks';
import type { FeedEvent, TradeRecommendation } from '@/lib/websocket';

interface PendingRec {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  suggestedAmount: number;
  chain: 'SOLANA' | 'BSC';
  trigger: string;
  sourceWallet: string;
  reason: string;
  timestamp: string;
}

export function TradeRecommendationBanner() {
  const hydrated = useAuthHydrated();
  const { agent, isAuthenticated } = useAuthStore();
  const [recommendations, setRecommendations] = useState<PendingRec[]>([]);

  const handleRecommendation = useCallback((event: FeedEvent) => {
    const d = event.data;
    const rec: PendingRec = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tokenMint: d.tokenMint || d.token_mint || '',
      tokenSymbol: d.tokenSymbol || 'Unknown',
      suggestedAmount: d.suggestedAmount || d.amount || 0,
      chain: d.chain || 'SOLANA',
      trigger: d.trigger || 'auto',
      sourceWallet: d.sourceWallet || '',
      reason: d.reason || 'Trade recommendation from your agent',
      timestamp: d.timestamp || new Date().toISOString(),
    };
    setRecommendations((prev) => [rec, ...prev].slice(0, 10));
  }, []);

  useTradeRecommendations(
    hydrated && isAuthenticated ? agent?.id : null,
    handleRecommendation,
  );

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    if (recommendations.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setRecommendations((prev) =>
        prev.filter((r) => now - new Date(r.timestamp).getTime() < 60_000),
      );
    }, 5000);
    return () => clearInterval(timer);
  }, [recommendations.length]);

  const dismiss = (id: string) => {
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  };

  if (!hydrated || !isAuthenticated || recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 animate-in slide-in-from-top-2"
        >
          <ArrowDownCircle className="h-5 w-5 shrink-0 text-green-400" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-300">
                BUY {rec.tokenSymbol}
              </span>
              <span className="text-xs text-zinc-500">
                {rec.suggestedAmount} {rec.chain === 'BSC' ? 'BNB' : 'SOL'}
              </span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                {rec.chain}
              </span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                {rec.trigger}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">{rec.reason}</p>
          </div>
          {rec.chain === 'SOLANA' && (
            <a
              href={`https://jup.ag/swap/SOL-${rec.tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30 transition-colors flex items-center gap-1"
            >
              Trade <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {rec.chain === 'BSC' && (
            <a
              href={`https://pancakeswap.finance/swap?outputCurrency=${rec.tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30 transition-colors flex items-center gap-1"
            >
              Trade <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={() => dismiss(rec.id)}
            className="shrink-0 text-zinc-500 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
