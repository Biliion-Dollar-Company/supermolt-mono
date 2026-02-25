'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Swords, Wifi, WifiOff, MessageSquare, Copy, Check, LayoutGrid, List } from 'lucide-react';
import { getTrendingTokens, getRecentTrades, getAllPositions } from '@/lib/api';
import type { TrendingToken, Trade, Position } from '@/lib/types';
import {
  TokenConversationGrid,
  TokenConversationPanel,
  ArenaLeaderboard,
  TokenDetailContent,
  EpochRewardPanel,
  GraduationPanel,
  TasksPanel,
  MyAgentPanel,
  XPLeaderboard,
  ConversationsPanel,
  TradeRecommendationBanner,
} from '@/components/arena';
import type { ArenaToken } from '@/components/arena';
import { useIsMobile } from '@/hooks/useIsMobile';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-white/[0.03] animate-pulse rounded ${className}`} />;
}

function ArenaPageSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-[#12121a]/60 border border-white/[0.08] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="w-8 h-8 rounded-full" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
              <SkeletonBlock className="h-5 w-14" />
            </div>
            <div className="flex gap-3 mb-3">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-12" />
            </div>
            <div className="border-t border-white/[0.04] pt-3 mt-2">
              <SkeletonBlock className="h-3 w-full mb-2" />
              <SkeletonBlock className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Old Arena Helpers ──

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

function TokenChip({ token, isSelected, onSelect }: { token: ArenaToken; isSelected: boolean; onSelect: () => void }) {
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
      {token.tokenMint && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(token.tokenMint);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-text-muted hover:text-text-secondary transition-colors ml-0.5 cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </span>
      )}
    </button>
  );
}

// ── Classic Arena View ──

function ClassicArenaView() {
  const [tokens, setTokens] = useState<ArenaToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'trades' | 'xp'>('trades');

  const fetchData = useCallback(async () => {
    try {
      const [trades, positions] = await Promise.all([
        getRecentTrades(100),
        getAllPositions(),
      ]);
      const aggregated = aggregateTokens(trades, positions);
      setTokens(aggregated);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokens[0].tokenSymbol);
    }
  }, [tokens, selectedToken]);

  return (
    <>
      {/* Live Tokens row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="animate-arena-reveal min-h-0 flex flex-col max-h-[400px]">
          <TasksPanel />
        </div>
        <div className="animate-arena-reveal min-h-0 flex flex-col max-h-[400px]" style={{ animationDelay: '60ms' }}>
          <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5 flex flex-col min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Live Tokens</h2>
              <span className="text-xs text-text-muted">{tokens.length} tokens</span>
            </div>
            {tokens.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-text-muted text-sm">No recent trading activity</div>
            ) : (
              <>
                <div className="relative overflow-hidden mb-4" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#12121a]/50 to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#12121a]/50 to-transparent z-10 pointer-events-none" />
                  <div className={`flex gap-2 animate-marquee ${isPaused ? '[animation-play-state:paused]' : ''}`}>
                    {tokens.map((token) => (
                      <TokenChip key={token.tokenSymbol} token={token} isSelected={selectedToken === token.tokenSymbol} onSelect={() => setSelectedToken(token.tokenSymbol)} />
                    ))}
                    {tokens.map((token) => (
                      <TokenChip key={`dup-${token.tokenSymbol}`} token={token} isSelected={selectedToken === token.tokenSymbol} onSelect={() => setSelectedToken(token.tokenSymbol)} />
                    ))}
                  </div>
                </div>
                {selectedToken && <TokenDetailContent tokenSymbol={selectedToken} compact />}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 animate-arena-reveal" style={{ animationDelay: '120ms' }}>
        <MyAgentPanel />
      </div>

      <TradeRecommendationBanner />

      {/* Leaderboard + Conversations | Epoch + Graduation */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_auto_1fr] gap-6">
        <div className="space-y-6 animate-arena-reveal" style={{ animationDelay: '180ms' }}>
          <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
            <div className="flex items-center gap-1 mb-4">
              <button onClick={() => setLeaderboardTab('trades')} className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer ${leaderboardTab === 'trades' ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20' : 'text-text-muted hover:text-text-secondary'}`}>Trades</button>
              <button onClick={() => setLeaderboardTab('xp')} className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer ${leaderboardTab === 'xp' ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20' : 'text-text-muted hover:text-text-secondary'}`}>XP</button>
            </div>
            {leaderboardTab === 'trades' ? <ArenaLeaderboard /> : <XPLeaderboard />}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
          <ConversationsPanel />
        </div>
        <div className="hidden lg:flex justify-center">
          <div className="w-px h-full bg-gradient-to-b from-transparent via-accent-primary/30 to-transparent" />
        </div>
        <div className="min-w-0 space-y-6">
          <div className="animate-arena-reveal" style={{ animationDelay: '180ms' }}>
            <EpochRewardPanel />
          </div>
          <div className="animate-arena-reveal" style={{ animationDelay: '210ms' }}>
            <GraduationPanel />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Conversations View (new) ──

function ConversationsView() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<TrendingToken | null>(null);
  const initialLoadDone = useRef(false);
  const [ready, setReady] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getTrendingTokens();
      setTokens(data);
    } catch {} finally {
      setLoading(false);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setTimeout(() => setReady(true), 150);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!ready) return <ArenaPageSkeleton />;

  return (
    <>
      <div className="animate-arena-reveal">
        <TokenConversationGrid
          tokens={tokens}
          onTokenClick={(token) => setSelectedToken(token)}
        />
      </div>
      {selectedToken && (
        <TokenConversationPanel
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </>
  );
}

// ── Main Arena Page ──

type ArenaView = 'discussions' | 'classic';

export default function ArenaPage() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<ArenaView>('discussions');
  const [isLive, setIsLive] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Heartbeat to check backend is alive
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/health`);
        setIsLive(res.ok);
      } catch {
        setIsLive(false);
      }
      setLastRefresh(new Date());
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] relative">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.60) 15%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.95) 100%)',
          }}
        />
        {!isMobile && (
          <div className="absolute inset-0 opacity-40">
            <RisingLines
              color="#E8B45E"
              horizonColor="#E8B45E"
              haloColor="#F5D78E"
              riseSpeed={0.05}
              riseScale={8.0}
              riseIntensity={1.0}
              flowSpeed={0.1}
              flowDensity={3.5}
              flowIntensity={0.5}
              horizonIntensity={0.7}
              haloIntensity={5.0}
              horizonHeight={-0.85}
              circleScale={-0.5}
              scale={6.5}
              brightness={0.9}
            />
          </div>
        )}
      </div>

      {/* Gradient orbs */}
      <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
        <div className="absolute top-[45%] right-[10%] w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.04)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-accent-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Arena</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden">
              <button
                onClick={() => setView('discussions')}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 transition-colors cursor-pointer ${
                  view === 'discussions'
                    ? 'text-accent-primary bg-accent-primary/10'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span className="hidden sm:inline">Discussions</span>
              </button>
              <div className="w-px h-4 bg-white/[0.08]" />
              <button
                onClick={() => setView('classic')}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 transition-colors cursor-pointer ${
                  view === 'classic'
                    ? 'text-accent-primary bg-accent-primary/10'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span className="hidden sm:inline">Classic</span>
              </button>
            </div>

            <span className="text-xs text-text-muted hidden sm:inline" suppressHydrationWarning>
              {lastRefresh.toLocaleTimeString()}
            </span>
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
              isLive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isLive ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Content based on selected view */}
        {view === 'discussions' ? <ConversationsView /> : <ClassicArenaView />}
      </div>
    </div>
  );
}
