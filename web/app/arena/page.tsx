'use client';

import { useState, useEffect, useCallback } from 'react';
import { Swords, Wifi, WifiOff } from 'lucide-react';
import { getRecentTrades, getAllPositions } from '@/lib/api';
import { Trade, Position } from '@/lib/types';
import { ArenaLeaderboard, TokenFeed, TokenDetailModal } from '@/components/arena';
import type { ArenaToken } from '@/components/arena';

function aggregateTokens(trades: Trade[], positions: Position[]): ArenaToken[] {
  const tokenMap = new Map<string, {
    agentIds: Set<string>;
    tradeCount: number;
    lastTradeTime: string;
    totalVolume: number;
    pnlSum: number;
    pnlCount: number;
  }>();

  for (const trade of trades) {
    const sym = trade.tokenSymbol;
    const existing = tokenMap.get(sym) || {
      agentIds: new Set<string>(),
      tradeCount: 0,
      lastTradeTime: trade.timestamp,
      totalVolume: 0,
      pnlSum: 0,
      pnlCount: 0,
    };

    existing.agentIds.add(trade.agentId);
    existing.tradeCount++;
    existing.totalVolume += trade.quantity * trade.entryPrice;
    if (trade.pnl !== 0) {
      existing.pnlSum += trade.pnlPercent;
      existing.pnlCount++;
    }
    if (new Date(trade.timestamp) > new Date(existing.lastTradeTime)) {
      existing.lastTradeTime = trade.timestamp;
    }

    tokenMap.set(sym, existing);
  }

  // Also incorporate positions into agent counts
  for (const pos of positions) {
    const sym = pos.tokenSymbol;
    const existing = tokenMap.get(sym);
    if (existing) {
      existing.agentIds.add(pos.agentId);
    }
  }

  const tokens: ArenaToken[] = [];
  for (const [symbol, data] of tokenMap) {
    tokens.push({
      tokenSymbol: symbol,
      agentCount: data.agentIds.size,
      recentTradeCount: data.tradeCount,
      lastTradeTime: data.lastTradeTime,
      totalVolume: data.totalVolume,
      netPnl: data.pnlCount > 0 ? data.pnlSum / data.pnlCount : 0,
    });
  }

  // Sort by most recent trade
  tokens.sort((a, b) => new Date(b.lastTradeTime).getTime() - new Date(a.lastTradeTime).getTime());

  return tokens;
}

export default function ArenaPage() {
  const [tokens, setTokens] = useState<ArenaToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [trades, positions] = await Promise.all([
        getRecentTrades(100),
        getAllPositions(),
      ]);
      const aggregated = aggregateTokens(trades, positions);
      setTokens(aggregated);
      setLastRefresh(new Date());
      setIsLive(true);
    } catch {
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-accent-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Arena</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-text-muted hidden sm:inline">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
              isLive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isLive ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Main layout: leaderboard left, tokens right */}
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
          {/* Leaderboard */}
          <div className="border border-white/[0.06] bg-bg-secondary p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              Leaderboard
            </h2>
            <ArenaLeaderboard />
          </div>

          {/* Token Feed */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Recently Traded Tokens
              </h2>
              <span className="text-xs text-text-muted">{tokens.length} tokens</span>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 bg-white/[0.02] animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <TokenFeed tokens={tokens} onTokenClick={setSelectedToken} />
            )}
          </div>
        </div>

        {/* Token Detail Modal */}
        {selectedToken && (
          <TokenDetailModal
            tokenSymbol={selectedToken}
            onClose={() => setSelectedToken(null)}
          />
        )}
      </div>
    </div>
  );
}
