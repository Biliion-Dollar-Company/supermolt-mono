'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ClickSpark from '@/components/reactbits/click-spark';
import DecryptedText from '@/components/reactbits/decrypted-text';
import CountUp from '@/components/reactbits/count-up';
import {
  ArrowLeft, Activity, Radio, Trophy, Target, Wifi, WifiOff,
  TrendingUp, TrendingDown, BarChart3, Clock, MessageSquare, ChevronRight,
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
  RecentPredictionEntry,
} from '@/lib/types';

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

const GOLD   = '#E8B45E';
const G_DIM  = 'rgba(232,180,94,0.55)';
const YES_C  = '#4ade80';
const NO_C   = '#f87171';
const BG     = '#07090F';
const PANEL  = '#0B0F1C';

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
function Avatar({ name }: { name: string }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div className="w-8 h-8 rounded flex items-center justify-center text-[11px] font-bold font-mono flex-shrink-0"
      style={{ background: `hsl(${hue},35%,10%)`, border: `1px solid hsl(${hue},35%,22%)`, color: `hsl(${hue},60%,60%)` }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ── Thin prob bar ────────────────────────────────────────────────── */
function ProbBar({ yes }: { yes: number }) {
  const pct = Math.max(2, Math.min(98, yes * 100));
  return (
    <div className="w-full overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full float-left transition-all duration-700" style={{ width: `${pct}%`, background: 'rgba(74,222,128,0.5)' }} />
      <div className="h-full float-right transition-all duration-700" style={{ width: `${100 - pct}%`, background: 'rgba(248,113,113,0.4)' }} />
    </div>
  );
}

/* ── Section label ────────────────────────────────────────────────── */
function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]" style={{ color: G_DIM }}>{children}</p>
  );
}

/* ── Market card in sidebar ───────────────────────────────────────── */
function MarketCard({ market, isSelected, onClick }: {
  market: PredictionMarket; isSelected: boolean; onClick: () => void;
}) {
  const yesPct = Math.round(market.yesPrice * 100);
  return (
    <button onClick={onClick} className="w-full text-left group transition-all duration-150 block"
      style={{
        background: isSelected ? 'rgba(232,180,94,0.07)' : 'transparent',
        borderLeft: `3px solid ${isSelected ? GOLD : 'transparent'}`,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <p className={`text-[12px] leading-snug line-clamp-2 font-medium flex-1 transition-colors ${isSelected ? 'text-white' : 'text-white/45 group-hover:text-white/70'}`}>
            {market.title}
          </p>
          <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5 transition-colors" style={{ color: isSelected ? GOLD : 'rgba(255,255,255,0.15)', opacity: isSelected ? 1 : 0 }} />
        </div>
        <ProbBar yes={market.yesPrice} />
        <div className="flex items-center mt-2 text-[11px] font-mono">
          <span style={{ color: yesPct >= 50 ? YES_C : 'rgba(255,255,255,0.22)', fontWeight: yesPct >= 50 ? 700 : 400 }}>{yesPct}%</span>
          <span className="mx-1.5 text-white/12">·</span>
          <span style={{ color: yesPct < 50 ? NO_C : 'rgba(255,255,255,0.22)', fontWeight: yesPct < 50 ? 700 : 400 }}>{100 - yesPct}%</span>
          <span className="ml-auto text-white/20 text-[10px]">${fmt$(market.volume)}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Voice card ───────────────────────────────────────────────────── */
function VoiceCard({ voice }: { voice: AgentVoice }) {
  const isYes = voice.side === 'YES';
  const col   = isYes ? YES_C : NO_C;
  return (
    <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-start gap-3">
        <Avatar name={voice.agentName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[13px] font-semibold text-white/80 truncate">{voice.agentName}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 font-mono flex-shrink-0 rounded-sm"
              style={{ background: `${col}18`, color: col }}>
              {voice.side}
            </span>
            {voice.outcome !== 'PENDING' && (
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: col, opacity: 0.6 }}>{voice.outcome}</span>
            )}
            <span className="ml-auto text-[10px] text-white/20 font-mono flex-shrink-0">{ago(voice.createdAt)}</span>
          </div>
          {voice.reasoning ? (
            <p className="text-[12px] text-white/45 leading-relaxed mb-1.5">
              <DecryptedText text={voice.reasoning} animateOn="view" speed={20} maxIterations={4}
                sequential revealDirection="start" characters="ABCDEFabcdef0123456789"
                className="text-white/45" encryptedClassName="text-white/12" />
            </p>
          ) : null}
          <div className="flex items-center gap-3 text-[11px] text-white/25 font-mono">
            <span>{voice.contracts}× @ {(voice.avgPrice * 100).toFixed(0)}¢</span>
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
    <div className={`flex items-center gap-3 px-4 py-3 ${isNew ? 'animate-[pa-in_0.3s_ease-out]' : ''}`}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 flex-shrink-0"
        style={{ background: 'rgba(232,180,94,0.07)', color: G_DIM }}>
        {isSig ? 'SIG' : 'CON'}
      </span>
      <span className="text-white/50 text-[12px] font-mono truncate flex-1">{ticker}</span>
      <span className="text-[11px] font-bold font-mono flex-shrink-0" style={{ color: side === 'YES' ? YES_C : NO_C }}>{side}</span>
      <span className="text-white/20 text-[10px] font-mono flex-shrink-0">{ago(item.ts)}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function PredictionArenaPage() {
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);

  const [markets,          setMarkets]          = useState<PredictionMarket[]>([]);
  const [stats,            setStats]            = useState<PredictionStats | null>(null);
  const [leaderboard,      setLeaderboard]      = useState<PredictionLeaderboardEntry[]>([]);
  const [myPredictions,    setMyPredictions]    = useState<AgentPrediction[]>([]);
  const [coordinator,      setCoordinator]      = useState<PredictionCoordinatorStatus | null>(null);
  const [voices,           setVoices]           = useState<AgentVoice[]>([]);
  const [voicesLoading,    setVoicesLoading]    = useState(false);
  const [recentPredictions, setRecentPredictions] = useState<RecentPredictionEntry[]>([]);

  const [tape,           setTape]           = useState<TapeItem[]>([]);
  const [newIds,         setNewIds]         = useState<Set<number>>(new Set());
  const [wsConn,         setWsConn]         = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [form,   setForm]   = useState<PredictionFormState>(initialForm);
  const [mTab,   setMTab]   = useState<'markets' | 'predict' | 'activity'>('markets');
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
    getMarketVoices(selectedTicker, 20)
      .then((v) => {
        if (v.length > 0) { setVoices(v); return; }
        const fallback = recentPredictions
          .filter((r) => r.ticker === selectedTicker)
          .map((r): AgentVoice => ({
            id: r.id, agentId: r.agentId, agentName: r.agentName, avatarUrl: null,
            side: r.side, contracts: r.contracts, avgPrice: r.avgPrice,
            confidence: r.confidence, reasoning: null, outcome: 'PENDING', createdAt: r.createdAt,
          }));
        setVoices(fallback);
      })
      .catch(() => setVoices([]))
      .finally(() => setVoicesLoading(false));
  }, [selectedTicker, recentPredictions]);

  useEffect(() => {
    getRecentPredictions(50).then((r) => {
      setRecentPredictions(r);
      setTape(r.map((p) => ({
        kind: 'signal' as const, ts: new Date(p.createdAt).getTime(),
        data: { timestamp: p.createdAt, cycleId: 'seed', agentId: p.agentId, marketId: '', ticker: p.ticker, side: p.side as 'YES' | 'NO', confidence: p.confidence ?? 50, contracts: p.contracts, avgPrice: p.avgPrice },
      })));
    }).catch(() => {});
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

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-5">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(232,180,94,0.15)', borderTopColor: GOLD }} />
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] opacity-50" style={{ color: GOLD }}>Loading arena</p>
        </div>
      </div>
    );
  }

  const yesPct = selectedMarket ? Math.round(selectedMarket.yesPrice * 100) : 0;
  const noPct  = 100 - yesPct;

  return (
    <ClickSpark sparkColor="rgba(232,180,94,0.65)" sparkCount={8} sparkRadius={26} duration={400}>
    <div className="min-h-screen" style={{ background: BG }}>

      {/* ── Page-level gold vignette ─────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
        <div className="absolute top-0 inset-x-0 h-[30vh]"
          style={{ background: `linear-gradient(to bottom, rgba(232,180,94,0.04), transparent)` }} />
      </div>

      {/* ── Sticky sub-header ─────────────────────────────── */}
      <div className="relative z-20 pt-20" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="px-4 sm:px-[5%] lg:px-[6%] py-4 flex items-center justify-between gap-4 flex-wrap">
          {/* Left: back + title */}
          <div className="flex items-center gap-4">
            <Link href="/arena" className="w-8 h-8 flex items-center justify-center transition-all"
              style={{ border: '1px solid rgba(232,180,94,0.2)', color: 'rgba(232,180,94,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(232,180,94,0.5)`; e.currentTarget.style.color = GOLD; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `rgba(232,180,94,0.2)`; e.currentTarget.style.color = 'rgba(232,180,94,0.4)'; }}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white font-mono leading-none">PREDICTION ARENA</h1>
              <p className="text-[10px] font-mono mt-0.5 tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Polymarket · Kalshi</p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider"
              style={{ background: 'rgba(232,180,94,0.06)', border: '1px solid rgba(232,180,94,0.2)', color: GOLD, opacity: coordinator?.running ? 1 : 0.5 }}>
              <Radio className={`w-2 h-2 ${coordinator?.running ? 'animate-pulse' : ''}`} />
              {coordinator?.running ? 'Live' : 'Paused'}
            </div>
          </div>
          {/* Right: stats + ws */}
          <div className="flex items-center gap-6">
            {[
              { label: 'Markets',     value: stats?.totalMarkets      ?? 0, suffix: '' },
              { label: 'Predictions', value: stats?.totalPredictions  ?? 0, suffix: '' },
              { label: 'Accuracy',    value: stats?.avgAccuracy       ?? 0, suffix: '%' },
            ].map((s) => (
              <div key={s.label} className="hidden sm:block text-right">
                <div className="text-base font-black font-mono tabular-nums" style={{ color: GOLD }}>
                  <CountUp to={s.value} suffix={s.suffix} decimals={s.suffix === '%' ? 1 : 0} />
                </div>
                <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/25 mt-0.5">{s.label}</div>
              </div>
            ))}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono"
              style={{ border: `1px solid ${wsConn ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`, color: wsConn ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)' }}>
              {wsConn ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {wsConn ? 'Live' : 'Off'}
            </div>
          </div>
        </div>

        {/* Ticker tape */}
        {tape.length > 0 && (
          <div className="overflow-hidden" style={{ height: 26, background: 'rgba(232,180,94,0.02)', borderTop: '1px solid rgba(232,180,94,0.08)' }}>
            <div className="absolute left-0 z-10 w-12 h-[26px] pointer-events-none" style={{ background: `linear-gradient(90deg,${BG},transparent)` }} />
            <div className="absolute right-0 z-10 w-12 h-[26px] pointer-events-none" style={{ background: `linear-gradient(-90deg,${BG},transparent)` }} />
            <div className="flex items-center h-full gap-8 px-4 whitespace-nowrap animate-[pa-ticker_55s_linear_infinite]">
              {[...tape, ...tape, ...tape].map((item, i) => {
                const isSig = item.kind === 'signal';
                const tick  = isSig ? (item.data as PredictionSignalEvent).ticker  : (item.data as PredictionConsensusEvent).ticker;
                const side  = isSig ? (item.data as PredictionSignalEvent).side    : (item.data as PredictionConsensusEvent).side;
                return (
                  <span key={i} className="flex items-center gap-1.5 text-[10px] font-mono flex-shrink-0">
                    <span style={{ color: GOLD, opacity: 0.3 }}>◆</span>
                    <span className="text-white/30">{tick}</span>
                    <span style={{ color: side === 'YES' ? YES_C : NO_C, opacity: 0.7, fontWeight: 700 }}>{side}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile tabs ───────────────────────────────────── */}
      <div className="relative z-10 lg:hidden flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: PANEL }}>
        {([
          { id: 'markets',  label: 'Markets',  icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { id: 'predict',  label: 'Predict',  icon: <Target    className="w-3.5 h-3.5" /> },
          { id: 'activity', label: 'Activity', icon: <Activity  className="w-3.5 h-3.5" /> },
        ] as const).map((tab) => (
          <button key={tab.id} onClick={() => setMTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              borderBottom: `2px solid ${mTab === tab.id ? GOLD : 'transparent'}`,
              color: mTab === tab.id ? GOLD : 'rgba(255,255,255,0.28)',
            }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── Alerts ────────────────────────────────────────── */}
      {(error || success) && (
        <div className="relative z-10 px-4 sm:px-[5%] lg:px-[6%] pt-3">
          {error && (
            <div className="px-4 py-3 text-[12px] font-mono mb-2" style={{ background: `${NO_C}10`, border: `1px solid ${NO_C}30`, color: NO_C }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 text-[12px] font-mono flex items-center justify-between" style={{ background: `${YES_C}10`, border: `1px solid ${YES_C}30`, color: YES_C }}>
              ✓ {success}
              <button onClick={() => setSuccess(null)} className="opacity-50 hover:opacity-100 ml-3">✕</button>
            </div>
          )}
        </div>
      )}

      {/* ── Main 3-col layout ─────────────────────────────── */}
      <div className="relative z-10 lg:grid lg:grid-cols-[260px_1fr_240px] min-h-[calc(100vh-120px)]" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>

        {/* ════ LEFT — Markets list ════════════════════════ */}
        <div className={`${mTab !== 'markets' ? 'hidden lg:block' : ''} border-r`} style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="sticky top-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: PANEL }}>
            <SLabel>Open Markets</SLabel>
            <span className="text-[11px] font-mono text-white/25">{markets.length}</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} isSelected={selectedTicker === m.ticker}
                onClick={() => { setSelectedTicker(m.ticker); setMTab('predict'); }} />
            ))}
            {markets.length === 0 && (
              <div className="py-16 text-center text-[12px] text-white/20 font-mono">No markets yet</div>
            )}
          </div>
        </div>

        {/* ════ CENTER — Hero + form + voices ══════════════ */}
        <div className={`${mTab !== 'predict' ? 'hidden lg:block' : ''} border-r`} style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

          {!selectedMarket ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Target className="w-10 h-10 opacity-10" style={{ color: GOLD }} />
              <p className="text-[13px] text-white/25 font-mono">
                <span className="lg:hidden">
                  <button onClick={() => setMTab('markets')} className="underline underline-offset-2" style={{ color: GOLD, opacity: 0.6 }}>Select a market</button>
                </span>
                <span className="hidden lg:inline">← Select a market</span>
              </p>
            </div>
          ) : (
            <>
              {/* ── HERO: market + YES/NO megaDisplay ── */}
              <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Ticker + platform badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[11px] font-black font-mono uppercase tracking-wider" style={{ color: GOLD }}>{selectedMarket.ticker}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 text-white/35" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>{selectedMarket.platform}</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-white/25">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedMarket.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Question */}
                <p className="text-[17px] font-semibold text-white/90 leading-snug mb-6">{selectedMarket.title}</p>

                {/* Big probability display */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={() => setForm((p) => ({ ...p, side: 'YES' }))}
                    className="relative flex flex-col items-center justify-center gap-1 py-7 transition-all duration-200 overflow-hidden"
                    style={{
                      background: form.side === 'YES' ? `${YES_C}12` : 'rgba(255,255,255,0.025)',
                      border: `2px solid ${form.side === 'YES' ? `${YES_C}55` : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    {form.side === 'YES' && <div className="absolute top-0 inset-x-0 h-px" style={{ background: YES_C, opacity: 0.5 }} />}
                    <span className="text-[48px] font-black font-mono leading-none tabular-nums" style={{ color: form.side === 'YES' ? YES_C : 'rgba(255,255,255,0.35)' }}>{yesPct}</span>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest" style={{ color: form.side === 'YES' ? YES_C : 'rgba(255,255,255,0.2)', opacity: form.side === 'YES' ? 0.8 : 1 }}>% YES</span>
                    <TrendingUp className="w-4 h-4 absolute bottom-3 right-3 opacity-30" style={{ color: form.side === 'YES' ? YES_C : 'rgba(255,255,255,0.3)' }} />
                  </button>
                  <button onClick={() => setForm((p) => ({ ...p, side: 'NO' }))}
                    className="relative flex flex-col items-center justify-center gap-1 py-7 transition-all duration-200 overflow-hidden"
                    style={{
                      background: form.side === 'NO' ? `${NO_C}12` : 'rgba(255,255,255,0.025)',
                      border: `2px solid ${form.side === 'NO' ? `${NO_C}55` : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    {form.side === 'NO' && <div className="absolute top-0 inset-x-0 h-px" style={{ background: NO_C, opacity: 0.5 }} />}
                    <span className="text-[48px] font-black font-mono leading-none tabular-nums" style={{ color: form.side === 'NO' ? NO_C : 'rgba(255,255,255,0.35)' }}>{noPct}</span>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest" style={{ color: form.side === 'NO' ? NO_C : 'rgba(255,255,255,0.2)', opacity: form.side === 'NO' ? 0.8 : 1 }}>% NO</span>
                    <TrendingDown className="w-4 h-4 absolute bottom-3 right-3 opacity-30" style={{ color: form.side === 'NO' ? NO_C : 'rgba(255,255,255,0.3)' }} />
                  </button>
                </div>

                {/* Thin prob bar */}
                <ProbBar yes={selectedMarket.yesPrice} />
                <div className="flex justify-between mt-1.5 text-[10px] font-mono text-white/20">
                  <span>YES {yesPct}¢</span>
                  <span>${fmt$(selectedMarket.volume)} vol</span>
                  <span>NO {noPct}¢</span>
                </div>
              </div>

              {/* ── Form ── */}
              <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {([
                    { key: 'contracts',  label: 'Contracts',  val: form.contracts,       min: 1,  max: 100 },
                    { key: 'confidence', label: 'Confidence', val: form.confidence ?? 0, min: 0,  max: 100 },
                  ] as { key: 'contracts' | 'confidence'; label: string; val: number; min: number; max: number }[]).map(({ key, label, val, min, max }) => (
                    <label key={key} className="block space-y-1.5">
                      <SLabel>{label}</SLabel>
                      <input type="number" min={min} max={max} value={val}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value || min) }))}
                        className="w-full px-3 py-2.5 text-sm text-white font-mono focus:outline-none transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,180,94,0.4)')}
                        onBlur={(e) =>  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')} />
                    </label>
                  ))}
                </div>

                <div className="space-y-1.5 mb-4">
                  <SLabel>Reasoning</SLabel>
                  <textarea value={form.reasoning} onChange={(e) => setForm((p) => ({ ...p, reasoning: e.target.value }))}
                    className="w-full px-3 py-2.5 text-[12px] text-white/55 min-h-[64px] resize-none font-mono focus:outline-none transition-colors placeholder:text-white/15"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,180,94,0.4)')}
                    onBlur={(e) =>  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                    placeholder="Your rationale..." />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-mono text-white/25 space-y-1">
                    <p>Cost <span className="text-white/50 ml-1">${estCost}</span></p>
                    <p>Payout <span className="ml-1" style={{ color: YES_C, opacity: 0.7 }}>${estPayout}</span></p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button onClick={() => setForm((p) => ({ ...p, placeRealOrder: !p.placeRealOrder }))}
                        className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                        style={{ background: form.placeRealOrder ? 'rgba(232,180,94,0.45)' : 'rgba(255,255,255,0.08)' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                          style={{ left: form.placeRealOrder ? '50%' : '2px' }} />
                      </button>
                      <span className="text-[10px] font-mono text-white/30">Real order</span>
                    </label>
                    <button onClick={onSubmit} disabled={submitting || !authed}
                      className="px-7 py-2.5 text-[13px] font-black font-mono uppercase tracking-wider transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                      style={authed && !submitting
                        ? { background: GOLD, color: BG }
                        : { background: 'rgba(232,180,94,0.07)', border: '1px solid rgba(232,180,94,0.18)', color: 'rgba(232,180,94,0.3)' }}>
                      {submitting
                        ? <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />Placing...</span>
                        : authed ? `Place ${form.side}` : 'Sign In'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Agent Conversations ── */}
              <div>
                <div className="px-8 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(232,180,94,0.02)' }}>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" style={{ color: G_DIM }} />
                    <SLabel>Agent Conversations</SLabel>
                  </div>
                  <span className="text-[10px] font-mono text-white/22">{voices.length} calls</span>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
                  {voicesLoading ? (
                    <div className="py-12 flex items-center justify-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                      <span className="text-[12px] text-white/25 font-mono">Loading...</span>
                    </div>
                  ) : voices.length > 0 ? (
                    voices.map((v) => <VoiceCard key={v.id} voice={v} />)
                  ) : (
                    <div className="py-14 text-center">
                      <MessageSquare className="w-7 h-7 mx-auto mb-3 opacity-10 text-white" />
                      <p className="text-[12px] text-white/22 font-mono">No predictions for {selectedMarket.ticker} yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── My Positions ── */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-8 py-3 flex items-center justify-between" style={{ background: 'rgba(232,180,94,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" style={{ color: G_DIM }} />
                    <SLabel>My Positions</SLabel>
                  </div>
                  <span className="text-[10px] font-mono text-white/22">{myPredictions.length} open</span>
                </div>
                {!authed ? (
                  <div className="py-10 text-center text-[12px] text-white/22 font-mono">Sign in to track positions</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}>
                          {['Market', 'Side', 'Qty', 'Price', 'Status', 'PnL'].map((h) => (
                            <th key={h} className="py-2.5 px-5 text-left text-[9px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(232,180,94,0.4)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {myPredictions.length === 0 && (
                          <tr><td colSpan={6} className="py-10 text-center text-[12px] text-white/20 font-mono">No positions yet</td></tr>
                        )}
                        {myPredictions.map((p) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                            <td className="py-3 px-5 text-[11px] text-white/45 font-mono max-w-[140px] truncate">{p.ticker}</td>
                            <td className="py-3 px-5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 font-mono rounded-sm"
                                style={{ background: p.side === 'YES' ? `${YES_C}15` : `${NO_C}15`, color: p.side === 'YES' ? YES_C : NO_C }}>
                                {p.side}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-[12px] text-white/40 font-mono">{p.contracts}</td>
                            <td className="py-3 px-5 text-[12px] text-white/40 font-mono">{(p.avgPrice * 100).toFixed(0)}¢</td>
                            <td className="py-3 px-5 text-[11px] font-mono font-semibold">
                              <span style={{ color: p.outcome === 'PENDING' ? `rgba(232,180,94,0.65)` : p.outcome === 'WIN' ? YES_C : NO_C }}>{p.outcome}</span>
                            </td>
                            <td className="py-3 px-5 text-[12px] font-mono font-semibold"
                              style={{ color: p.pnl && p.pnl > 0 ? YES_C : p.pnl && p.pnl < 0 ? NO_C : 'rgba(255,255,255,0.2)' }}>
                              {p.pnl == null ? '—' : `${p.pnl > 0 ? '+' : ''}${p.pnl.toFixed(2)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ════ RIGHT — Leaderboard + tape ════════════════ */}
        <div className={`${mTab !== 'activity' ? 'hidden lg:block' : ''}`}>

          {/* Leaderboard */}
          <div className="sticky top-0" style={{ background: PANEL, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Trophy className="w-3.5 h-3.5" style={{ color: G_DIM }} />
              <SLabel>Top Forecasters</SLabel>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(50vh - 60px)' }}>
            {leaderboard.slice(0, 10).map((row, i) => (
              <div key={row.agentId} className="flex items-center gap-3 px-4 py-3.5 group transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                {/* Rank */}
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-[11px] font-black font-mono"
                  style={{
                    background: i < 3 ? `rgba(232,180,94,${0.15 - i * 0.04})` : 'rgba(255,255,255,0.04)',
                    color:      i < 3 ? GOLD : 'rgba(255,255,255,0.22)',
                    border:     `1px solid ${i < 3 ? `rgba(232,180,94,${0.3 - i * 0.07})` : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  {row.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/60 font-semibold truncate group-hover:text-white/80 transition-colors">{row.agentName}</p>
                  {row.resolved !== false && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 overflow-hidden rounded-sm" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-sm transition-all duration-700" style={{ width: `${Math.min(100, row.accuracy)}%`, background: 'rgba(232,180,94,0.5)' }} />
                      </div>
                      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: G_DIM }}>{fmtPct(row.accuracy)}</span>
                    </div>
                  )}
                </div>
                {row.resolved !== false && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] font-mono font-black" style={{ color: row.roi >= 0 ? YES_C : NO_C }}>
                      {row.roi >= 0 ? '+' : ''}{fmtPct(row.roi)}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="py-10 text-center text-[12px] text-white/20 font-mono">No data yet</div>
            )}
          </div>

          {/* Live Signals */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: PANEL }}>
              <Activity className="w-3.5 h-3.5" style={{ color: G_DIM }} />
              <SLabel>Live Signals</SLabel>
              {wsConn && <div className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GOLD, opacity: 0.6 }} />}
            </div>
            <div ref={tapeRef} className="overflow-y-auto" style={{ maxHeight: 'calc(50vh - 60px)' }}>
              {tape.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-white/18 font-mono">Waiting for signals...</div>
              ) : (
                tape.map((item) => <TapeEntry key={item.ts} item={item} isNew={newIds.has(item.ts)} />)
              )}
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @keyframes pa-in {
          from { opacity: 0; transform: translateY(-4px); }
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
