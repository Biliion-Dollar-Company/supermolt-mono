'use client';

import { useState, useEffect, useCallback } from 'react';
import { Swords, Wifi, WifiOff, Users, TrendingUp, Clock } from 'lucide-react';
import { getRecentTrades, getAllPositions } from '@/lib/api';
import { Trade, Position } from '@/lib/types';
import { ArenaLeaderboard, TokenDetailContent } from '@/components/arena';
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
    if (!sym || sym === 'UNKNOWN') continue;
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

  for (const pos of positions) {
    const sym = pos.tokenSymbol;
    if (!sym || sym === 'UNKNOWN') continue;
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

  tokens.sort((a, b) => new Date(b.lastTradeTime).getTime() - new Date(a.lastTradeTime).getTime());

  return tokens;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Auto-select first token when tokens load and nothing is selected
  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokens[0].tokenSymbol);
    }
  }, [tokens, selectedToken]);

  return (
    <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%]">
      <div>
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

        {/* Main layout: leaderboard left, separator, token feed right */}
        <div className="grid grid-cols-1 lg:grid-cols-[350px_auto_1fr] gap-6">
          {/* Leaderboard */}
          <div className="border border-white/[0.06] bg-bg-secondary p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              Leaderboard
            </h2>
            <ArenaLeaderboard />
          </div>

          {/* Vertical Separator */}
          <div className="hidden lg:flex justify-center">
            <div className="w-px h-full bg-gradient-to-b from-transparent via-accent-primary/30 to-transparent" />
          </div>

          {/* Token Grid + Featured Detail */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Live Tokens
              </h2>
              <span className="text-xs text-text-muted">{tokens.length} tokens</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-20 bg-white/[0.02] animate-pulse rounded" />
                ))}
              </div>
            ) : tokens.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-text-muted">
                <p>No recent trading activity</p>
              </div>
            ) : (
              <>
                {/* Token Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 mb-6">
                  {tokens.map((token) => (
                    <button
                      key={token.tokenSymbol}
                      onClick={() => setSelectedToken(token.tokenSymbol)}
                      className={`text-left p-3 border transition-all cursor-pointer ${
                        selectedToken === token.tokenSymbol
                          ? 'border-accent-primary/50 bg-accent-primary/5'
                          : 'border-white/[0.06] hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold font-mono text-text-primary truncate">
                          {token.tokenSymbol}
                        </span>
                        <span className={`text-xs font-mono ml-1 ${token.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {token.netPnl >= 0 ? '+' : ''}{token.netPnl.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted">
                        <span className="flex items-center gap-0.5">
                          <Users className="w-3 h-3" />
                          {token.agentCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="w-3 h-3" />
                          {token.recentTradeCount}
                        </span>
                        <span className="flex items-center gap-0.5 ml-auto">
                          <Clock className="w-3 h-3" />
                          {timeAgo(token.lastTradeTime)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Featured Token Detail (inline) */}
                {selectedToken ? (
                  <div className="border border-white/[0.06] bg-bg-secondary overflow-hidden">
                    <TokenDetailContent tokenSymbol={selectedToken} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-text-muted">
                    <p>Select a token to view live data</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
