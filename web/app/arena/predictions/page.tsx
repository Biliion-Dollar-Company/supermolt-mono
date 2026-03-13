'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SpotlightCard from '@/components/reactbits/spotlight-card';
import ClickSpark from '@/components/reactbits/click-spark';
import DecryptedText from '@/components/reactbits/decrypted-text';
import CountUp from '@/components/reactbits/count-up';
import {
  ArrowLeft,
  Activity,
  Radio,
  Trophy,
  Target,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart3,
  Clock,
  Users,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import {
  getPredictionMarkets,
  getPredictionStats,
  getPredictionLeaderboard,
  getMyPredictions,
  placePrediction,
  getPredictionCoordinatorStatus,
  getMarketVoices,
  getRecentPredictions,
  isAuthenticated,
} from '@/lib/api';
import { connectWebSocket, getWebSocketManager } from '@/lib/websocket';
import type {
  AgentPrediction,
  AgentVoice,
  PredictionConsensusEvent,
  PredictionCoordinatorStatus,
  PredictionLeaderboardEntry,
  PredictionMarket,
  PredictionSignalEvent,
  PredictionStats,
} from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────

interface PredictionFormState {
  side: 'YES' | 'NO';
  contracts: number;
  confidence?: number;
  reasoning: string;
  placeRealOrder: boolean;
}

type TapeItem =
  | { kind: 'signal'; ts: number; data: PredictionSignalEvent }
  | { kind: 'consensus'; ts: number; data: PredictionConsensusEvent };

const initialForm: PredictionFormState = {
  side: 'YES',
  contracts: 5,
  confidence: 70,
  reasoning: '',
  placeRealOrder: false,
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function timeAgo(ts: string | number): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// Agent initials avatar when no image
function AgentAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.slice(0, 2).toUpperCase();
  const colors = [
    'bg-violet-500/20 text-violet-300',
    'bg-cyan-500/20 text-cyan-300',
    'bg-amber-500/20 text-amber-300',
    'bg-emerald-500/20 text-emerald-300',
    'bg-rose-500/20 text-rose-300',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  const cls = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[11px]';
  return (
    <div className={`${cls} ${color} rounded-sm flex items-center justify-center font-bold font-mono flex-shrink-0`}>
      {initials}
    </div>
  );
}

// AnimCounter is replaced by CountUp from react-bits (framer-motion spring)

// ── Probability Bar ──────────────────────────────────────────────────

function ProbBar({ yes, flash, height = 'h-1.5' }: { yes: number; flash?: boolean; height?: string }) {
  const pct = Math.max(2, Math.min(98, yes * 100));
  return (
    <div className={`relative ${height} w-full rounded-full overflow-hidden bg-white/[0.06] transition-all ${flash ? 'ring-1 ring-accent-primary/40' : ''}`}>
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-rose-500 to-rose-400 transition-all duration-700 ease-out"
        style={{ width: `${100 - pct}%` }}
      />
    </div>
  );
}

// ── Connection Dot ───────────────────────────────────────────────────

function WsStatus({ connected }: { connected: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider border ${
      connected
        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
        : 'border-rose-500/30 text-rose-400 bg-rose-500/5'
    }`}>
      {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {connected ? 'Live' : 'Offline'}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────

function StatCard({ label, children, icon }: { label: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="group relative p-4 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden">
      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/[0.06] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/[0.06] pointer-events-none" />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-text-muted/60">{icon}</span>
        <p className="text-[10px] text-text-muted uppercase tracking-wider font-mono">{label}</p>
      </div>
      {children}
    </div>
  );
}

// ── Market Card ──────────────────────────────────────────────────────

function MarketCard({
  market, isSelected, isHot, onClick
}: {
  market: PredictionMarket;
  isSelected: boolean;
  isHot: boolean;
  onClick: () => void;
}) {
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
  const isYesFav = yesPct >= 50;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left group transition-all duration-200 relative overflow-hidden
        ${isSelected
          ? 'bg-gradient-to-r from-accent-primary/[0.10] to-cyan-500/[0.04] border-l-2 border-l-accent-primary'
          : 'bg-white/[0.012] hover:bg-white/[0.035] border-l-2 border-l-transparent'
        }
        ${isHot ? 'ring-1 ring-inset ring-cyan-400/20' : ''}
      `}
    >
      {/* Hot glow */}
      {isHot && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.05] to-transparent animate-pulse pointer-events-none" />
      )}

      {/* Glass shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="relative px-3.5 py-3 space-y-2.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13px] font-medium leading-snug line-clamp-2 flex-1 transition-colors ${
            isSelected ? 'text-white' : 'text-white/70 group-hover:text-white/90'
          }`}>
            {market.title}
          </p>
          <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-all duration-200 ${
            isSelected ? 'text-accent-primary translate-x-0 opacity-100' : 'text-white/20 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60'
          }`} />
        </div>

        {/* Split probability bar */}
        <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
            style={{ width: `${Math.max(2, Math.min(98, yesPct))}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-rose-500 to-rose-400 transition-all duration-700"
            style={{ width: `${Math.max(2, 100 - Math.max(2, Math.min(98, yesPct)))}%` }}
          />
          {isHot && <div className="absolute inset-0 ring-1 ring-inset ring-cyan-400/30 rounded-full animate-pulse" />}
        </div>

        {/* Prices + volume */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md backdrop-blur-sm border transition-all ${
            isYesFav
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-white/[0.04] border-white/[0.08] text-white/40'
          }`}>
            <TrendingUp className="w-2.5 h-2.5" />
            <span className="font-bold">{yesPct}¢</span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md backdrop-blur-sm border transition-all ${
            !isYesFav
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-white/[0.04] border-white/[0.08] text-white/40'
          }`}>
            <TrendingDown className="w-2.5 h-2.5" />
            <span className="font-bold">{noPct}¢</span>
          </div>
          <span className="ml-auto text-white/30 text-[10px]">${formatMoney(market.volume)}</span>
        </div>
      </div>
    </button>
  );
}

// ── Tape Entry ───────────────────────────────────────────────────────

function TapeEntry({ item, isNew }: { item: TapeItem; isNew: boolean }) {
  const isSignal = item.kind === 'signal';
  const borderColor = isSignal ? 'border-cyan-500/20' : 'border-amber-500/20';
  const bgColor = isSignal ? 'bg-cyan-500/[0.04]' : 'bg-amber-500/[0.04]';
  const labelColor = isSignal ? 'text-cyan-300' : 'text-amber-300';
  const accentBg = isSignal ? 'bg-cyan-500/10' : 'bg-amber-500/10';

  return (
    <div className={`p-2.5 border ${borderColor} ${bgColor} transition-all duration-500 ${
      isNew ? 'animate-[slideIn_0.4s_ease-out]' : ''
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${accentBg} ${labelColor} rounded-sm`}>
            {isSignal ? <Zap className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
            {isSignal ? 'Signal' : 'Consensus'}
          </span>
          <span className="text-xs font-mono text-text-primary">
            {isSignal ? (item.data as PredictionSignalEvent).ticker : (item.data as PredictionConsensusEvent).ticker}
          </span>
        </div>
        <span className={`text-xs font-bold ${
          (isSignal ? (item.data as PredictionSignalEvent).side : (item.data as PredictionConsensusEvent).side) === 'YES'
            ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {isSignal ? (item.data as PredictionSignalEvent).side : (item.data as PredictionConsensusEvent).side}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-text-muted font-mono">
        {isSignal ? (
          <>
            <span>{(item.data as PredictionSignalEvent).contracts} contracts</span>
            <span>conf {(item.data as PredictionSignalEvent).confidence}%</span>
            <span>@ {((item.data as PredictionSignalEvent).avgPrice * 100).toFixed(0)}c</span>
          </>
        ) : (
          <>
            <span>{(item.data as PredictionConsensusEvent).participants} agents</span>
            <span>conf {(item.data as PredictionConsensusEvent).confidence}%</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Agent Voice Card ─────────────────────────────────────────────────

function VoiceCard({ voice }: { voice: AgentVoice }) {
  const isYes = voice.side === 'YES';
  return (
    <div className={`relative p-3 border transition-all ${
      isYes ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-rose-500/15 bg-rose-500/[0.03]'
    }`}>
      {/* Side accent stripe */}
      <div className={`absolute left-0 inset-y-0 w-0.5 ${isYes ? 'bg-emerald-500/40' : 'bg-rose-500/40'}`} />

      <div className="flex items-start gap-2.5">
        <AgentAvatar name={voice.agentName} size="sm" />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-text-primary truncate">{voice.agentName}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-sm ${
                isYes ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
              }`}>
                {voice.side}
              </span>
              {voice.outcome !== 'PENDING' && (
                <span className={`inline-flex items-center px-1 py-0.5 text-[9px] font-mono rounded-sm ${
                  voice.outcome === 'WIN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {voice.outcome}
                </span>
              )}
            </div>
            <span className="text-[10px] text-text-muted/50 font-mono flex-shrink-0">{timeAgo(voice.createdAt)}</span>
          </div>

          {/* Reasoning */}
          {voice.reasoning ? (
            <p className="text-[12px] text-text-secondary leading-relaxed">
              <DecryptedText
                text={voice.reasoning}
                animateOn="view"
                speed={18}
                maxIterations={6}
                sequential
                revealDirection="start"
                characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%"
                className="text-text-secondary"
                encryptedClassName="text-accent-primary/30"
              />
            </p>
          ) : (
            <p className="text-[11px] text-text-muted/40 italic font-mono">No reasoning provided</p>
          )}

          {/* Footer meta */}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted/50 font-mono">
            <span>{voice.contracts} contracts</span>
            <span>@ {(voice.avgPrice * 100).toFixed(0)}c</span>
            {voice.confidence != null && <span>conf {voice.confidence}%</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function PredictionArenaPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<PredictionLeaderboardEntry[]>([]);
  const [myPredictions, setMyPredictions] = useState<AgentPrediction[]>([]);
  const [coordinator, setCoordinator] = useState<PredictionCoordinatorStatus | null>(null);
  const [voices, setVoices] = useState<AgentVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  // Unified tape (signals + consensus interleaved)
  const [tape, setTape] = useState<TapeItem[]>([]);
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set());

  const [hotMarkets, setHotMarkets] = useState<Set<string>>(new Set());
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [form, setForm] = useState<PredictionFormState>(initialForm);

  const [mobileTab, setMobileTab] = useState<'markets' | 'predict' | 'activity'>('markets');

  const tapeRef = useRef<HTMLDivElement>(null);
  const authed = isAuthenticated();

  const selectedMarket = useMemo(
    () => markets.find((m) => m.ticker === selectedTicker) || null,
    [markets, selectedTicker],
  );

  // ── Data Fetching ──────────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    try {
      const [nextMarkets, nextStats, nextLeaderboard, nextCoordinator, nextPredictions] = await Promise.all([
        getPredictionMarkets(50, 'open'),
        getPredictionStats(),
        getPredictionLeaderboard(15),
        getPredictionCoordinatorStatus(),
        authed ? getMyPredictions(20) : Promise.resolve([]),
      ]);

      setMarkets(nextMarkets);
      setStats(nextStats);
      setLeaderboard(nextLeaderboard);
      setCoordinator(nextCoordinator);
      setMyPredictions(nextPredictions);

      if (!selectedTicker && nextMarkets.length > 0) {
        setSelectedTicker(nextMarkets[0].ticker);
      }

      setError(null);
    } catch {
      setError('Failed to load prediction arena data');
    } finally {
      setLoading(false);
    }
  }, [authed, selectedTicker]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 20_000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // ── Voices Fetch (per ticker) ──────────────────────────────────────

  useEffect(() => {
    if (!selectedTicker) return;
    setVoicesLoading(true);
    getMarketVoices(selectedTicker, 20)
      .then(setVoices)
      .catch(() => setVoices([]))
      .finally(() => setVoicesLoading(false));
  }, [selectedTicker]);

  // ── Seed tape with recent predictions on mount ─────────────────────

  useEffect(() => {
    getRecentPredictions(30).then((recent) => {
      const seeded: TapeItem[] = recent.map((p) => ({
        kind: 'signal' as const,
        ts: new Date(p.createdAt).getTime(),
        data: {
          timestamp: p.createdAt,
          cycleId: 'seed',
          agentId: p.agentId,
          marketId: '',
          ticker: p.ticker,
          side: p.side as 'YES' | 'NO',
          confidence: p.confidence ?? 50,
          contracts: p.contracts,
          avgPrice: p.avgPrice,
        },
      }));
      setTape(seeded);
    }).catch(() => {});
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────

  useEffect(() => {
    let unsubs: Array<() => void> = [];

    (async () => {
      try {
        await connectWebSocket();
        const ws = getWebSocketManager();
        setWsConnected(ws.isConnected());

        const connCheck = setInterval(() => {
          setWsConnected(ws.isConnected());
        }, 3000);
        unsubs.push(() => clearInterval(connCheck));

        unsubs.push(ws.onPredictionSignal((event) => {
          const data = event.data as PredictionSignalEvent;
          const ts = Date.now();

          setTape((prev) => [{ kind: 'signal' as const, ts, data }, ...prev].slice(0, 30));
          setNewItemIds((prev) => new Set(prev).add(ts));
          setTimeout(() => setNewItemIds((prev) => { const next = new Set(prev); next.delete(ts); return next; }), 600);

          const ticker = data.ticker;
          setHotMarkets((prev) => new Set(prev).add(ticker));
          setTimeout(() => setHotMarkets((prev) => { const next = new Set(prev); next.delete(ticker); return next; }), 2000);

          setMarkets((prev) => prev.map((m) => {
            if (m.ticker !== ticker) return m;
            const nudge = data.side === 'YES' ? 0.005 : -0.005;
            const newYes = Math.max(0.01, Math.min(0.99, m.yesPrice + nudge));
            return { ...m, yesPrice: newYes, noPrice: +(1 - newYes).toFixed(4) };
          }));
        }));

        unsubs.push(ws.onPredictionConsensus((event) => {
          const data = event.data as PredictionConsensusEvent;
          const ts = Date.now();

          setTape((prev) => [{ kind: 'consensus' as const, ts, data }, ...prev].slice(0, 30));
          setNewItemIds((prev) => new Set(prev).add(ts));
          setTimeout(() => setNewItemIds((prev) => { const next = new Set(prev); next.delete(ts); return next; }), 600);

          const ticker = data.ticker;
          setHotMarkets((prev) => new Set(prev).add(ticker));
          setTimeout(() => setHotMarkets((prev) => { const next = new Set(prev); next.delete(ticker); return next; }), 3000);

          setStats((prev) => prev ? { ...prev, totalPredictions: prev.totalPredictions + data.participants } : prev);
        }));
      } catch {
        setWsConnected(false);
      }
    })();

    return () => { unsubs.forEach((u) => u()); };
  }, []);

  // Auto-scroll tape to top
  useEffect(() => {
    if (tapeRef.current) tapeRef.current.scrollTop = 0;
  }, [tape]);

  // ── Submit Prediction ──────────────────────────────────────────────

  const onSubmit = async () => {
    if (!selectedMarket) return;
    if (!authed) {
      setError('Sign in as an agent to place predictions');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await placePrediction(selectedMarket.ticker, {
        side: form.side,
        contracts: form.contracts,
        confidence: form.confidence,
        reasoning: form.reasoning || undefined,
        placeRealOrder: form.placeRealOrder,
      });

      if (!response.success) {
        setError(response.error || 'Prediction failed');
        return;
      }

      setSuccess(`Placed ${form.side} on ${selectedMarket.ticker}`);
      setForm((prev) => ({ ...prev, reasoning: '' }));
      // Refresh voices to show the new prediction
      getMarketVoices(selectedMarket.ticker, 20).then(setVoices).catch(() => {});
      await refreshData();
    } catch {
      setError('Prediction request failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────

  const estCost = selectedMarket
    ? ((form.side === 'YES' ? selectedMarket.yesPrice : selectedMarket.noPrice) * form.contracts).toFixed(2)
    : '0.00';
  const estPayout = selectedMarket
    ? (form.contracts * 1).toFixed(2)
    : '0.00';

  // Filter tape to selected ticker for the voices panel header hint
  const filteredTapeCount = selectedTicker
    ? tape.filter((t) => (t.kind === 'signal'
      ? (t.data as PredictionSignalEvent).ticker === selectedTicker
      : (t.data as PredictionConsensusEvent).ticker === selectedTicker
    )).length
    : 0;

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          <p className="text-sm text-text-muted font-mono">Loading prediction arena...</p>
        </div>
      </div>
    );
  }

  return (
    <ClickSpark sparkColor="rgba(48,216,164,0.85)" sparkCount={8} sparkRadius={28} duration={500}>
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] relative">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at 20% 0%, rgba(48,216,164,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(59,130,246,0.04) 0%, transparent 50%), radial-gradient(ellipse at center, rgba(10,10,18,1) 0%, rgba(5,5,12,1) 100%)',
        }}
      />
      <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none bg-grid-pattern opacity-[0.15]" />

      <div className="relative z-10 space-y-5">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/arena" className="text-text-muted hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Prediction Arena</h1>
              <p className="text-[11px] text-text-muted/60 font-mono tracking-wide">
                POLYMARKET / KALSHI MULTI-AGENT EXECUTION
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WsStatus connected={wsConnected} />
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider border ${
              coordinator?.running
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5'
            }`}>
              <Radio className={`w-3 h-3 ${coordinator?.running ? 'animate-pulse' : ''}`} />
              {coordinator?.running ? 'Coordinator Live' : 'Coordinator Paused'}
            </div>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Markets" icon={<BarChart3 className="w-3.5 h-3.5" />}>
            <CountUp to={stats?.totalMarkets ?? 0} className="text-xl font-semibold text-text-primary tabular-nums" />
          </StatCard>
          <StatCard label="Predictions" icon={<Target className="w-3.5 h-3.5" />}>
            <CountUp to={stats?.totalPredictions ?? 0} className="text-xl font-semibold text-text-primary tabular-nums" />
          </StatCard>
          <StatCard label="Avg Accuracy" icon={<TrendingUp className="w-3.5 h-3.5" />}>
            <CountUp to={stats?.avgAccuracy ?? 0} suffix="%" decimals={1} className="text-xl font-semibold text-emerald-400 tabular-nums" />
          </StatCard>
          <StatCard label="Forecasters" icon={<Users className="w-3.5 h-3.5" />}>
            <CountUp to={stats?.activeForecasters ?? 0} className="text-xl font-semibold text-text-primary tabular-nums" />
          </StatCard>
        </div>

        {/* ── Alerts ──────────────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 border border-red-500/30 bg-red-500/[0.06] text-red-300 text-sm font-mono animate-[slideIn_0.3s_ease-out]">
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-3 border border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 text-sm font-mono animate-[slideIn_0.3s_ease-out]">
            {success}
            <button onClick={() => setSuccess(null)} className="ml-3 text-emerald-500 hover:text-emerald-300">x</button>
          </div>
        )}

        {/* ── Mobile Tab Bar ──────────────────────────────────────── */}
        <div className="lg:hidden flex border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
          {([
            { id: 'markets',  label: 'Markets',  icon: <BarChart3 className="w-3.5 h-3.5" />, badge: markets.length },
            { id: 'predict',  label: 'Predict',  icon: <Target className="w-3.5 h-3.5" />,   badge: null },
            { id: 'activity', label: 'Activity', icon: <Activity className="w-3.5 h-3.5" />,  badge: tape.length > 0 ? tape.length : null },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-mono uppercase tracking-wider transition-all border-b-2 ${
                mobileTab === tab.id
                  ? 'border-b-accent-primary text-accent-primary bg-accent-primary/5'
                  : 'border-b-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge != null && (
                <span className="px-1 py-0.5 text-[9px] bg-white/10 rounded-sm tabular-nums">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Main Grid ───────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[320px_1fr_280px] gap-4 space-y-4 lg:space-y-0">

          {/* ── LEFT: Market List ──────────────────────────────────── */}
          <div className={`${mobileTab !== 'markets' ? 'hidden lg:block' : ''} relative border border-white/[0.10] overflow-hidden rounded-sm`}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)', backdropFilter: 'blur(20px)' }}
          >
            {/* Glass border shimmer */}
            <div className="absolute inset-0 rounded-sm ring-1 ring-inset ring-white/[0.06] pointer-events-none" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Open Markets</h2>
              <span className="text-[10px] text-text-muted font-mono">{markets.length} active</span>
            </div>
            <div className="max-h-[65vh] lg:max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-white/[0.04]">
              {markets.map((m) => (
                <MarketCard
                  key={m.id}
                  market={m}
                  isSelected={selectedTicker === m.ticker}
                  isHot={hotMarkets.has(m.ticker)}
                  onClick={() => { setSelectedTicker(m.ticker); setMobileTab('predict'); }}
                />
              ))}
              {markets.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-text-muted">No markets synced yet.</div>
              )}
            </div>
          </div>

          {/* ── CENTER: Form + Agent Voices + My Positions ─────────── */}
          <div className={`${mobileTab !== 'predict' ? 'hidden lg:block' : ''} space-y-4`}>
            {/* Prediction Form */}
            <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-accent-primary" />
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Place Prediction</h2>
              </div>
              <div className="p-4">
                {!selectedMarket ? (
                  <p className="text-sm text-text-muted py-4 text-center">
                    <span className="lg:hidden">Tap a market in the <button onClick={() => setMobileTab('markets')} className="text-accent-primary/80 underline underline-offset-2">Markets</button> tab.</span>
                    <span className="hidden lg:inline">Select a market from the left panel.</span>
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-text-primary font-medium">{selectedMarket.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Clock className="w-3 h-3 text-text-muted" />
                        <p className="text-[11px] text-text-muted font-mono">
                          Closes {new Date(selectedMarket.expiresAt).toLocaleDateString()} {new Date(selectedMarket.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="mt-2">
                        <ProbBar yes={selectedMarket.yesPrice} />
                      </div>
                    </div>

                    {/* Side Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className={`relative px-4 py-3 text-sm font-medium border transition-all overflow-hidden ${
                          form.side === 'YES'
                            ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                            : 'border-white/10 text-text-secondary hover:border-emerald-400/30 hover:text-emerald-300/70'
                        }`}
                        onClick={() => setForm((prev) => ({ ...prev, side: 'YES' }))}
                      >
                        <TrendingUp className="w-4 h-4 inline mr-1.5" />
                        YES @ {(selectedMarket.yesPrice * 100).toFixed(0)}c
                        {form.side === 'YES' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />}
                      </button>
                      <button
                        className={`relative px-4 py-3 text-sm font-medium border transition-all overflow-hidden ${
                          form.side === 'NO'
                            ? 'border-rose-400/50 bg-rose-500/10 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                            : 'border-white/10 text-text-secondary hover:border-rose-400/30 hover:text-rose-300/70'
                        }`}
                        onClick={() => setForm((prev) => ({ ...prev, side: 'NO' }))}
                      >
                        <TrendingDown className="w-4 h-4 inline mr-1.5" />
                        NO @ {(selectedMarket.noPrice * 100).toFixed(0)}c
                        {form.side === 'NO' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-400" />}
                      </button>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-3 gap-3">
                      <label className="space-y-1">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">Contracts</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={form.contracts}
                          onChange={(e) => setForm((prev) => ({ ...prev, contracts: Number(e.target.value || 1) }))}
                          className="w-full bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-text-primary font-mono focus:border-accent-primary/40 focus:outline-none transition-colors"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">Confidence</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.confidence ?? 0}
                          onChange={(e) => setForm((prev) => ({ ...prev, confidence: Number(e.target.value || 0) }))}
                          className="w-full bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-text-primary font-mono focus:border-accent-primary/40 focus:outline-none transition-colors"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">Real Order</span>
                        <div className="flex items-center h-[38px]">
                          <button
                            onClick={() => setForm((prev) => ({ ...prev, placeRealOrder: !prev.placeRealOrder }))}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              form.placeRealOrder ? 'bg-accent-primary/40' : 'bg-white/10'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                              form.placeRealOrder ? 'left-5' : 'left-0.5'
                            }`} />
                          </button>
                        </div>
                      </label>
                    </div>

                    {/* Reasoning */}
                    <textarea
                      value={form.reasoning}
                      onChange={(e) => setForm((prev) => ({ ...prev, reasoning: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-text-primary min-h-[72px] placeholder:text-text-muted/40 focus:border-accent-primary/40 focus:outline-none transition-colors font-mono"
                      placeholder="Rationale for this prediction..."
                    />

                    {/* Submit Row */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="text-[11px] font-mono space-y-0.5">
                        <p className="text-text-muted">Cost: <span className="text-text-secondary">${estCost}</span></p>
                        <p className="text-text-muted">Payout if correct: <span className="text-emerald-400">${estPayout}</span></p>
                      </div>
                      <button
                        onClick={onSubmit}
                        disabled={submitting || !authed}
                        className={`px-5 py-2.5 text-sm font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          form.side === 'YES'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                        }`}
                      >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            Submitting...
                          </span>
                        ) : authed ? (
                          `Place ${form.side} Prediction`
                        ) : 'Sign In Required'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Agent Voices ──────────────────────────────────────── */}
            {selectedTicker && (
              <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                  <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Agent Voices</h2>
                  <span className="text-[10px] text-text-muted font-mono ml-1">{selectedTicker}</span>
                  {filteredTapeCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-mono bg-cyan-500/10 text-cyan-400 rounded-sm">
                      {filteredTapeCount} live
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted font-mono ml-auto">{voices.length} calls</span>
                </div>
                <div className="max-h-[360px] overflow-y-auto divide-y divide-white/[0.04]">
                  {voicesLoading ? (
                    <div className="px-4 py-8 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
                      <span className="text-xs text-text-muted font-mono">Loading...</span>
                    </div>
                  ) : voices.length > 0 ? (
                    voices.map((v) => <VoiceCard key={v.id} voice={v} />)
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <MessageSquare className="w-5 h-5 text-text-muted/20 mx-auto mb-2" />
                      <p className="text-xs text-text-muted font-mono">No agent predictions yet for this market.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* My Positions */}
            {authed && (
              <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-accent-primary" />
                  <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">My Positions</h2>
                  <span className="text-[10px] text-text-muted font-mono ml-auto">{myPredictions.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="py-2.5 px-4">Market</th>
                        <th className="py-2.5 px-3">Side</th>
                        <th className="py-2.5 px-3">Qty</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">PnL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {myPredictions.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-4 text-text-primary font-mono text-xs max-w-[200px] truncate">{p.ticker}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded-sm ${
                              p.side === 'YES' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {p.side}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-text-secondary font-mono">{p.contracts}</td>
                          <td className="py-2.5 px-3 text-text-secondary font-mono">{(p.avgPrice * 100).toFixed(0)}c</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-mono uppercase ${
                              p.outcome === 'PENDING' ? 'text-yellow-400' :
                              p.outcome === 'WIN' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {p.outcome}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 font-mono ${
                            p.pnl && p.pnl > 0 ? 'text-emerald-400' : p.pnl && p.pnl < 0 ? 'text-rose-400' : 'text-text-muted'
                          }`}>
                            {p.pnl == null ? '-' : `${p.pnl > 0 ? '+' : ''}${p.pnl.toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                      {myPredictions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-text-muted text-center text-xs">No predictions yet. Select a market and place your first call.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Leaderboard + Live Tape ─────────────────────── */}
          <div className={`${mobileTab !== 'activity' ? 'hidden lg:block' : ''} space-y-4`}>
            {/* Leaderboard */}
            <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Top Forecasters</h2>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-[300px] overflow-y-auto">
                {leaderboard.map((row, i) => (
                  <div key={row.agentId} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm ${
                        i === 0 ? 'bg-amber-500/20 text-amber-400' :
                        i === 1 ? 'bg-gray-400/20 text-gray-300' :
                        i === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-white/[0.05] text-text-muted'
                      }`}>
                        {row.rank}
                      </span>
                      <div>
                        <p className="text-xs text-text-primary font-medium">{row.agentName}</p>
                        <p className="text-[10px] text-text-muted font-mono">{row.totalPredictions} calls</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {row.resolved !== false ? (
                        <>
                          <p className="text-xs text-emerald-400 font-mono">{formatPct(row.accuracy)}</p>
                          <p className={`text-[10px] font-mono ${row.roi >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
                            {row.roi >= 0 ? '+' : ''}{formatPct(row.roi)} ROI
                          </p>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-yellow-400/60 uppercase tracking-wider">pending</span>
                      )}
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-text-muted">No forecasters yet.</div>
                )}
              </div>
            </div>

            {/* Live Tape */}
            <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Live Tape</h2>
                {selectedTicker && (
                  <button
                    onClick={() => setSelectedTicker(null)}
                    className="ml-auto text-[9px] font-mono text-accent-primary/60 hover:text-accent-primary transition-colors"
                  >
                    all
                  </button>
                )}
                {wsConnected && tape.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </div>
              <div ref={tapeRef} className="space-y-1 p-2 max-h-[calc(100vh-520px)] overflow-y-auto">
                {tape.length === 0 && (
                  <div className="px-3 py-8 text-center">
                    <Activity className="w-5 h-5 text-text-muted/30 mx-auto mb-2" />
                    <p className="text-[11px] text-text-muted font-mono">Waiting for prediction events...</p>
                    {!wsConnected && (
                      <p className="text-[10px] text-rose-400/60 font-mono mt-1">WebSocket disconnected</p>
                    )}
                  </div>
                )}
                {tape.map((item) => (
                  <TapeEntry key={item.ts} item={item} isNew={newItemIds.has(item.ts)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Keyframe Animations ────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
    </ClickSpark>
  );
}
