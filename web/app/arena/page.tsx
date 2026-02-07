'use client';

import { useState, useEffect, useCallback } from 'react';
import { Swords, Wifi, WifiOff, Copy, Check } from 'lucide-react';
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
    tokenMint: string;
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
      tokenMint: trade.tokenMint || '',
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
    if (!existing.tokenMint && trade.tokenMint) {
      existing.tokenMint = trade.tokenMint;
    }

    tokenMap.set(sym, existing);
  }

  for (const pos of positions) {
    const sym = pos.tokenSymbol;
    if (!sym || sym === 'UNKNOWN') continue;
    const existing = tokenMap.get(sym);
    if (existing) {
      existing.agentIds.add(pos.agentId);
      if (!existing.tokenMint && pos.tokenMint) {
        existing.tokenMint = pos.tokenMint;
      }
    }
  }

  const tokens: ArenaToken[] = [];
  for (const [symbol, data] of tokenMap) {
    tokens.push({
      tokenSymbol: symbol,
      tokenMint: data.tokenMint,
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


function TokenChip({
  token,
  isSelected,
  onSelect,
}: {
  token: ArenaToken;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={onSelect}
      className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 border transition-all cursor-pointer ${
        isSelected
          ? 'border-accent-primary/50 bg-accent-primary/5'
          : 'border-white/[0.06] hover:bg-white/[0.03]'
      }`}
    >
      <span className="text-sm font-bold font-mono text-text-primary whitespace-nowrap">
        {token.tokenSymbol}
      </span>
      <span className={`text-xs font-mono ${token.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {token.netPnl >= 0 ? '+' : ''}{Math.round(token.netPnl)}%
      </span>
      {token.tokenMint && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(token.tokenMint);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-text-muted hover:text-text-secondary transition-colors ml-0.5"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </button>
  );
}

export default function ArenaPage() {
  const [tokens, setTokens] = useState<ArenaToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

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

          {/* Token Marquee + Featured Detail */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Live Tokens
              </h2>
              <span className="text-xs text-text-muted">{tokens.length} tokens</span>
            </div>

            {loading ? (
              <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 w-32 bg-white/[0.02] animate-pulse rounded flex-shrink-0" />
                ))}
              </div>
            ) : tokens.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-text-muted">
                <p>No recent trading activity</p>
              </div>
            ) : (
              <>
                {/* Token Marquee */}
                <div
                  className="relative overflow-hidden mb-6"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                >
                  {/* Left fade */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-primary to-transparent z-10 pointer-events-none" />
                  {/* Right fade */}
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-primary to-transparent z-10 pointer-events-none" />

                  <div className={`flex gap-2 animate-marquee ${isPaused ? '[animation-play-state:paused]' : ''}`}>
                    {tokens.map((token) => (
                      <TokenChip
                        key={token.tokenSymbol}
                        token={token}
                        isSelected={selectedToken === token.tokenSymbol}
                        onSelect={() => setSelectedToken(token.tokenSymbol)}
                      />
                    ))}
                    {/* Duplicate for seamless loop */}
                    {tokens.map((token) => (
                      <TokenChip
                        key={`dup-${token.tokenSymbol}`}
                        token={token}
                        isSelected={selectedToken === token.tokenSymbol}
                        onSelect={() => setSelectedToken(token.tokenSymbol)}
                      />
                    ))}
                  </div>
                </div>

                {/* Featured Token Detail (inline) */}
                {selectedToken ? (
                  <div className="border border-white/[0.06] bg-bg-secondary overflow-hidden">
                    <TokenDetailContent tokenSymbol={selectedToken} compact />
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
