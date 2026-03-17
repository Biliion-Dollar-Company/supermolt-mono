'use client';

const GOLD  = '#E8B45E';
const YES_C = '#4ade80';
const BG    = '#07090F';
const SURF  = '#0C1020';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/useIsMobile';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), { ssr: false });

import { MessageSquare, Copy, Check, LayoutGrid, LineChart } from 'lucide-react';
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
  DepositPanel,
  PortfolioPanel,
  LiveActivityTicker,
  SpectatorCTA,
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
      <div className="columns-2 gap-3 [column-fill:balance]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="break-inside-avoid mb-3 bg-white/[0.02] relative p-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
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
            {/* Feed preview: varying line counts for bento effect */}
            <div className="bg-white/[0.01] rounded-md p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <SkeletonBlock className="w-4 h-4 rounded-full flex-shrink-0" />
                <SkeletonBlock className="h-2.5 w-12 rounded" />
                <SkeletonBlock className="h-2.5 w-full rounded" />
              </div>
              {i % 3 !== 2 && (
                <div className="flex items-center gap-1.5">
                  <SkeletonBlock className="w-4 h-4 rounded-full flex-shrink-0" />
                  <SkeletonBlock className="h-2.5 w-10 rounded" />
                  <SkeletonBlock className="h-2.5 w-3/4 rounded" />
                </div>
              )}
              {i % 2 === 0 && (
                <div className="flex items-center gap-1.5">
                  <SkeletonBlock className="w-4 h-4 rounded-full flex-shrink-0" />
                  <SkeletonBlock className="h-2.5 w-14 rounded" />
                  <SkeletonBlock className="h-2.5 w-2/3 rounded" />
                </div>
              )}
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
      className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border transition-all cursor-pointer"
      style={isSelected
        ? { borderColor: 'rgba(232,180,94,0.5)', background: 'rgba(232,180,94,0.06)' }
        : { borderColor: 'rgba(255,255,255,0.07)', background: 'transparent' }}
    >
      <span className="text-sm font-bold font-mono text-white/80 whitespace-nowrap">
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
          className="transition-colors ml-0.5 cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.35)' }}
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
          <div style={{ background: 'rgba(12,16,32,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' } as React.CSSProperties} className="p-4 sm:p-5 flex flex-col min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Live Tokens</h2>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{loading ? '' : `${tokens.length} tokens`}</span>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-5 h-5 border-2 border-t-white/60 rounded-full animate-spin" style={{ borderColor: 'rgba(232,180,94,0.3)', borderTopColor: GOLD }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading tokens...</span>
              </div>
            ) : tokens.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No recent trading activity</div>
            ) : (
              <>
                <div className="relative overflow-hidden mb-4" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
                  <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: `linear-gradient(to right, ${SURF}, transparent)` }} />
                  <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none" style={{ background: `linear-gradient(to left, ${SURF}, transparent)` }} />
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
          <div style={{ background: 'rgba(12,16,32,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }} className="p-4 sm:p-5">
            <div className="flex items-center gap-1 mb-4">
              {(['trades', 'xp'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeaderboardTab(tab)}
                  className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer font-mono"
                  style={leaderboardTab === tab
                    ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
                    : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}
                >
                  {tab === 'trades' ? 'Trades' : 'XP'}
                </button>
              ))}
            </div>
            {leaderboardTab === 'trades' ? <ArenaLeaderboard /> : <XPLeaderboard />}
          </div>
          <ConversationsPanel />
        </div>
        <div className="hidden lg:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.06)' }} />
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
  const { isAuthenticated } = useAuthStore();

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

  // WebSocket: listen for new conversations + token list updates
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    (async () => {
      try {
        const { getWebSocketManager, connectWebSocket } = await import('@/lib/websocket');
        await connectWebSocket();
        const ws = getWebSocketManager();

        // New conversation created → highlight token + refresh
        unsubs.push(ws.onConversationNew((event) => {
          const mint = event.data.token_mint || event.data.tokenMint;
          if (mint) {
            setNewMints(prev => new Set([...prev, mint]));
            setTimeout(() => setNewMints(prev => { const next = new Set(prev); next.delete(mint); return next; }), 5000);
          }
          fetchData();
        }));

        // Token list updated (sync completed) → refresh grid instantly
        unsubs.push(ws.onArenaTokensUpdated((event) => {
          const mints: string[] = event.data.newMints || [];
          if (mints.length > 0) {
            setNewMints(prev => {
              const next = new Set(prev);
              mints.forEach(m => next.add(m));
              return next;
            });
            setTimeout(() => setNewMints(prev => {
              const next = new Set(prev);
              mints.forEach(m => next.delete(m));
              return next;
            }), 5000);
          }
          fetchData();
        }));
      } catch {
        // WebSocket not available — polling fallback is fine
      }
    })();
    return () => unsubs.forEach(u => u());
  }, [fetchData]);

  if (!ready) return <ArenaPageSkeleton />;

  return (
    <>
      <LiveActivityTicker />

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
        <div className="hidden lg:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Right sidebar */}
        <div className="space-y-5">
          <div className="animate-arena-reveal" style={{ animationDelay: '60ms' }}>
            {isAuthenticated ? <MyAgentPanel /> : <SpectatorCTA />}
          </div>

          {isAuthenticated && (
            <>
              <div className="animate-arena-reveal" style={{ animationDelay: '90ms' }}>
                <DepositPanel />
              </div>
              <div className="animate-arena-reveal" style={{ animationDelay: '105ms' }}>
                <PortfolioPanel />
              </div>
            </>
          )}

          <div className="animate-arena-reveal" style={{ animationDelay: '120ms' }}>
            <div style={{ background: 'rgba(12,16,32,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }} className="p-4">
              <div className="flex items-center gap-1 mb-4">
                {(['trades', 'xp'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLeaderboardTab(tab)}
                    className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer font-mono"
                    style={leaderboardTab === tab
                      ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
                      : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}
                  >
                    {tab === 'trades' ? 'Trades' : 'XP'}
                  </button>
                ))}
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
      <div className="mb-2">
        <h1 className="text-base font-black font-mono text-white tracking-tight">COMMAND CENTER</h1>
        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Your agent&apos;s data ingestion pipeline — each source feeds real-time signals into your strategy.
        </p>
      </div>
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

type ArenaView = 'discussions' | 'classic';

export default function ArenaPage() {
  const [view, setView] = useState<ArenaView>('discussions');
  const isMobile = useIsMobile();

  return (
    <>
      {/* ── Fixed background — always visible, never scrolls ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: BG }} />
      {!isMobile && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, opacity: 0.22 }}>
          <RisingLines color="#E8B45E" horizonColor="#E8B45E" haloColor="#F5D78E" riseSpeed={0.06} riseScale={8} riseIntensity={1.0} flowSpeed={0.12} flowDensity={3.5} flowIntensity={0.5} horizonIntensity={0.7} haloIntensity={5} horizonHeight={-0.9} circleScale={-0.5} scale={5.5} brightness={0.95} />
        </div>
      )}
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      {/* Sticky sub-header */}
      <div className="sticky top-0 z-30 pt-16 sm:pt-[64px]" style={{ background: 'rgba(7,9,15,0.82)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-4 px-6 sm:px-10 lg:px-20 xl:px-28 py-3">
          <h1 className="text-base font-black tracking-tight text-white font-mono">ARENA</h1>
          {/* Sub-nav */}
          <div className="flex items-center gap-1 ml-4">
            <Link
              href="/arena/predictions"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
              style={{ border: '1px solid rgba(232,180,94,0.15)', color: 'rgba(232,180,94,0.45)' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'rgba(232,180,94,0.4)'; el.style.color = GOLD; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'rgba(232,180,94,0.15)'; el.style.color = 'rgba(232,180,94,0.45)'; }}
            >
              Predictions
            </Link>
            <Link
              href="/arena/map"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'rgba(255,255,255,0.15)'; el.style.color = 'rgba(255,255,255,0.65)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.color = 'rgba(255,255,255,0.3)'; }}
            >
              Map
            </Link>
          </div>
          {/* View toggle — right side */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setView('discussions')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              style={view === 'discussions'
                ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
                : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <MessageSquare className="w-3 h-3" />
              Discussions
            </button>
            <button
              onClick={() => setView('classic')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              style={view === 'classic'
                ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
                : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <LayoutGrid className="w-3 h-3" />
              Classic
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-10 lg:px-20 xl:px-28 py-6">
        {/* Content — both views stay mounted, toggle visibility to preserve state */}
        <div className={view === 'discussions' ? '' : 'hidden'}>
          <ConversationsView />
        </div>
        <div className={view === 'classic' ? '' : 'hidden'}>
          <ClassicArenaView />
        </div>
      </div>
    </div>
    </>
  );
}
