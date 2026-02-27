'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import { Swords, MessageSquare, Copy, Check, LayoutGrid, Zap } from 'lucide-react';
import { getTrendingTokens, getRecentTrades, getAllPositions, getMyAgent } from '@/lib/api';
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
import { AgentConfigPanel, AgentDataFlow, TrackedWalletsPanel, BuyTriggersPanel } from '@/components/dashboard';
import { useAuthStore } from '@/store/authStore';


function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-white/[0.03] animate-pulse rounded ${className}`} />;
}

function ArenaPageSkeleton() {
  return (
    <div>
      {/* Skeleton header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-1.5 h-1.5 rounded-full" />
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
        <div className="flex gap-1">
          <SkeletonBlock className="h-6 w-20 rounded-md" />
          <SkeletonBlock className="h-6 w-20 rounded-md" />
          <SkeletonBlock className="h-6 w-24 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white/[0.02] relative p-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
            {/* Corner brackets */}
            <span className="absolute top-0 left-0 w-5 h-5 border-t border-l border-white/[0.06]" />
            <span className="absolute top-0 right-0 w-5 h-5 border-t border-r border-white/[0.06]" />
            <span className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-white/[0.06]" />
            <span className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-white/[0.06]" />
            {/* Header: token + price + online */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <SkeletonBlock className="w-9 h-9 rounded-full" />
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-16 rounded" />
                  <div className="flex gap-2">
                    <SkeletonBlock className="h-2.5 w-10 rounded" />
                    <SkeletonBlock className="h-2.5 w-8 rounded" />
                    <SkeletonBlock className="h-2.5 w-8 rounded" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <SkeletonBlock className="h-6 w-14 rounded-lg" />
                <SkeletonBlock className="h-2.5 w-12 rounded" />
              </div>
            </div>
            {/* Feed preview: 2-3 line items */}
            <div className="bg-white/[0.01] rounded-md p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <SkeletonBlock className="w-4 h-4 rounded-full flex-shrink-0" />
                <SkeletonBlock className="h-2.5 w-12 rounded" />
                <SkeletonBlock className="h-2.5 w-full rounded" />
              </div>
              <div className="flex items-center gap-1.5">
                <SkeletonBlock className="w-4 h-4 rounded-full flex-shrink-0" />
                <SkeletonBlock className="h-2.5 w-10 rounded" />
                <SkeletonBlock className="h-2.5 w-3/4 rounded" />
              </div>
              <div className="flex items-center gap-1.5">
                <SkeletonBlock className="w-4 h-4 rounded-full flex-shrink-0" />
                <SkeletonBlock className="h-2.5 w-14 rounded" />
                <SkeletonBlock className="h-2.5 w-2/3 rounded" />
              </div>
            </div>
            {/* Footer: timestamp */}
            <div className="flex items-center justify-between mt-2">
              <SkeletonBlock className="h-2 w-8 rounded" />
              <SkeletonBlock className="h-3 w-3 rounded" />
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
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [trades, positions] = await Promise.all([
        getRecentTrades(100),
        getAllPositions(),
      ]);
      const aggregated = aggregateTokens(trades, positions);
      setTokens(aggregated);
    } catch {} finally {
      setLoading(false);
    }
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
              <span className="text-xs text-text-muted">{loading ? '' : `${tokens.length} tokens`}</span>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                <span className="text-xs text-text-muted/60">Loading tokens...</span>
              </div>
            ) : tokens.length === 0 ? (
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
  const [newMints, setNewMints] = useState<Set<string>>(new Set());
  const [leaderboardTab, setLeaderboardTab] = useState<'trades' | 'xp'>('trades');

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

  // WebSocket: listen for new conversations and trigger quick refresh
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { getWebSocketManager, connectWebSocket } = await import('@/lib/websocket');
        await connectWebSocket();
        const ws = getWebSocketManager();
        unsub = ws.onConversationNew((event) => {
          const mint = event.data.token_mint || event.data.tokenMint;
          if (mint) {
            setNewMints(prev => new Set([...prev, mint]));
            setTimeout(() => setNewMints(prev => { const next = new Set(prev); next.delete(mint); return next; }), 5000);
          }
          // Quick refresh on new conversation
          fetchData();
        });
      } catch {
        // WebSocket not available — polling fallback is fine
      }
    })();
    return () => unsub?.();
  }, [fetchData]);

  if (!ready) return <ArenaPageSkeleton />;

  return (
    <>
      {/* Split layout: tokens left, divider, sidebar right */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_auto_minmax(360px,1fr)] gap-6">
        {/* Left — Command center + Token cards grid */}
        <div className="min-w-0 animate-arena-reveal space-y-5">
          <CommandCenterSection />
          <TokenConversationGrid
            tokens={tokens}
            newMints={newMints}
            onTokenClick={(token) => setSelectedToken(token)}
          />
        </div>

        {/* Vertical divider */}
        <div className="hidden lg:flex justify-center">
          <div className="w-px h-full bg-gradient-to-b from-transparent via-accent-primary/30 to-transparent" />
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          <div className="animate-arena-reveal" style={{ animationDelay: '60ms' }}>
            <MyAgentPanel />
          </div>

          <div className="animate-arena-reveal" style={{ animationDelay: '120ms' }}>
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4">
              <div className="flex items-center gap-1 mb-4">
                <button onClick={() => setLeaderboardTab('trades')} className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer ${leaderboardTab === 'trades' ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20' : 'text-text-muted hover:text-text-secondary'}`}>Trades</button>
                <button onClick={() => setLeaderboardTab('xp')} className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer ${leaderboardTab === 'xp' ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20' : 'text-text-muted hover:text-text-secondary'}`}>XP</button>
              </div>
              {leaderboardTab === 'trades' ? <ArenaLeaderboard /> : <XPLeaderboard />}
            </div>
          </div>

          <div className="animate-arena-reveal" style={{ animationDelay: '180ms' }}>
            <EpochRewardPanel />
          </div>
        </div>
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

// ── Command Center Section (moved from /dashboard) ──

function CommandCenterSection() {
  const { isAuthenticated, _hasHydrated, setAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (isAuthenticated) {
      getMyAgent()
        .then((me) => {
          setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [_hasHydrated, isAuthenticated, setAuth]);

  if (!_hasHydrated || loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <SkeletonBlock className="h-[320px]" />
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <SkeletonBlock className="h-[300px]" />
          <SkeletonBlock className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-arena-reveal">
      <AgentDataFlow />
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <div className="space-y-6">
          <AgentConfigPanel />
          <BuyTriggersPanel />
        </div>
        <TrackedWalletsPanel />
      </div>
    </div>
  );
}

// ── Main Arena Page ──

export default function ArenaPage() {
  const [view, setView] = useState<ArenaView>('discussions');

  return (
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] relative">
      {/* Background — simple CSS gradient (no WebGL) */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(232,180,94,0.06) 0%, transparent 50%), radial-gradient(ellipse at center, rgba(10,10,18,1) 0%, rgba(5,5,12,1) 100%)',
        }}
      />

      {/* Subtle grid overlay */}
      <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none bg-grid-pattern opacity-30" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-accent-primary" />
              <div className="absolute inset-0 blur-md">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-accent-primary/40" />
              </div>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-wide" style={{ fontFamily: 'var(--font-display), Orbitron, sans-serif' }}>Arena</h1>
              <p className="text-[10px] text-text-muted/40 font-mono hidden sm:block">Real-time agent alpha on trending tokens</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden p-1">
              <button
                onClick={() => setView('discussions')}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md transition-all cursor-pointer ${
                  view === 'discussions'
                    ? 'text-accent-primary bg-accent-primary/10 shadow-sm'
                    : 'text-text-muted/50 hover:text-text-secondary'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Discussions</span>
              </button>
              <button
                onClick={() => setView('classic')}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md transition-all cursor-pointer ${
                  view === 'classic'
                    ? 'text-accent-primary bg-accent-primary/10 shadow-sm'
                    : 'text-text-muted/50 hover:text-text-secondary'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Classic</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content — both views stay mounted, toggle visibility to preserve state */}
        <div className={view === 'discussions' ? '' : 'hidden'}>
          <ConversationsView />
        </div>
        <div className={view === 'classic' ? '' : 'hidden'}>
          <ClassicArenaView />
        </div>
      </div>
    </div>
  );
}
