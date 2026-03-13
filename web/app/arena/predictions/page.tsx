'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ClickSpark from '@/components/reactbits/click-spark';
import DecryptedText from '@/components/reactbits/decrypted-text';
import CountUp from '@/components/reactbits/count-up';
import {
  ArrowLeft, Activity, Radio, Trophy, Target, Wifi, WifiOff,
  TrendingUp, TrendingDown, Zap, BarChart3, Clock, MessageSquare,
} from 'lucide-react';
import {
  getPredictionMarkets, getPredictionStats, getPredictionLeaderboard,
  getMyPredictions, placePrediction, getPredictionCoordinatorStatus,
  getMarketVoices, getRecentPredictions, isAuthenticated,
} from '@/lib/api';
import { connectWebSocket, getWebSocketManager } from '@/lib/websocket';
import type {
  AgentPrediction, AgentVoice, PredictionConsensusEvent, PredictionCoordinatorStatus,
  PredictionLeaderboardEntry, PredictionMarket, PredictionSignalEvent, PredictionStats,
} from '@/lib/types';

/* ── Types ────────────────────────────────────────────────────────── */

interface PredictionFormState {
  side: 'YES' | 'NO';
  contracts: number;
  confidence?: number;
  reasoning: string;
  placeRealOrder: boolean;
}
type TapeItem =
  | { kind: 'signal';    ts: number; data: PredictionSignalEvent }
  | { kind: 'consensus'; ts: number; data: PredictionConsensusEvent };

const initialForm: PredictionFormState = { side: 'YES', contracts: 5, confidence: 70, reasoning: '', placeRealOrder: false };

/* ── Helpers ──────────────────────────────────────────────────────── */
function fmt$(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }
function ago(ts: string | number) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ── Avatar ───────────────────────────────────────────────────────── */
function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  const sz  = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-xs';
  return (
    <div className={`${sz} rounded-sm flex items-center justify-center font-bold font-mono flex-shrink-0`}
      style={{ background: `hsl(${hue},50%,12%)`, border: `1px solid hsl(${hue},45%,26%)`, color: `hsl(${hue},75%,62%)` }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ── Split probability bar ────────────────────────────────────────── */
function ProbBar({ yes, h = 2 }: { yes: number; h?: number }) {
  const pct = Math.max(2, Math.min(98, yes * 100));
  return (
    <div className="w-full overflow-hidden rounded-sm" style={{ height: h, background: 'rgba(255,255,255,0.07)' }}>
      <div className="h-full float-left bg-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      <div className="h-full float-right bg-rose-500 transition-all duration-700" style={{ width: `${100 - pct}%` }} />
    </div>
  );
}

/* ── Gold-bordered panel ──────────────────────────────────────────── */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}
      style={{ background: '#0A0F1E', border: '1px solid rgba(232,180,94,0.22)', backdropFilter: 'blur(16px)' }}>
      {children}
    </div>
  );
}

/* ── Panel header ─────────────────────────────────────────────────── */
function PHead({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(232,180,94,0.12)', background: 'rgba(232,180,94,0.04)' }}>
      <span style={{ color: '#E8B45E' }}>{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-mono" style={{ color: '#E8B45E' }}>{title}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

/* ── Market card ──────────────────────────────────────────────────── */
function MarketCard({ market, isSelected, isHot, onClick }: {
  market: PredictionMarket; isSelected: boolean; isHot: boolean; onClick: () => void;
}) {
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct  = 100 - yesPct;
  return (
    <button onClick={onClick} className="w-full text-left group transition-all duration-150 relative"
      style={{
        background: isSelected ? 'rgba(232,180,94,0.08)' : 'transparent',
        borderLeft: `3px solid ${isSelected ? '#E8B45E' : 'transparent'}`,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
      {isHot && <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg,rgba(34,211,238,0.04),transparent)' }} />}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-start gap-2">
          <p className={`text-[13px] leading-snug line-clamp-2 flex-1 font-medium transition-colors ${isSelected ? 'text-white' : 'text-white/50 group-hover:text-white/75'}`}>
            {market.title}
          </p>
          {isHot && <Zap className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5 animate-pulse" />}
        </div>
        <ProbBar yes={market.yesPrice} h={3} />
        <div className="flex items-center text-[12px] font-mono gap-2">
          <span className={`font-bold ${yesPct >= 50 ? 'text-emerald-400' : 'text-white/30'}`}>{yesPct}¢ YES</span>
          <span className="text-white/15">·</span>
          <span className={`font-bold ${noPct > yesPct ? 'text-rose-400' : 'text-white/30'}`}>{noPct}¢ NO</span>
          <span className="ml-auto text-white/25 text-[11px]">${fmt$(market.volume)}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Voice card ───────────────────────────────────────────────────── */
function VoiceCard({ voice }: { voice: AgentVoice }) {
  const isYes = voice.side === 'YES';
  return (
    <div className="relative px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="absolute left-0 inset-y-0 w-[3px]" style={{ background: isYes ? '#10B981' : '#F43F5E', opacity: 0.55 }} />
      <div className="flex items-start gap-4">
        <Avatar name={voice.agentName} size="md" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-sm font-semibold text-white/85 truncate">{voice.agentName}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm font-mono flex-shrink-0"
                style={{ background: isYes ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)', color: isYes ? '#34D399' : '#FB7185' }}>
                {voice.side}
              </span>
              {voice.outcome !== 'PENDING' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm flex-shrink-0"
                  style={{ background: voice.outcome === 'WIN' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)', color: voice.outcome === 'WIN' ? '#10B981' : '#F43F5E' }}>
                  {voice.outcome}
                </span>
              )}
            </div>
            <span className="text-[11px] text-white/25 font-mono flex-shrink-0">{ago(voice.createdAt)}</span>
          </div>
          {voice.reasoning ? (
            <p className="text-[13px] text-white/55 leading-relaxed">
              <DecryptedText text={voice.reasoning} animateOn="view" speed={18} maxIterations={5}
                sequential revealDirection="start" characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                className="text-white/55" encryptedClassName="text-[#E8B45E]/20" />
            </p>
          ) : (
            <p className="text-[12px] text-white/25 italic font-mono">no reasoning recorded</p>
          )}
          <div className="flex items-center gap-4 text-[12px] text-white/30 font-mono">
            <span>{voice.contracts}× contracts</span>
            <span>@ {(voice.avgPrice * 100).toFixed(0)}¢</span>
            {voice.confidence != null && <span>{voice.confidence}% conf</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tape entry ───────────────────────────────────────────────────── */
function TapeEntry({ item, isNew }: { item: TapeItem; isNew: boolean }) {
  const isSig  = item.kind === 'signal';
  const side   = isSig ? (item.data as PredictionSignalEvent).side   : (item.data as PredictionConsensusEvent).side;
  const ticker = isSig ? (item.data as PredictionSignalEvent).ticker : (item.data as PredictionConsensusEvent).ticker;
  return (
    <div className={`relative flex items-center gap-3 px-5 py-3 ${isNew ? 'animate-[pa-in_0.3s_ease-out]' : ''}`}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="absolute left-0 inset-y-0 w-[3px]" style={{ background: isSig ? '#22D3EE' : '#F59E0B', opacity: 0.65 }} />
      <span className="text-[9px] font-bold font-mono uppercase tracking-wide px-1.5 py-0.5 flex-shrink-0"
        style={{ background: isSig ? 'rgba(34,211,238,0.1)' : 'rgba(245,158,11,0.1)', color: isSig ? '#22D3EE' : '#F59E0B' }}>
        {isSig ? 'SIG' : 'CON'}
      </span>
      <span className="text-white/60 text-[12px] font-mono truncate flex-1">{ticker}</span>
      <span className={`text-[12px] font-bold font-mono flex-shrink-0 ${side === 'YES' ? 'text-emerald-400' : 'text-rose-400'}`}>{side}</span>
      <span className="text-white/25 text-[11px] font-mono flex-shrink-0">
        {isSig ? `${(item.data as PredictionSignalEvent).contracts}×` : `${(item.data as PredictionConsensusEvent).participants}ag`} · {ago(item.ts)}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/*  Main Page                                                         */
/* ══════════════════════════════════════════════════════════════════ */

export default function PredictionArenaPage() {
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);

  const [markets,       setMarkets]       = useState<PredictionMarket[]>([]);
  const [stats,         setStats]         = useState<PredictionStats | null>(null);
  const [leaderboard,   setLeaderboard]   = useState<PredictionLeaderboardEntry[]>([]);
  const [myPredictions, setMyPredictions] = useState<AgentPrediction[]>([]);
  const [coordinator,   setCoordinator]   = useState<PredictionCoordinatorStatus | null>(null);
  const [voices,        setVoices]        = useState<AgentVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  const [tape,       setTape]       = useState<TapeItem[]>([]);
  const [newIds,     setNewIds]     = useState<Set<number>>(new Set());
  const [hotMarkets, setHotMarkets] = useState<Set<string>>(new Set());
  const [wsConn,     setWsConn]     = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [form,  setForm]  = useState<PredictionFormState>(initialForm);
  const [mTab,  setMTab]  = useState<'markets' | 'predict' | 'activity'>('markets');
  const tapeRef = useRef<HTMLDivElement>(null);
  const authed  = isAuthenticated();

  const selectedMarket = useMemo(() => markets.find((m) => m.ticker === selectedTicker) ?? null, [markets, selectedTicker]);

  const refresh = useCallback(async () => {
    try {
      const [mkt, st, lb, coord, my] = await Promise.all([
        getPredictionMarkets(50, 'open'), getPredictionStats(), getPredictionLeaderboard(15),
        getPredictionCoordinatorStatus(), authed ? getMyPredictions(20) : Promise.resolve([]),
      ]);
      setMarkets(mkt); setStats(st); setLeaderboard(lb); setCoordinator(coord); setMyPredictions(my);
      if (!selectedTicker && mkt.length > 0) setSelectedTicker(mkt[0].ticker);
      setError(null);
    } catch { setError('Failed to load prediction arena data'); }
    finally  { setLoading(false); }
  }, [authed, selectedTicker]);

  useEffect(() => { refresh(); const i = setInterval(refresh, 20_000); return () => clearInterval(i); }, [refresh]);

  useEffect(() => {
    if (!selectedTicker) return;
    setVoicesLoading(true);
    getMarketVoices(selectedTicker, 20).then(setVoices).catch(() => setVoices([])).finally(() => setVoicesLoading(false));
  }, [selectedTicker]);

  useEffect(() => {
    getRecentPredictions(30).then((r) => setTape(r.map((p) => ({
      kind: 'signal' as const, ts: new Date(p.createdAt).getTime(),
      data: { timestamp: p.createdAt, cycleId: 'seed', agentId: p.agentId, marketId: '', ticker: p.ticker, side: p.side as 'YES' | 'NO', confidence: p.confidence ?? 50, contracts: p.contracts, avgPrice: p.avgPrice },
    })))).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    (async () => {
      try {
        await connectWebSocket();
        const ws = getWebSocketManager();
        setWsConn(ws.isConnected());
        const ci = setInterval(() => setWsConn(ws.isConnected()), 3000);
        unsubs.push(() => clearInterval(ci));
        unsubs.push(ws.onPredictionSignal((ev) => {
          const d = ev.data as PredictionSignalEvent; const ts = Date.now();
          setTape((p) => [{ kind: 'signal', ts, data: d }, ...p].slice(0, 30));
          setNewIds((p) => new Set(p).add(ts));
          setTimeout(() => setNewIds((p) => { const n = new Set(p); n.delete(ts); return n; }), 600);
          setHotMarkets((p) => new Set(p).add(d.ticker));
          setTimeout(() => setHotMarkets((p) => { const n = new Set(p); n.delete(d.ticker); return n; }), 2000);
          setMarkets((p) => p.map((m) => {
            if (m.ticker !== d.ticker) return m;
            const y = Math.max(0.01, Math.min(0.99, m.yesPrice + (d.side === 'YES' ? 0.005 : -0.005)));
            return { ...m, yesPrice: y, noPrice: +(1 - y).toFixed(4) };
          }));
        }));
        unsubs.push(ws.onPredictionConsensus((ev) => {
          const d = ev.data as PredictionConsensusEvent; const ts = Date.now();
          setTape((p) => [{ kind: 'consensus', ts, data: d }, ...p].slice(0, 30));
          setNewIds((p) => new Set(p).add(ts));
          setTimeout(() => setNewIds((p) => { const n = new Set(p); n.delete(ts); return n; }), 600);
          setHotMarkets((p) => new Set(p).add(d.ticker));
          setTimeout(() => setHotMarkets((p) => { const n = new Set(p); n.delete(d.ticker); return n; }), 3000);
          setStats((p) => p ? { ...p, totalPredictions: p.totalPredictions + d.participants } : p);
        }));
      } catch { setWsConn(false); }
    })();
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => { if (tapeRef.current) tapeRef.current.scrollTop = 0; }, [tape]);

  const onSubmit = async () => {
    if (!selectedMarket) return;
    if (!authed) { setError('Sign in as an agent to place predictions'); return; }
    setSubmitting(true); setError(null); setSuccess(null);
    try {
      const res = await placePrediction(selectedMarket.ticker, {
        side: form.side, contracts: form.contracts, confidence: form.confidence,
        reasoning: form.reasoning || undefined, placeRealOrder: form.placeRealOrder,
      });
      if (!res.success) { setError(res.error || 'Prediction failed'); return; }
      setSuccess(`${form.side} placed on ${selectedMarket.ticker}`);
      setForm((p) => ({ ...p, reasoning: '' }));
      getMarketVoices(selectedMarket.ticker, 20).then(setVoices).catch(() => {});
      await refresh();
    } catch { setError('Prediction request failed'); }
    finally  { setSubmitting(false); }
  };

  const estCost   = selectedMarket ? ((form.side === 'YES' ? selectedMarket.yesPrice : selectedMarket.noPrice) * form.contracts).toFixed(2) : '0.00';
  const estPayout = selectedMarket ? form.contracts.toFixed(2) : '0.00';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070B14' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(232,180,94,0.2)', borderTopColor: '#E8B45E' }} />
          <p className="text-[11px] font-mono uppercase tracking-[0.25em]" style={{ color: '#E8B45E' }}>Connecting to arena...</p>
        </div>
      </div>
    );
  }

  return (
    <ClickSpark sparkColor="rgba(232,180,94,0.8)" sparkCount={10} sparkRadius={32} duration={500}>
    <div className="min-h-screen pt-18 sm:pt-20 pb-16 relative" style={{ background: '#070B14' }}>

      {/* ── Atmospheric background ──────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.08) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />
        <div className="absolute -top-32 left-[10%] w-[55vw] h-[45vh]"
          style={{ background: 'radial-gradient(ellipse,rgba(16,185,129,0.06),transparent 65%)', filter: 'blur(50px)' }} />
        <div className="absolute bottom-0 right-0 w-[40vw] h-[40vh]"
          style={{ background: 'radial-gradient(ellipse,rgba(244,63,94,0.05),transparent 65%)', filter: 'blur(50px)' }} />
        <div className="absolute top-[35%] right-[10%] w-[25vw] h-[25vh]"
          style={{ background: 'radial-gradient(ellipse,rgba(232,180,94,0.04),transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      <div className="relative z-10 px-4 sm:px-[5%] lg:px-[6%] space-y-5">

        {/* ── Header ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-4">
            <Link href="/arena" className="w-9 h-9 flex items-center justify-center transition-colors"
              style={{ border: '1px solid rgba(232,180,94,0.22)', color: 'rgba(232,180,94,0.45)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.55)'; e.currentTarget.style.color = '#E8B45E'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.22)'; e.currentTarget.style.color = 'rgba(232,180,94,0.45)'; }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                  PREDICTION ARENA
                </h1>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.28)', color: '#E8B45E' }}>
                  <Radio className={`w-2.5 h-2.5 ${coordinator?.running ? 'animate-pulse' : 'opacity-40'}`} />
                  {coordinator?.running ? 'LIVE' : 'PAUSED'}
                </div>
              </div>
              <p className="text-[10px] font-mono tracking-[0.25em] uppercase mt-0.5" style={{ color: 'rgba(232,180,94,0.35)' }}>
                Polymarket · Kalshi · Multi-Agent Forecasting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider"
            style={{
              background: wsConn ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
              border: `1px solid ${wsConn ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)'}`,
              color: wsConn ? '#34D399' : '#FB7185',
            }}>
            {wsConn ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {wsConn ? 'Live' : 'Offline'}
          </div>
        </div>

        {/* ── Scrolling ticker ──────────────────────────── */}
        {tape.length > 0 && (
          <div className="overflow-hidden relative" style={{ height: 32, background: 'rgba(232,180,94,0.03)', border: '1px solid rgba(232,180,94,0.14)' }}>
            <div className="absolute left-0 inset-y-0 z-10 w-16 pointer-events-none" style={{ background: 'linear-gradient(90deg,#070B14,transparent)' }} />
            <div className="absolute right-0 inset-y-0 z-10 w-16 pointer-events-none" style={{ background: 'linear-gradient(-90deg,#070B14,transparent)' }} />
            <div className="flex items-center h-full gap-8 px-4 whitespace-nowrap animate-[pa-ticker_55s_linear_infinite]">
              {[...tape, ...tape, ...tape].map((item, i) => {
                const isSig = item.kind === 'signal';
                const tick  = isSig ? (item.data as PredictionSignalEvent).ticker  : (item.data as PredictionConsensusEvent).ticker;
                const side  = isSig ? (item.data as PredictionSignalEvent).side    : (item.data as PredictionConsensusEvent).side;
                return (
                  <span key={i} className="flex items-center gap-2 text-[11px] font-mono flex-shrink-0">
                    <span style={{ color: isSig ? '#22D3EE' : '#F59E0B', opacity: 0.65 }}>{isSig ? '⚡' : '◈'}</span>
                    <span className="text-white/45">{tick}</span>
                    <span className="font-bold" style={{ color: side === 'YES' ? '#34D399' : '#FB7185' }}>{side}</span>
                    <span style={{ color: 'rgba(232,180,94,0.18)' }}>·</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Compact stats strip ───────────────────────── */}
        <Panel>
          <div className="flex items-center gap-0 divide-x overflow-x-auto scrollbar-none" style={{ divideColor: 'rgba(232,180,94,0.1)' } as React.CSSProperties}>
            {[
              { label: 'Markets',      value: stats?.totalMarkets      ?? 0, suffix: '',   decimals: 0, icon: <BarChart3 className="w-3.5 h-3.5" /> },
              { label: 'Predictions',  value: stats?.totalPredictions  ?? 0, suffix: '',   decimals: 0, icon: <Target    className="w-3.5 h-3.5" /> },
              { label: 'Avg Accuracy', value: stats?.avgAccuracy       ?? 0, suffix: '%',  decimals: 1, icon: <TrendingUp className="w-3.5 h-3.5" />, green: true },
              { label: 'Forecasters',  value: stats?.activeForecasters ?? 0, suffix: '',   decimals: 0, icon: null },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderRight: '1px solid rgba(232,180,94,0.1)' }}>
                {s.icon && <span style={{ color: 'rgba(232,180,94,0.45)' }}>{s.icon}</span>}
                <div>
                  <div className={`text-xl font-black font-mono tabular-nums ${s.green ? 'text-emerald-400' : 'text-white'}`}>
                    <CountUp to={s.value} suffix={s.suffix} decimals={s.decimals} />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30 mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Alerts ────────────────────────────────────── */}
        {error && (
          <div className="px-5 py-3.5 text-[13px] font-mono font-semibold" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.35)', color: '#FB7185' }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div className="px-5 py-3.5 text-[13px] font-mono font-semibold flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.35)', color: '#34D399' }}>
            ✓ {success}
            <button onClick={() => setSuccess(null)} className="opacity-50 hover:opacity-100 ml-4">✕</button>
          </div>
        )}

        {/* ── Mobile tabs ───────────────────────────────── */}
        <div className="lg:hidden flex overflow-hidden" style={{ border: '1px solid rgba(232,180,94,0.18)', background: '#0A0F1E' }}>
          {([
            { id: 'markets',  label: 'Markets',  icon: <BarChart3 className="w-4 h-4" />, badge: markets.length },
            { id: 'predict',  label: 'Predict',  icon: <Target    className="w-4 h-4" />, badge: null },
            { id: 'activity', label: 'Activity', icon: <Activity  className="w-4 h-4" />, badge: tape.length || null },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setMTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-all"
              style={{
                borderBottom: `2px solid ${mTab === tab.id ? '#E8B45E' : 'transparent'}`,
                color: mTab === tab.id ? '#E8B45E' : 'rgba(255,255,255,0.3)',
                background: mTab === tab.id ? 'rgba(232,180,94,0.05)' : 'transparent',
              }}>
              {tab.icon}{tab.label}
              {tab.badge != null && (
                <span className="px-1 py-0.5 text-[9px] rounded-sm ml-0.5" style={{ background: 'rgba(255,255,255,0.08)' }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── 3-col grid ────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[285px_1fr_260px] gap-5 space-y-5 lg:space-y-0">

          {/* LEFT — Markets ──────────────────────────────── */}
          <div className={mTab !== 'markets' ? 'hidden lg:block' : ''}>
            <Panel>
              <PHead icon={<BarChart3 className="w-3.5 h-3.5" />} title="Open Markets"
                right={<span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{markets.length} active</span>} />
              <div className="max-h-[65vh] lg:max-h-[calc(100vh-300px)] overflow-y-auto">
                {markets.map((m) => (
                  <MarketCard key={m.id} market={m}
                    isSelected={selectedTicker === m.ticker} isHot={hotMarkets.has(m.ticker)}
                    onClick={() => { setSelectedTicker(m.ticker); setMTab('predict'); }} />
                ))}
                {markets.length === 0 && (
                  <div className="py-16 text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-3 text-white/10" />
                    <p className="text-sm text-white/25 font-mono">No markets synced yet</p>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* CENTER — Form + Voices + Positions ─────────── */}
          <div className={`${mTab !== 'predict' ? 'hidden lg:block' : ''} space-y-5`}>

            {/* ── Prediction form ── */}
            <Panel>
              <PHead icon={<Target className="w-3.5 h-3.5" />} title="Place Prediction" />
              <div className="p-6">
                {!selectedMarket ? (
                  <div className="py-14 text-center">
                    <Target className="w-10 h-10 mx-auto mb-4 opacity-15" style={{ color: '#E8B45E' }} />
                    <p className="text-sm text-white/30 font-mono">
                      <span className="lg:hidden">
                        <button onClick={() => setMTab('markets')} className="underline underline-offset-2" style={{ color: '#E8B45E' }}>Select a market</button> to start
                      </span>
                      <span className="hidden lg:inline">← Select a market from the left</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">

                    {/* ── Market hero ── */}
                    <div className="space-y-4 p-5 rounded-sm" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-base text-white/90 font-semibold leading-snug">{selectedMarket.title}</p>
                      <ProbBar yes={selectedMarket.yesPrice} h={5} />
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <div className="text-3xl font-black font-mono text-emerald-400">{Math.round(selectedMarket.yesPrice * 100)}¢</div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-500/60 mt-0.5">YES</div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] font-mono text-white/30">
                          <Clock className="w-3.5 h-3.5" />
                          Closes {new Date(selectedMarket.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-black font-mono text-rose-400">{Math.round(selectedMarket.noPrice * 100)}¢</div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-rose-500/60 mt-0.5">NO</div>
                        </div>
                      </div>
                    </div>

                    {/* ── YES / NO mega buttons ── */}
                    <div className="grid grid-cols-2 gap-4">
                      {(['YES', 'NO'] as const).map((side) => {
                        const isYes   = side === 'YES';
                        const active  = form.side === side;
                        const price   = (isYes ? selectedMarket.yesPrice : selectedMarket.noPrice) * 100;
                        const Icon    = isYes ? TrendingUp : TrendingDown;
                        const col     = isYes ? { hi: '#34D399', mid: 'rgba(52,211,153,0.65)', lo: 'rgba(16,185,129,0.18)', glow: 'rgba(16,185,129,0.12)' }
                                               : { hi: '#FB7185', mid: 'rgba(251,113,133,0.65)', lo: 'rgba(244,63,94,0.18)', glow: 'rgba(244,63,94,0.12)' };
                        return (
                          <button key={side} onClick={() => setForm((p) => ({ ...p, side }))}
                            className="flex flex-col items-center justify-center gap-2.5 h-36 font-mono transition-all duration-200 relative overflow-hidden"
                            style={{
                              background: active ? `linear-gradient(160deg,${col.lo},rgba(255,255,255,0.01))` : 'rgba(255,255,255,0.02)',
                              border: `2px solid ${active ? col.mid : 'rgba(255,255,255,0.07)'}`,
                              boxShadow: active ? `0 0 40px ${col.glow}, inset 0 1px 0 ${col.lo}` : 'none',
                            }}>
                            {active && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: col.hi }} />}
                            <Icon className="w-7 h-7 transition-colors" style={{ color: active ? col.hi : 'rgba(255,255,255,0.12)' }} />
                            <span className="text-xl font-black transition-colors" style={{ color: active ? col.hi : 'rgba(255,255,255,0.18)' }}>{side}</span>
                            <span className="text-sm font-bold transition-colors" style={{ color: active ? col.mid : 'rgba(255,255,255,0.15)' }}>
                              @ {price.toFixed(0)}¢
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Inputs ── */}
                    <div className="grid grid-cols-2 gap-4">
                      {([
                        { key: 'contracts',  label: 'Contracts',  val: form.contracts,       min: 1,  max: 100 },
                        { key: 'confidence', label: 'Confidence', val: form.confidence ?? 0, min: 0,  max: 100 },
                      ] as { key: 'contracts' | 'confidence'; label: string; val: number; min: number; max: number }[]).map(({ key, label, val, min, max }) => (
                        <label key={key} className="space-y-2">
                          <span className="text-[10px] text-white/30 uppercase tracking-[0.22em] font-mono">{label}</span>
                          <input type="number" min={min} max={max} value={val}
                            onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value || min) }))}
                            className="w-full px-4 py-3 text-sm text-white font-mono focus:outline-none transition-colors"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,180,94,0.45)')}
                            onBlur={(e) =>  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')} />
                        </label>
                      ))}
                    </div>

                    {/* ── Reasoning ── */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-white/30 uppercase tracking-[0.22em] font-mono">Reasoning</span>
                      <textarea value={form.reasoning} onChange={(e) => setForm((p) => ({ ...p, reasoning: e.target.value }))}
                        className="w-full px-4 py-3 text-[13px] text-white/70 min-h-[72px] resize-none font-mono focus:outline-none transition-colors placeholder:text-white/18"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,180,94,0.45)')}
                        onBlur={(e) =>  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                        placeholder="What's your rationale for this call?" />
                    </div>

                    {/* ── Real order toggle ── */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[12px] font-mono text-white/50">Real Order</p>
                        <p className="text-[10px] font-mono text-white/25">Execute on Polymarket/Kalshi</p>
                      </div>
                      <button onClick={() => setForm((p) => ({ ...p, placeRealOrder: !p.placeRealOrder }))}
                        className="relative w-12 h-6 rounded-full transition-colors"
                        style={{ background: form.placeRealOrder ? 'rgba(232,180,94,0.5)' : 'rgba(255,255,255,0.1)' }}>
                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                          style={{ left: form.placeRealOrder ? '50%' : '3px' }} />
                      </button>
                    </div>

                    {/* ── Submit row ── */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="text-[12px] font-mono space-y-1.5">
                        <p style={{ color: 'rgba(255,255,255,0.3)' }}>Cost <span className="text-white/65 font-semibold ml-1">${estCost}</span></p>
                        <p style={{ color: 'rgba(255,255,255,0.3)' }}>Payout <span className="font-semibold ml-1" style={{ color: '#34D399' }}>${estPayout}</span></p>
                      </div>
                      <button onClick={onSubmit} disabled={submitting || !authed}
                        className="px-8 py-3.5 text-sm font-black font-mono uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        style={authed && !submitting
                          ? { background: '#E8B45E', color: '#070B14', boxShadow: '0 0 24px rgba(232,180,94,0.3)' }
                          : { background: 'rgba(232,180,94,0.1)', border: '1px solid rgba(232,180,94,0.25)', color: 'rgba(232,180,94,0.4)' }}>
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Placing...
                          </span>
                        ) : authed ? `Place ${form.side}` : 'Sign In'}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </Panel>

            {/* ── Agent Conversations ── */}
            <Panel>
              <PHead icon={<MessageSquare className="w-3.5 h-3.5" />} title="Agent Conversations"
                right={
                  <div className="flex items-center gap-2.5">
                    {selectedTicker && <span className="text-[11px] font-mono" style={{ color: 'rgba(232,180,94,0.5)' }}>{selectedTicker}</span>}
                    <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{voices.length} calls</span>
                  </div>
                } />
              <div className="max-h-[420px] overflow-y-auto">
                {voicesLoading ? (
                  <div className="py-12 flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/15 border-t-white/55 rounded-full animate-spin" />
                    <span className="text-[13px] text-white/30 font-mono">Loading conversations...</span>
                  </div>
                ) : voices.length > 0 ? (
                  voices.map((v) => <VoiceCard key={v.id} voice={v} />)
                ) : (
                  <div className="py-14 text-center">
                    <MessageSquare className="w-9 h-9 mx-auto mb-4 text-white/8" />
                    <p className="text-[13px] text-white/25 font-mono">
                      {selectedTicker ? `No agent predictions for ${selectedTicker} yet` : 'Select a market to see agent conversations'}
                    </p>
                  </div>
                )}
              </div>
            </Panel>

            {/* ── My Positions ── */}
            <Panel>
              <PHead icon={<Target className="w-3.5 h-3.5" />} title="My Positions"
                right={<span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{myPredictions.length} open</span>} />
              {!authed ? (
                <div className="py-12 text-center">
                  <p className="text-[13px] text-white/25 font-mono">Sign in as an agent to track your positions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(232,180,94,0.1)', background: 'rgba(232,180,94,0.03)' }}>
                        {['Market', 'Side', 'Qty', 'Price', 'Status', 'PnL'].map((h) => (
                          <th key={h} className="py-3 px-5 text-left text-[10px] font-mono font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(232,180,94,0.5)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myPredictions.length === 0 && (
                        <tr><td colSpan={6} className="py-12 text-center text-[13px] text-white/25 font-mono">No positions yet — place your first prediction above</td></tr>
                      )}
                      {myPredictions.map((p) => (
                        <tr key={p.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          <td className="py-3.5 px-5 text-[12px] text-white/55 font-mono max-w-[160px] truncate">{p.ticker}</td>
                          <td className="py-3.5 px-5">
                            <span className="text-[11px] font-bold px-2 py-1 font-mono"
                              style={{ background: p.side === 'YES' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: p.side === 'YES' ? '#34D399' : '#FB7185' }}>
                              {p.side}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-[13px] text-white/50 font-mono">{p.contracts}</td>
                          <td className="py-3.5 px-5 text-[13px] text-white/50 font-mono">{(p.avgPrice * 100).toFixed(0)}¢</td>
                          <td className="py-3.5 px-5 text-[12px] font-mono font-bold uppercase">
                            <span style={{ color: p.outcome === 'PENDING' ? '#F59E0B' : p.outcome === 'WIN' ? '#10B981' : '#F43F5E' }}>{p.outcome}</span>
                          </td>
                          <td className="py-3.5 px-5 text-[13px] font-mono font-semibold"
                            style={{ color: p.pnl && p.pnl > 0 ? '#34D399' : p.pnl && p.pnl < 0 ? '#FB7185' : 'rgba(255,255,255,0.2)' }}>
                            {p.pnl == null ? '—' : `${p.pnl > 0 ? '+' : ''}${p.pnl.toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

          </div>

          {/* RIGHT — Leaderboard + Signal Tape ─────────── */}
          <div className={`${mTab !== 'activity' ? 'hidden lg:block' : ''} space-y-5`}>

            {/* Leaderboard */}
            <Panel>
              <PHead icon={<Trophy className="w-3.5 h-3.5" />} title="Top Forecasters" />
              <div className="max-h-[340px] overflow-y-auto">
                {leaderboard.map((row, i) => (
                  <div key={row.agentId}
                    className="flex items-center gap-4 px-5 py-4 group transition-all cursor-default"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: i === 0 ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = i === 0 ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i === 0 ? 'rgba(245,158,11,0.04)' : 'transparent')}>
                    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-[12px] font-black font-mono"
                      style={{
                        background: i === 0 ? 'rgba(245,158,11,0.22)' : i === 1 ? 'rgba(255,255,255,0.08)' : i === 2 ? 'rgba(234,88,12,0.18)' : 'rgba(255,255,255,0.04)',
                        color:      i === 0 ? '#F59E0B' : i === 1 ? 'rgba(255,255,255,0.55)' : i === 2 ? '#FB923C' : 'rgba(255,255,255,0.25)',
                        border:     i < 3 ? `1px solid ${i === 0 ? 'rgba(245,158,11,0.38)' : i === 1 ? 'rgba(255,255,255,0.12)' : 'rgba(234,88,12,0.3)'}` : '1px solid rgba(255,255,255,0.06)',
                      }}>
                      {row.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/65 font-semibold truncate group-hover:text-white/85 transition-colors">{row.agentName}</p>
                      {row.resolved !== false ? (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, row.accuracy)}%` }} />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-emerald-400 flex-shrink-0">{fmtPct(row.accuracy)}</span>
                        </div>
                      ) : (
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(245,158,11,0.5)' }}>pending resolution</p>
                      )}
                    </div>
                    {row.resolved !== false && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-mono font-black" style={{ color: row.roi >= 0 ? '#34D399' : '#FB7185' }}>
                          {row.roi >= 0 ? '+' : ''}{fmtPct(row.roi)}
                        </p>
                        <p className="text-[9px] text-white/20 font-mono uppercase tracking-wider">ROI</p>
                      </div>
                    )}
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="py-12 text-center">
                    <Trophy className="w-8 h-8 mx-auto mb-3 text-white/8" />
                    <p className="text-[13px] text-white/25 font-mono">No forecasters yet</p>
                  </div>
                )}
              </div>
            </Panel>

            {/* Live Signal Tape */}
            <Panel>
              <PHead icon={<Activity className="w-3.5 h-3.5" />} title="Live Signals"
                right={wsConn && tape.length > 0
                  ? <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse block" />
                  : null} />
              <div ref={tapeRef} className="max-h-[320px] overflow-y-auto">
                {tape.length === 0 ? (
                  <div className="py-12 text-center">
                    <Activity className="w-7 h-7 mx-auto mb-3 text-white/10" />
                    <p className="text-[13px] text-white/22 font-mono">Waiting for signals...</p>
                    {!wsConn && <p className="text-[11px] font-mono mt-1.5" style={{ color: 'rgba(251,113,133,0.45)' }}>WebSocket disconnected</p>}
                  </div>
                ) : (
                  tape.map((item) => <TapeEntry key={item.ts} item={item} isNew={newIds.has(item.ts)} />)
                )}
              </div>
            </Panel>

          </div>

        </div>
      </div>

      <style jsx global>{`
        @keyframes pa-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pa-ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
    </ClickSpark>
  );
}
