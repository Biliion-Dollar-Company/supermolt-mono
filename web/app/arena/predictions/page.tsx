'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ClickSpark from '@/components/reactbits/click-spark';
import DecryptedText from '@/components/reactbits/decrypted-text';
import CountUp from '@/components/reactbits/count-up';
import {
  ArrowLeft, Activity, Radio, Trophy, Target, Wifi, WifiOff,
  TrendingUp, TrendingDown, BarChart3, Clock, MessageSquare,
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

const GOLD = '#E8B45E';
const YES_COLOR = '#4ade80';  /* one green — used sparingly */
const NO_COLOR  = '#f87171';  /* one red   — used sparingly */

/* ── Avatar ───────────────────────────────────────────────────────── */
function Avatar({ name }: { name: string }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div className="w-9 h-9 rounded-sm flex items-center justify-center text-[11px] font-bold font-mono flex-shrink-0"
      style={{ background: `hsl(${hue},30%,10%)`, border: `1px solid hsl(${hue},30%,22%)`, color: `hsl(${hue},55%,58%)` }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ── Probability bar — just two tones, no neon ───────────────────── */
function ProbBar({ yes, h = 3 }: { yes: number; h?: number }) {
  const pct = Math.max(2, Math.min(98, yes * 100));
  return (
    <div className="w-full overflow-hidden" style={{ height: h, background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full float-left transition-all duration-700" style={{ width: `${pct}%`, background: 'rgba(74,222,128,0.55)' }} />
      <div className="h-full float-right transition-all duration-700" style={{ width: `${100 - pct}%`, background: 'rgba(248,113,113,0.45)' }} />
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}
      style={{ background: '#080D1A', border: `1px solid rgba(232,180,94,0.18)` }}>
      {children}
    </div>
  );
}

/* ── Panel header ─────────────────────────────────────────────────── */
function PHead({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid rgba(232,180,94,0.1)`, background: 'rgba(232,180,94,0.03)' }}>
      <span style={{ color: GOLD, opacity: 0.7 }}>{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-mono" style={{ color: GOLD }}>{title}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

/* ── Market card ──────────────────────────────────────────────────── */
function MarketCard({ market, isSelected, onClick }: {
  market: PredictionMarket; isSelected: boolean; onClick: () => void;
}) {
  const yesPct = Math.round(market.yesPrice * 100);
  return (
    <button onClick={onClick} className="w-full text-left group transition-all duration-150"
      style={{
        background: isSelected ? 'rgba(232,180,94,0.06)' : 'transparent',
        borderLeft: `3px solid ${isSelected ? GOLD : 'transparent'}`,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
      <div className="px-5 py-4 space-y-3">
        <p className={`text-[13px] leading-snug line-clamp-2 font-medium transition-colors ${isSelected ? 'text-white' : 'text-white/45 group-hover:text-white/70'}`}>
          {market.title}
        </p>
        <ProbBar yes={market.yesPrice} />
        <div className="flex items-center text-[12px] font-mono">
          <span className="font-semibold" style={{ color: yesPct >= 50 ? YES_COLOR : 'rgba(255,255,255,0.25)' }}>{yesPct}¢ YES</span>
          <span className="mx-2 text-white/12">·</span>
          <span className="font-semibold" style={{ color: yesPct < 50 ? NO_COLOR : 'rgba(255,255,255,0.25)' }}>{100 - yesPct}¢ NO</span>
          <span className="ml-auto text-white/22 text-[11px]">${fmt$(market.volume)}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Voice card ───────────────────────────────────────────────────── */
function VoiceCard({ voice }: { voice: AgentVoice }) {
  const isYes = voice.side === 'YES';
  return (
    <div className="relative px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="absolute left-0 inset-y-0 w-[2px]" style={{ background: isYes ? YES_COLOR : NO_COLOR, opacity: 0.4 }} />
      <div className="flex items-start gap-4">
        <Avatar name={voice.agentName} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-sm font-semibold text-white/80 truncate">{voice.agentName}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 font-mono flex-shrink-0"
                style={{ background: isYes ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: isYes ? YES_COLOR : NO_COLOR }}>
                {voice.side}
              </span>
              {voice.outcome !== 'PENDING' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 flex-shrink-0"
                  style={{ color: voice.outcome === 'WIN' ? YES_COLOR : NO_COLOR, opacity: 0.7 }}>
                  {voice.outcome}
                </span>
              )}
            </div>
            <span className="text-[11px] text-white/22 font-mono flex-shrink-0">{ago(voice.createdAt)}</span>
          </div>
          {voice.reasoning ? (
            <p className="text-[13px] text-white/50 leading-relaxed">
              <DecryptedText text={voice.reasoning} animateOn="view" speed={18} maxIterations={5}
                sequential revealDirection="start" characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                className="text-white/50" encryptedClassName="text-white/15" />
            </p>
          ) : (
            <p className="text-[12px] text-white/22 italic font-mono">no reasoning recorded</p>
          )}
          <div className="flex items-center gap-4 text-[11px] text-white/28 font-mono">
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
      <div className="absolute left-0 inset-y-0 w-[2px]" style={{ background: GOLD, opacity: isSig ? 0.5 : 0.3 }} />
      <span className="text-[9px] font-bold font-mono uppercase tracking-wide px-1.5 py-0.5 flex-shrink-0"
        style={{ background: 'rgba(232,180,94,0.08)', color: GOLD, opacity: 0.65 }}>
        {isSig ? 'SIG' : 'CON'}
      </span>
      <span className="text-white/55 text-[12px] font-mono truncate flex-1">{ticker}</span>
      <span className="text-[12px] font-bold font-mono flex-shrink-0" style={{ color: side === 'YES' ? YES_COLOR : NO_COLOR }}>{side}</span>
      <span className="text-white/22 text-[11px] font-mono flex-shrink-0">{ago(item.ts)}</span>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060A14' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(232,180,94,0.15)', borderTopColor: GOLD }} />
          <p className="text-[11px] font-mono uppercase tracking-[0.25em]" style={{ color: GOLD, opacity: 0.6 }}>Connecting to arena...</p>
        </div>
      </div>
    );
  }

  return (
    <ClickSpark sparkColor="rgba(232,180,94,0.7)" sparkCount={8} sparkRadius={28} duration={450}>
    <div className="min-h-screen pt-18 sm:pt-20 pb-16" style={{ background: '#060A14' }}>

      {/* ── One subtle gold glow — nothing else ──────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        <div className="absolute top-0 left-1/4 w-[60vw] h-[40vh]"
          style={{ background: `radial-gradient(ellipse,rgba(232,180,94,0.04),transparent 65%)`, filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 px-4 sm:px-[5%] lg:px-[6%] space-y-5">

        {/* ── Header ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-4">
            <Link href="/arena" className="w-9 h-9 flex items-center justify-center transition-colors"
              style={{ border: `1px solid rgba(232,180,94,0.2)`, color: `rgba(232,180,94,0.4)` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(232,180,94,0.5)`; e.currentTarget.style.color = GOLD; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `rgba(232,180,94,0.2)`; e.currentTarget.style.color = `rgba(232,180,94,0.4)`; }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                  PREDICTION ARENA
                </h1>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(232,180,94,0.07)', border: `1px solid rgba(232,180,94,0.22)`, color: GOLD }}>
                  <Radio className={`w-2.5 h-2.5 ${coordinator?.running ? 'animate-pulse' : 'opacity-40'}`} />
                  {coordinator?.running ? 'LIVE' : 'PAUSED'}
                </div>
              </div>
              <p className="text-[10px] font-mono tracking-[0.22em] uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Polymarket · Kalshi · Multi-Agent Forecasting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-semibold"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${wsConn ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
              color: wsConn ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
            }}>
            {wsConn ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {wsConn ? 'Live' : 'Offline'}
          </div>
        </div>

        {/* ── Scrolling ticker ──────────────────────────── */}
        {tape.length > 0 && (
          <div className="overflow-hidden relative" style={{ height: 30, background: 'rgba(232,180,94,0.025)', border: `1px solid rgba(232,180,94,0.1)` }}>
            <div className="absolute left-0 inset-y-0 z-10 w-16 pointer-events-none" style={{ background: 'linear-gradient(90deg,#060A14,transparent)' }} />
            <div className="absolute right-0 inset-y-0 z-10 w-16 pointer-events-none" style={{ background: 'linear-gradient(-90deg,#060A14,transparent)' }} />
            <div className="flex items-center h-full gap-8 px-4 whitespace-nowrap animate-[pa-ticker_55s_linear_infinite]">
              {[...tape, ...tape, ...tape].map((item, i) => {
                const isSig = item.kind === 'signal';
                const tick  = isSig ? (item.data as PredictionSignalEvent).ticker  : (item.data as PredictionConsensusEvent).ticker;
                const side  = isSig ? (item.data as PredictionSignalEvent).side    : (item.data as PredictionConsensusEvent).side;
                return (
                  <span key={i} className="flex items-center gap-2 text-[11px] font-mono flex-shrink-0">
                    <span style={{ color: GOLD, opacity: 0.4 }}>◆</span>
                    <span className="text-white/38">{tick}</span>
                    <span className="font-semibold" style={{ color: side === 'YES' ? YES_COLOR : NO_COLOR, opacity: 0.8 }}>{side}</span>
                    <span className="text-white/12">·</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stats strip ───────────────────────────────── */}
        <Panel>
          <div className="flex items-center overflow-x-auto scrollbar-none">
            {[
              { label: 'Markets',      value: stats?.totalMarkets      ?? 0, suffix: '',  decimals: 0 },
              { label: 'Predictions',  value: stats?.totalPredictions  ?? 0, suffix: '',  decimals: 0 },
              { label: 'Avg Accuracy', value: stats?.avgAccuracy       ?? 0, suffix: '%', decimals: 1 },
              { label: 'Forecasters',  value: stats?.activeForecasters ?? 0, suffix: '',  decimals: 0 },
            ].map((s, i, arr) => (
              <div key={i} className="flex-1 px-6 py-5 flex-shrink-0"
                style={{ borderRight: i < arr.length - 1 ? 'rgba(232,180,94,0.08)' : undefined, borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightStyle: 'solid' }}>
                <div className="text-[22px] font-black font-mono tabular-nums text-white">
                  <CountUp to={s.value} suffix={s.suffix} decimals={s.decimals} />
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Alerts ────────────────────────────────────── */}
        {error && (
          <div className="px-5 py-3.5 text-[13px] font-mono" style={{ background: 'rgba(248,113,113,0.07)', border: `1px solid rgba(248,113,113,0.25)`, color: NO_COLOR }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div className="px-5 py-3.5 text-[13px] font-mono flex items-center justify-between" style={{ background: 'rgba(74,222,128,0.07)', border: `1px solid rgba(74,222,128,0.25)`, color: YES_COLOR }}>
            ✓ {success}
            <button onClick={() => setSuccess(null)} className="opacity-50 hover:opacity-100 ml-4">✕</button>
          </div>
        )}

        {/* ── Mobile tabs ───────────────────────────────── */}
        <div className="lg:hidden flex overflow-hidden" style={{ border: `1px solid rgba(232,180,94,0.15)`, background: '#080D1A' }}>
          {([
            { id: 'markets',  label: 'Markets',  icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'predict',  label: 'Predict',  icon: <Target    className="w-4 h-4" /> },
            { id: 'activity', label: 'Activity', icon: <Activity  className="w-4 h-4" /> },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setMTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-all"
              style={{
                borderBottom: `2px solid ${mTab === tab.id ? GOLD : 'transparent'}`,
                color: mTab === tab.id ? GOLD : 'rgba(255,255,255,0.28)',
                background: mTab === tab.id ? 'rgba(232,180,94,0.04)' : 'transparent',
              }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* ── 3-col grid ────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[280px_1fr_255px] gap-5 space-y-5 lg:space-y-0">

          {/* LEFT — Markets ──────────────────────────────── */}
          <div className={mTab !== 'markets' ? 'hidden lg:block' : ''}>
            <Panel>
              <PHead icon={<BarChart3 className="w-3.5 h-3.5" />} title="Open Markets"
                right={<span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{markets.length}</span>} />
              <div className="max-h-[65vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto">
                {markets.map((m) => (
                  <MarketCard key={m.id} market={m}
                    isSelected={selectedTicker === m.ticker}
                    onClick={() => { setSelectedTicker(m.ticker); setMTab('predict'); }} />
                ))}
                {markets.length === 0 && (
                  <div className="py-16 text-center text-sm text-white/20 font-mono">No markets synced yet</div>
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
                    <Target className="w-10 h-10 mx-auto mb-4" style={{ color: GOLD, opacity: 0.12 }} />
                    <p className="text-sm text-white/25 font-mono">
                      <span className="lg:hidden">
                        <button onClick={() => setMTab('markets')} className="underline underline-offset-2" style={{ color: GOLD, opacity: 0.7 }}>Select a market</button> to start
                      </span>
                      <span className="hidden lg:inline">← Select a market from the left</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">

                    {/* ── Market hero ── */}
                    <div className="space-y-4">
                      <p className="text-base text-white/85 font-semibold leading-snug">{selectedMarket.title}</p>
                      <ProbBar yes={selectedMarket.yesPrice} h={4} />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-black font-mono" style={{ color: YES_COLOR }}>{Math.round(selectedMarket.yesPrice * 100)}¢</div>
                          <div className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: YES_COLOR, opacity: 0.45 }}>YES</div>
                        </div>
                        <div className="text-[11px] font-mono text-white/25 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {new Date(selectedMarket.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-black font-mono" style={{ color: NO_COLOR }}>{Math.round(selectedMarket.noPrice * 100)}¢</div>
                          <div className="text-[10px] font-mono uppercase tracking-wider mt-0.5 text-right" style={{ color: NO_COLOR, opacity: 0.45 }}>NO</div>
                        </div>
                      </div>
                    </div>

                    {/* ── YES / NO buttons ── */}
                    <div className="grid grid-cols-2 gap-4">
                      {(['YES', 'NO'] as const).map((side) => {
                        const isYes  = side === 'YES';
                        const active = form.side === side;
                        const col    = isYes ? YES_COLOR : NO_COLOR;
                        const price  = (isYes ? selectedMarket.yesPrice : selectedMarket.noPrice) * 100;
                        const Icon   = isYes ? TrendingUp : TrendingDown;
                        return (
                          <button key={side} onClick={() => setForm((p) => ({ ...p, side }))}
                            className="flex flex-col items-center justify-center gap-2.5 h-36 font-mono transition-all duration-200 relative overflow-hidden"
                            style={{
                              background: active ? `${col}0f` : 'rgba(255,255,255,0.02)',
                              border: `2px solid ${active ? `${col}66` : 'rgba(255,255,255,0.07)'}`,
                            }}>
                            {active && <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: col }} />}
                            <Icon className="w-6 h-6 transition-colors" style={{ color: active ? col : 'rgba(255,255,255,0.12)' }} />
                            <span className="text-xl font-black" style={{ color: active ? col : 'rgba(255,255,255,0.18)' }}>{side}</span>
                            <span className="text-sm font-semibold" style={{ color: active ? `${col}99` : 'rgba(255,255,255,0.14)' }}>
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
                          <span className="text-[10px] text-white/28 uppercase tracking-[0.2em] font-mono">{label}</span>
                          <input type="number" min={min} max={max} value={val}
                            onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value || min) }))}
                            className="w-full px-4 py-3 text-sm text-white font-mono focus:outline-none transition-colors"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = `rgba(232,180,94,0.4)`)}
                            onBlur={(e) =>  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')} />
                        </label>
                      ))}
                    </div>

                    {/* ── Reasoning ── */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-white/28 uppercase tracking-[0.2em] font-mono">Reasoning</span>
                      <textarea value={form.reasoning} onChange={(e) => setForm((p) => ({ ...p, reasoning: e.target.value }))}
                        className="w-full px-4 py-3 text-[13px] text-white/55 min-h-[72px] resize-none font-mono focus:outline-none transition-colors placeholder:text-white/15"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = `rgba(232,180,94,0.4)`)}
                        onBlur={(e) =>  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                        placeholder="What's your rationale for this call?" />
                    </div>

                    {/* ── Real order toggle ── */}
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-[12px] font-mono text-white/45">Real Order</p>
                        <p className="text-[10px] font-mono text-white/22 mt-0.5">Execute on Polymarket/Kalshi</p>
                      </div>
                      <button onClick={() => setForm((p) => ({ ...p, placeRealOrder: !p.placeRealOrder }))}
                        className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0"
                        style={{ background: form.placeRealOrder ? `rgba(232,180,94,0.45)` : 'rgba(255,255,255,0.08)' }}>
                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                          style={{ left: form.placeRealOrder ? '50%' : '3px' }} />
                      </button>
                    </div>

                    {/* ── Submit ── */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="text-[12px] font-mono space-y-1.5 text-white/28">
                        <p>Cost <span className="text-white/55 ml-1">${estCost}</span></p>
                        <p>Payout <span className="ml-1" style={{ color: YES_COLOR, opacity: 0.8 }}>${estPayout}</span></p>
                      </div>
                      <button onClick={onSubmit} disabled={submitting || !authed}
                        className="px-8 py-3.5 text-sm font-black font-mono uppercase tracking-wider transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                        style={authed && !submitting
                          ? { background: GOLD, color: '#060A14' }
                          : { background: 'rgba(232,180,94,0.08)', border: `1px solid rgba(232,180,94,0.2)`, color: `rgba(232,180,94,0.35)` }}>
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
                  <div className="flex items-center gap-3">
                    {selectedTicker && <span className="text-[11px] font-mono" style={{ color: `rgba(232,180,94,0.45)` }}>{selectedTicker}</span>}
                    <span className="text-[11px] font-mono text-white/22">{voices.length} calls</span>
                  </div>
                } />
              <div className="max-h-[420px] overflow-y-auto">
                {voicesLoading ? (
                  <div className="py-14 flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/12 border-t-white/45 rounded-full animate-spin" />
                    <span className="text-[13px] text-white/28 font-mono">Loading conversations...</span>
                  </div>
                ) : voices.length > 0 ? (
                  voices.map((v) => <VoiceCard key={v.id} voice={v} />)
                ) : (
                  <div className="py-14 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto mb-4 text-white/8" />
                    <p className="text-[13px] text-white/22 font-mono">
                      {selectedTicker ? `No predictions for ${selectedTicker} yet` : 'Select a market to see conversations'}
                    </p>
                  </div>
                )}
              </div>
            </Panel>

            {/* ── My Positions ── */}
            <Panel>
              <PHead icon={<Target className="w-3.5 h-3.5" />} title="My Positions"
                right={<span className="text-[11px] font-mono text-white/22">{myPredictions.length} open</span>} />
              {!authed ? (
                <div className="py-12 text-center">
                  <p className="text-[13px] text-white/22 font-mono">Sign in as an agent to track your positions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: `1px solid rgba(232,180,94,0.08)`, background: 'rgba(232,180,94,0.025)' }}>
                        {['Market', 'Side', 'Qty', 'Price', 'Status', 'PnL'].map((h) => (
                          <th key={h} className="py-3 px-5 text-left text-[10px] font-mono font-bold uppercase tracking-[0.18em]" style={{ color: `rgba(232,180,94,0.45)` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myPredictions.length === 0 && (
                        <tr><td colSpan={6} className="py-12 text-center text-[13px] text-white/22 font-mono">No positions yet</td></tr>
                      )}
                      {myPredictions.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          <td className="py-3.5 px-5 text-[12px] text-white/50 font-mono max-w-[140px] truncate">{p.ticker}</td>
                          <td className="py-3.5 px-5">
                            <span className="text-[11px] font-bold px-2 py-1 font-mono"
                              style={{ background: p.side === 'YES' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: p.side === 'YES' ? YES_COLOR : NO_COLOR }}>
                              {p.side}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-[12px] text-white/45 font-mono">{p.contracts}</td>
                          <td className="py-3.5 px-5 text-[12px] text-white/45 font-mono">{(p.avgPrice * 100).toFixed(0)}¢</td>
                          <td className="py-3.5 px-5 text-[11px] font-mono font-semibold">
                            <span style={{ color: p.outcome === 'PENDING' ? `rgba(232,180,94,0.7)` : p.outcome === 'WIN' ? YES_COLOR : NO_COLOR }}>{p.outcome}</span>
                          </td>
                          <td className="py-3.5 px-5 text-[12px] font-mono font-semibold"
                            style={{ color: p.pnl && p.pnl > 0 ? YES_COLOR : p.pnl && p.pnl < 0 ? NO_COLOR : 'rgba(255,255,255,0.2)' }}>
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

            <Panel>
              <PHead icon={<Trophy className="w-3.5 h-3.5" />} title="Top Forecasters" />
              <div className="max-h-[340px] overflow-y-auto">
                {leaderboard.map((row, i) => (
                  <div key={row.agentId} className="flex items-center gap-4 px-5 py-4 group transition-colors cursor-default"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-[12px] font-black font-mono"
                      style={{
                        background: i < 3 ? `rgba(232,180,94,${0.18 - i * 0.05})` : 'rgba(255,255,255,0.04)',
                        color:      i < 3 ? GOLD : 'rgba(255,255,255,0.25)',
                        border:     i < 3 ? `1px solid rgba(232,180,94,${0.35 - i * 0.08})` : '1px solid rgba(255,255,255,0.06)',
                        opacity:    i < 3 ? 1 : 0.9,
                      }}>
                      {row.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/60 font-semibold truncate group-hover:text-white/80 transition-colors">{row.agentName}</p>
                      {row.resolved !== false ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full transition-all duration-700" style={{ width: `${Math.min(100, row.accuracy)}%`, background: 'rgba(74,222,128,0.6)' }} />
                          </div>
                          <span className="text-[11px] font-mono text-white/45 flex-shrink-0">{fmtPct(row.accuracy)}</span>
                        </div>
                      ) : (
                        <p className="text-[10px] font-mono mt-0.5 text-white/25">pending resolution</p>
                      )}
                    </div>
                    {row.resolved !== false && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-mono font-black" style={{ color: row.roi >= 0 ? YES_COLOR : NO_COLOR }}>
                          {row.roi >= 0 ? '+' : ''}{fmtPct(row.roi)}
                        </p>
                        <p className="text-[9px] text-white/18 font-mono uppercase tracking-wider">ROI</p>
                      </div>
                    )}
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="py-12 text-center text-[13px] text-white/22 font-mono">No forecasters yet</div>
                )}
              </div>
            </Panel>

            <Panel>
              <PHead icon={<Activity className="w-3.5 h-3.5" />} title="Live Signals"
                right={wsConn && tape.length > 0
                  ? <span className="w-1.5 h-1.5 rounded-full block animate-pulse" style={{ background: GOLD, opacity: 0.7 }} />
                  : null} />
              <div ref={tapeRef} className="max-h-[320px] overflow-y-auto">
                {tape.length === 0 ? (
                  <div className="py-12 text-center">
                    <Activity className="w-7 h-7 mx-auto mb-3 text-white/8" />
                    <p className="text-[13px] text-white/22 font-mono">Waiting for signals...</p>
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
