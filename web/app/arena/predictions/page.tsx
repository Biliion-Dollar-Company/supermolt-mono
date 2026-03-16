'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), { ssr: false });
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
import { useIsMobile } from '@/hooks/useIsMobile';
import { connectWebSocket, getWebSocketManager } from '@/lib/websocket';
import type {
  AgentPrediction, AgentVoice, PredictionConsensusEvent, PredictionCoordinatorStatus,
  PredictionLeaderboardEntry, PredictionMarket, PredictionSignalEvent, PredictionStats,
  RecentPredictionEntry,
} from '@/lib/types';

/* ── Constants ────────────────────────────────────────────────────── */
const GOLD  = '#E8B45E';
const YES_C = '#4ade80';
const NO_C  = '#f87171';
const BG    = '#07090F';
const SURF  = '#0C1020';

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
function Avatar({ name }: { name: string }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div
      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-bold font-mono"
      style={{
        background: `hsl(${hue},35%,8%)`,
        border: `1px solid hsl(${hue},35%,18%)`,
        color: `hsl(${hue},60%,58%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ── Market row in sidebar ────────────────────────────────────────── */
function MarketRow({ market, selected, onClick }: { market: PredictionMarket; selected: boolean; onClick: () => void }) {
  const pct = Math.round(market.yesPrice * 100);
  const isHigh = pct >= 60;
  const isLow  = pct <= 40;
  const probColor = isHigh ? YES_C : isLow ? NO_C : GOLD;
  return (
    <button
      onClick={onClick}
      className="w-full text-left group transition-all duration-150"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft: `3px solid ${selected ? GOLD : 'transparent'}`,
        background: selected ? 'rgba(232,180,94,0.07)' : 'transparent',
        backdropFilter: selected ? 'blur(6px)' : undefined,
      }}
    >
      <div className="px-4 py-3.5">
        {/* Ticker + prob inline */}
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
          >
            {market.platform}
          </span>
          <span
            className="text-[12px] font-black font-mono tabular-nums"
            style={{ color: selected ? probColor : 'rgba(255,255,255,0.25)' }}
          >
            {pct}%
          </span>
        </div>
        {/* Title */}
        <p
          className="text-[11px] leading-snug line-clamp-2 mb-2.5 transition-colors"
          style={{ color: selected ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)', fontWeight: selected ? 500 : 400 }}
        >
          {market.title}
        </p>
        {/* Split bar */}
        <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full float-left rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'rgba(74,222,128,0.45)' }}
          />
        </div>
        {/* Vol chip */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.18)' }}>
            <span style={{ color: 'rgba(74,222,128,0.5)' }}>{pct}%</span>
            <span className="mx-1 opacity-40">·</span>
            <span style={{ color: 'rgba(248,113,113,0.5)' }}>{100 - pct}%</span>
          </span>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            ${fmt$(market.volume)}
          </span>
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
    <div
      className="px-5 py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex gap-3">
        <Avatar name={voice.agentName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href={`/agents/${voice.agentId}`}
              className="text-[12px] font-semibold text-white/70 truncate hover:text-white transition-colors"
            >
              {voice.agentName}
            </Link>
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded font-mono tracking-widest flex-shrink-0"
              style={{ background: `${col}15`, color: col, border: `1px solid ${col}28` }}
            >
              {voice.side}
            </span>
            {voice.outcome !== 'PENDING' && (
              <span className="text-[9px] font-mono flex-shrink-0" style={{ color: col, opacity: 0.5 }}>
                {voice.outcome}
              </span>
            )}
            <span className="ml-auto text-[9px] text-white/18 font-mono flex-shrink-0 pl-2">
              {ago(voice.createdAt)}
            </span>
          </div>
          {voice.reasoning && (
            <p className="text-[12px] text-white/45 leading-relaxed mb-2">
              <DecryptedText
                text={voice.reasoning}
                animateOn="view"
                speed={22}
                maxIterations={4}
                sequential
                revealDirection="start"
                characters="ABCDEFabcdef0123456789"
                className="text-white/45"
                encryptedClassName="text-white/10"
              />
            </p>
          )}
          <div className="text-[10px] text-white/20 font-mono">
            {voice.contracts}× @ {(voice.avgPrice * 100).toFixed(0)}¢
            {voice.confidence != null && (
              <span className="ml-2 opacity-70">{voice.confidence}% conf</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Signal tape row ──────────────────────────────────────────────── */
function TapeRow({ item, isNew }: { item: TapeItem; isNew: boolean }) {
  const isSig  = item.kind === 'signal';
  const side   = isSig ? (item.data as PredictionSignalEvent).side   : (item.data as PredictionConsensusEvent).side;
  const ticker = isSig ? (item.data as PredictionSignalEvent).ticker : (item.data as PredictionConsensusEvent).ticker;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${isNew ? 'animate-[pa-in_0.3s_ease-out]' : ''}`}
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        borderLeft: `2px solid rgba(232,180,94,${isSig ? 0.35 : 0.15})`,
      }}
    >
      <span
        className="text-[9px] font-black font-mono tracking-wider flex-shrink-0 px-1.5 py-0.5 rounded"
        style={{
          background: isSig ? 'rgba(255,255,255,0.05)' : 'rgba(232,180,94,0.08)',
          color: isSig ? 'rgba(255,255,255,0.4)' : 'rgba(232,180,94,0.7)',
          border: `1px solid ${isSig ? 'rgba(255,255,255,0.08)' : 'rgba(232,180,94,0.2)'}`,
        }}
      >
        {isSig ? 'SIG' : 'CON'}
      </span>
      <span className="text-[11px] font-mono text-white/38 flex-1 truncate">{ticker}</span>
      <span className="text-[11px] font-bold font-mono flex-shrink-0" style={{ color: side === 'YES' ? YES_C : NO_C }}>
        {side}
      </span>
      <span className="text-[9px] font-mono text-white/16 flex-shrink-0">{ago(item.ts)}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function PredictionArenaPage() {
  const [loading,           setLoading]           = useState(true);
  const [submitting,        setSubmitting]        = useState(false);
  const [error,             setError]             = useState<string | null>(null);
  const [success,           setSuccess]           = useState<string | null>(null);
  const [markets,           setMarkets]           = useState<PredictionMarket[]>([]);
  const [stats,             setStats]             = useState<PredictionStats | null>(null);
  const [leaderboard,       setLeaderboard]       = useState<PredictionLeaderboardEntry[]>([]);
  const [myPredictions,     setMyPredictions]     = useState<AgentPrediction[]>([]);
  const [coordinator,       setCoordinator]       = useState<PredictionCoordinatorStatus | null>(null);
  const [voices,            setVoices]            = useState<AgentVoice[]>([]);
  const [voicesLoading,     setVoicesLoading]     = useState(false);
  const [recentPredictions, setRecentPredictions] = useState<RecentPredictionEntry[]>([]);
  const [tape,              setTape]              = useState<TapeItem[]>([]);
  const [newIds,            setNewIds]            = useState<Set<number>>(new Set());
  const [wsConn,            setWsConn]            = useState(false);
  const [selectedTicker,    setSelectedTicker]    = useState<string | null>(null);
  const [form,              setForm]              = useState<PredictionFormState>(initialForm);
  const [mTab,              setMTab]              = useState<'markets' | 'predict' | 'activity'>('markets');
  const tapeRef = useRef<HTMLDivElement>(null);
  const authed  = isAuthenticated();
  const isMobile = useIsMobile();

  const market = useMemo(() => markets.find((m) => m.ticker === selectedTicker) ?? null, [markets, selectedTicker]);

  /* Data loading */
  const refresh = useCallback(async () => {
    try {
      const [mkt, st, lb, coord, my] = await Promise.all([
        getPredictionMarkets(50, 'open'), getPredictionStats(), getPredictionLeaderboard(15),
        getPredictionCoordinatorStatus(), authed ? getMyPredictions(20) : Promise.resolve([]),
      ]);
      setMarkets(mkt); setStats(st); setLeaderboard(lb); setCoordinator(coord); setMyPredictions(my);
      if (!selectedTicker && mkt.length > 0) setSelectedTicker(mkt[0].ticker);
      setError(null);
    } catch { setError('Failed to load data'); }
    finally  { setLoading(false); }
  }, [authed, selectedTicker]);

  useEffect(() => { refresh(); const i = setInterval(refresh, 20_000); return () => clearInterval(i); }, [refresh]);

  /* Voices: try API, fall back to recentPredictions */
  useEffect(() => {
    if (!selectedTicker) return;
    setVoicesLoading(true);
    getMarketVoices(selectedTicker, 20)
      .then((v) => {
        if (v.length > 0) { setVoices(v); return; }
        setVoices(recentPredictions
          .filter((r) => r.ticker === selectedTicker)
          .map((r): AgentVoice => ({
            id: r.id, agentId: r.agentId, agentName: r.agentName, avatarUrl: null,
            side: r.side, contracts: r.contracts, avgPrice: r.avgPrice,
            confidence: r.confidence, reasoning: null, outcome: 'PENDING', createdAt: r.createdAt,
          })));
      })
      .catch(() => setVoices([]))
      .finally(() => setVoicesLoading(false));
  }, [selectedTicker, recentPredictions]);

  /* Seed tape + recentPredictions */
  useEffect(() => {
    getRecentPredictions(50).then((r) => {
      setRecentPredictions(r);
      setTape(r.map((p) => ({
        kind: 'signal' as const, ts: new Date(p.createdAt).getTime(),
        data: { timestamp: p.createdAt, cycleId: 'seed', agentId: p.agentId, marketId: '', ticker: p.ticker, side: p.side as 'YES' | 'NO', confidence: p.confidence ?? 50, contracts: p.contracts, avgPrice: p.avgPrice },
      })));
    }).catch(() => {});
  }, []);

  /* WebSocket */
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    (async () => {
      try {
        await connectWebSocket();
        const ws = getWebSocketManager();
        setWsConn(ws.isConnected());
        const ci = setInterval(() => setWsConn(ws.isConnected()), 3_000);
        unsubs.push(() => clearInterval(ci));
        unsubs.push(ws.onPredictionSignal((ev) => {
          const d = ev.data as PredictionSignalEvent; const ts = Date.now();
          setTape((p) => [{ kind: 'signal' as const, ts, data: d }, ...p].slice(0, 40));
          setNewIds((p) => { const n = new Set(p).add(ts); setTimeout(() => setNewIds((q) => { const r = new Set(q); r.delete(ts); return r; }), 600); return n; });
          setMarkets((p) => p.map((m) => m.ticker !== d.ticker ? m : { ...m, yesPrice: Math.max(0.01, Math.min(0.99, m.yesPrice + (d.side === 'YES' ? 0.005 : -0.005))) }));
        }));
        unsubs.push(ws.onPredictionConsensus((ev) => {
          const d = ev.data as PredictionConsensusEvent; const ts = Date.now();
          setTape((p) => [{ kind: 'consensus' as const, ts, data: d }, ...p].slice(0, 40));
          setNewIds((p) => { const n = new Set(p).add(ts); setTimeout(() => setNewIds((q) => { const r = new Set(q); r.delete(ts); return r; }), 600); return n; });
          setStats((p) => p ? { ...p, totalPredictions: p.totalPredictions + d.participants } : p);
        }));
      } catch { setWsConn(false); }
    })();
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => { if (tapeRef.current) tapeRef.current.scrollTop = 0; }, [tape]);

  /* Submit */
  const onSubmit = async () => {
    if (!market) return;
    if (!authed) { setError('Sign in as an agent to place predictions'); return; }
    setSubmitting(true); setError(null); setSuccess(null);
    try {
      const res = await placePrediction(market.ticker, {
        side: form.side, contracts: form.contracts, confidence: form.confidence,
        reasoning: form.reasoning || undefined, placeRealOrder: form.placeRealOrder,
      });
      if (!res.success) { setError(res.error || 'Prediction failed'); return; }
      setSuccess(`${form.side} placed on ${market.ticker}`);
      setForm((p) => ({ ...p, reasoning: '' }));
      getMarketVoices(market.ticker, 20).then(setVoices).catch(() => {});
      await refresh();
    } catch { setError('Request failed'); }
    finally  { setSubmitting(false); }
  };

  const yesPct = market ? Math.round(market.yesPrice * 100) : 50;
  const noPct  = 100 - yesPct;
  const estCost   = market ? ((form.side === 'YES' ? market.yesPrice : market.noPrice) * form.contracts).toFixed(2) : '0.00';
  const estPayout = market ? form.contracts.toFixed(2) : '0.00';

  /* ── Loading screen ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        {!isMobile && (
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, opacity: 0.22 }}>
            <RisingLines color="#E8B45E" horizonColor="#E8B45E" haloColor="#F5D78E" riseSpeed={0.06} riseScale={8} riseIntensity={1.0} flowSpeed={0.12} flowDensity={3.5} flowIntensity={0.5} horizonIntensity={0.7} haloIntensity={5} horizonHeight={-0.9} circleScale={-0.5} scale={5.5} brightness={0.95} />
          </div>
        )}
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(232,180,94,0.12)', borderTopColor: GOLD }}
          />
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] opacity-35" style={{ color: GOLD }}>
            Loading arena
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Fixed background — always visible, never scrolls ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: BG }} />
      {!isMobile && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, opacity: 0.22 }}>
          <RisingLines color="#E8B45E" horizonColor="#E8B45E" haloColor="#F5D78E" riseSpeed={0.06} riseScale={8} riseIntensity={1.0} flowSpeed={0.12} flowDensity={3.5} flowIntensity={0.5} horizonIntensity={0.7} haloIntensity={5} horizonHeight={-0.9} circleScale={-0.5} scale={5.5} brightness={0.95} />
        </div>
      )}

    <ClickSpark sparkColor="rgba(232,180,94,0.55)" sparkCount={8} sparkRadius={22} duration={380}>
      <div
        className="flex flex-col"
        style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}
      >

        {/* ── Header ──────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 pt-16 sm:pt-[64px] z-30"
          style={{ background: 'rgba(7,9,15,0.82)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Top row */}
          <div className="flex items-center gap-4 px-8 sm:px-12 py-3 max-w-[1280px] mx-auto w-full">
            {/* Back */}
            <Link
              href="/arena"
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150"
              style={{ border: '1px solid rgba(232,180,94,0.16)', color: 'rgba(232,180,94,0.38)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.45)'; e.currentTarget.style.color = GOLD; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.16)'; e.currentTarget.style.color = 'rgba(232,180,94,0.38)'; }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>

            {/* Title + live badge */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h1 className="text-[15px] font-black tracking-tight text-white font-mono whitespace-nowrap">
                PREDICTIONS ARENA
              </h1>
              <span
                className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md flex-shrink-0"
                style={{
                  background: coordinator?.running ? 'rgba(232,180,94,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${coordinator?.running ? 'rgba(232,180,94,0.22)' : 'rgba(255,255,255,0.07)'}`,
                  color: coordinator?.running ? GOLD : 'rgba(255,255,255,0.22)',
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${coordinator?.running ? 'animate-pulse' : ''}`}
                  style={{ background: coordinator?.running ? GOLD : 'rgba(255,255,255,0.2)', flexShrink: 0 }}
                />
                {coordinator?.running ? 'LIVE' : 'PAUSED'}
              </span>
            </div>

            {/* Stats — desktop */}
            <div className="hidden lg:flex items-center gap-8">
              {([
                { label: 'Markets',     val: stats?.totalMarkets     ?? 0, suf: '' },
                { label: 'Predictions', val: stats?.totalPredictions ?? 0, suf: '' },
                { label: 'Accuracy',    val: stats?.avgAccuracy      ?? 0, suf: '%' },
              ] as const).map((s) => (
                <div key={s.label} className="text-right">
                  <div className="text-[16px] font-black font-mono tabular-nums leading-none" style={{ color: GOLD }}>
                    <CountUp to={s.val} suffix={s.suf} decimals={s.suf === '%' ? 1 : 0} />
                  </div>
                  <div className="text-[8px] font-mono uppercase tracking-[0.18em] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* WS indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono flex-shrink-0"
              style={{
                border: `1px solid ${wsConn ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                color: wsConn ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.15)',
              }}
            >
              {wsConn ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </div>
          </div>

          {/* Scrolling ticker tape */}
          {tape.length > 0 && (
            <div
              className="relative overflow-hidden"
              style={{ height: 26, background: 'rgba(232,180,94,0.015)', borderTop: '1px solid rgba(232,180,94,0.065)' }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 z-10 w-12 pointer-events-none"
                style={{ background: `linear-gradient(90deg,${BG},transparent)` }}
              />
              <div
                className="absolute right-0 top-0 bottom-0 z-10 w-12 pointer-events-none"
                style={{ background: `linear-gradient(-90deg,${BG},transparent)` }}
              />
              <div className="flex items-center h-full gap-8 px-4 whitespace-nowrap animate-[pa-ticker_55s_linear_infinite]">
                {[...tape, ...tape, ...tape].map((item, i) => {
                  const isSig = item.kind === 'signal';
                  const tick  = isSig ? (item.data as PredictionSignalEvent).ticker  : (item.data as PredictionConsensusEvent).ticker;
                  const side  = isSig ? (item.data as PredictionSignalEvent).side    : (item.data as PredictionConsensusEvent).side;
                  return (
                    <span key={i} className="flex items-center gap-1.5 text-[9px] font-mono flex-shrink-0">
                      <span style={{ color: GOLD, opacity: 0.22 }}>◆</span>
                      <span className="font-bold" style={{ color: 'rgba(255,255,255,0.22)' }}>{tick}</span>
                      <span className="font-black" style={{ color: side === 'YES' ? YES_C : NO_C, opacity: 0.6 }}>
                        {side}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Mobile tabs ─────────────────────────────────────────── */}
        <div
          className="lg:hidden flex flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(12,16,32,0.75)', backdropFilter: 'blur(12px)' }}
        >
          {([
            { id: 'markets',  label: 'Markets',  icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { id: 'predict',  label: 'Predict',  icon: <Target    className="w-3.5 h-3.5" /> },
            { id: 'activity', label: 'Activity', icon: <Activity  className="w-3.5 h-3.5" /> },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-mono font-black uppercase tracking-wider transition-all"
              style={{
                borderBottom: `2px solid ${mTab === tab.id ? GOLD : 'transparent'}`,
                color: mTab === tab.id ? GOLD : 'rgba(255,255,255,0.25)',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Alerts ──────────────────────────────────────────────── */}
        {(error || success) && (
          <div className="px-8 sm:px-12 pt-3 flex-shrink-0 z-10 relative max-w-[1280px] mx-auto w-full">
            {error && (
              <div
                className="px-4 py-3 text-[11px] font-mono mb-2 rounded-lg"
                style={{ background: `${NO_C}0c`, border: `1px solid ${NO_C}28`, color: NO_C }}
              >
                ⚠ {error}
              </div>
            )}
            {success && (
              <div
                className="px-4 py-3 text-[11px] font-mono flex items-center justify-between rounded-lg"
                style={{ background: `${YES_C}0c`, border: `1px solid ${YES_C}28`, color: YES_C }}
              >
                ✓ {success}
                <button onClick={() => setSuccess(null)} className="opacity-35 hover:opacity-80 ml-3 transition-opacity">✕</button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* 3-col layout                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div
          className="flex-1 lg:grid lg:grid-cols-[240px_1fr_280px] min-h-0 max-w-[1280px] mx-auto w-full"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >

          {/* ╔═══════════════════════╗ */}
          {/* ║  LEFT — MARKET LIST   ║ */}
          {/* ╚═══════════════════════╝ */}
          <div
            className={`${mTab !== 'markets' ? 'hidden lg:flex' : 'flex'} flex-col min-h-0`}
            style={{ borderRight: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,9,15,0.45)', backdropFilter: 'blur(12px)' }}
          >
            {/* Section header */}
            <div
              className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(12,16,32,0.6)', backdropFilter: 'blur(12px)' }}
            >
              <span
                className="text-[9px] font-mono font-black uppercase tracking-[0.25em]"
                style={{ color: 'rgba(232,180,94,0.45)' }}
              >
                Open Markets
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}
              >
                {markets.length}
              </span>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'none' }}>
              {markets.map((m) => (
                <MarketRow
                  key={m.id}
                  market={m}
                  selected={selectedTicker === m.ticker}
                  onClick={() => { setSelectedTicker(m.ticker); setMTab('predict'); }}
                />
              ))}
              {markets.length === 0 && (
                <p className="py-16 text-center text-[11px] text-white/16 font-mono">No markets</p>
              )}
            </div>
          </div>

          {/* ╔═══════════════════════╗ */}
          {/* ║  CENTER — ARENA       ║ */}
          {/* ╚═══════════════════════╝ */}
          <div
            className={`${mTab !== 'predict' ? 'hidden lg:flex' : 'flex'} flex-col overflow-y-auto min-h-0 px-6`}
            style={{ borderRight: '1px solid rgba(255,255,255,0.07)', scrollbarWidth: 'none', background: 'rgba(7,9,15,0.25)', backdropFilter: 'blur(8px)' }}
          >

            {!market ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(232,180,94,0.05)', border: '1px solid rgba(232,180,94,0.12)' }}
                >
                  <Target className="w-6 h-6" style={{ color: 'rgba(232,180,94,0.35)' }} />
                </div>
                <p className="text-[12px] text-white/20 font-mono">
                  <span className="lg:hidden">
                    <button
                      onClick={() => setMTab('markets')}
                      className="underline underline-offset-2 transition-opacity hover:opacity-80"
                      style={{ color: GOLD, opacity: 0.5 }}
                    >
                      Select a market
                    </button>
                  </span>
                  <span className="hidden lg:inline">← Select a market</span>
                </p>
              </div>
            ) : (
              <>
                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {/* HERO: MARKET STATS                                */}
                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                <div
                  className="flex-shrink-0 px-7 pt-7 pb-6 relative"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Top accent line */}
                  <div className="absolute top-0 left-8 right-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,180,94,0.18), transparent)' }} />
                  {/* Top meta row */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <span
                      className="text-[9px] font-black font-mono uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}
                    >
                      {market.platform}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5 text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <Clock className="w-3 h-3" />
                      {new Date(market.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}
                    </div>
                  </div>

                  {/* Question */}
                  <p className="text-[16px] font-semibold text-white/88 leading-snug mb-6">
                    {market.title}
                  </p>

                  {/* Big probability display */}
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <div
                        className="text-[52px] font-black font-mono leading-none tabular-nums"
                        style={{ color: yesPct >= 60 ? YES_C : yesPct <= 40 ? NO_C : GOLD }}
                      >
                        {yesPct}%
                      </div>
                      <div className="text-[10px] font-mono mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        YES probability
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-[28px] font-black font-mono leading-none tabular-nums"
                        style={{ color: 'rgba(248,113,113,0.65)' }}
                      >
                        {noPct}%
                      </div>
                      <div className="text-[10px] font-mono mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        NO probability
                      </div>
                    </div>
                  </div>

                  {/* Split bars */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {/* YES bar */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[9px] font-mono font-black uppercase tracking-wider" style={{ color: YES_C }}>YES</span>
                        <span className="text-[9px] font-mono" style={{ color: 'rgba(74,222,128,0.6)' }}>{yesPct}¢</span>
                      </div>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${yesPct}%`, background: YES_C, opacity: 0.6 }}
                        />
                      </div>
                    </div>
                    {/* NO bar */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[9px] font-mono font-black uppercase tracking-wider" style={{ color: NO_C }}>NO</span>
                        <span className="text-[9px] font-mono" style={{ color: 'rgba(248,113,113,0.6)' }}>{noPct}¢</span>
                      </div>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${noPct}%`, background: NO_C, opacity: 0.55 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Meta chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: 'Vol', val: `$${fmt$(market.volume)}` },
                      { label: 'Predictions', val: fmt$(stats?.totalPredictions ?? 0) },
                    ].map((chip) => (
                      <span
                        key={chip.label}
                        className="text-[9px] font-mono px-2 py-1 rounded-md"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
                      >
                        <span style={{ color: 'rgba(255,255,255,0.18)' }}>{chip.label}</span>
                        {' '}
                        <span style={{ color: 'rgba(255,255,255,0.48)' }}>{chip.val}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {/* PREDICTION FORM                                    */}
                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                <div
                  className="flex-shrink-0 px-7 py-6"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(12,16,32,0.35)', backdropFilter: 'blur(8px)' }}
                >
                  {/* YES / NO toggle */}
                  <div
                    className="grid grid-cols-2 gap-1.5 mb-5 p-1 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {(['YES', 'NO'] as const).map((side) => {
                      const active = form.side === side;
                      const col    = side === 'YES' ? YES_C : NO_C;
                      return (
                        <button
                          key={side}
                          onClick={() => setForm((p) => ({ ...p, side }))}
                          className="py-2.5 rounded-lg text-[12px] font-black font-mono uppercase tracking-wider transition-all duration-150"
                          style={active
                            ? { background: `${col}18`, color: col, border: `1px solid ${col}38` }
                            : { background: 'transparent', color: 'rgba(255,255,255,0.22)', border: '1px solid transparent' }
                          }
                        >
                          {side}
                        </button>
                      );
                    })}
                  </div>

                  {/* Contracts + Confidence */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {([
                      { key: 'contracts',  label: 'Contracts',   val: form.contracts,       min: 1,   max: 100, step: 1 },
                      { key: 'confidence', label: 'Confidence %', val: form.confidence ?? 0, min: 0,  max: 100, step: 5 },
                    ] as { key: 'contracts' | 'confidence'; label: string; val: number; min: number; max: number; step: number }[]).map(({ key, label, val, min, max, step }) => (
                      <div key={key}>
                        <span
                          className="block text-[8px] font-mono font-black uppercase tracking-[0.25em] mb-1.5"
                          style={{ color: 'rgba(232,180,94,0.45)' }}
                        >
                          {label}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setForm((p) => ({ ...p, [key]: Math.max(min, (p[key] as number) - step) }))}
                            className="w-8 h-9 flex items-center justify-center rounded-lg text-[14px] font-mono transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={min}
                            max={max}
                            value={val}
                            onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value || min) }))}
                            className="flex-1 h-9 text-center text-[13px] text-white font-mono font-bold focus:outline-none rounded-lg transition-colors"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,180,94,0.38)')}
                            onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                          />
                          <button
                            onClick={() => setForm((p) => ({ ...p, [key]: Math.min(max, (p[key] as number) + step) }))}
                            className="w-8 h-9 flex items-center justify-center rounded-lg text-[14px] font-mono transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Confidence slider */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[8px] font-mono font-black uppercase tracking-[0.25em]" style={{ color: 'rgba(232,180,94,0.45)' }}>
                        Confidence slider
                      </span>
                      <span className="text-[11px] font-mono font-black" style={{ color: GOLD }}>
                        {form.confidence ?? 70}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={form.confidence ?? 70}
                      onChange={(e) => setForm((p) => ({ ...p, confidence: Number(e.target.value) }))}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{ accentColor: GOLD, background: `linear-gradient(to right, ${GOLD} ${form.confidence ?? 70}%, rgba(255,255,255,0.1) ${form.confidence ?? 70}%)` }}
                    />
                  </div>

                  {/* Reasoning */}
                  <div className="mb-4">
                    <span className="block text-[8px] font-mono font-black uppercase tracking-[0.25em] mb-1.5" style={{ color: 'rgba(232,180,94,0.45)' }}>
                      Reasoning
                    </span>
                    <textarea
                      value={form.reasoning}
                      onChange={(e) => setForm((p) => ({ ...p, reasoning: e.target.value }))}
                      className="w-full px-3 py-2.5 text-[11px] text-white/50 min-h-[54px] resize-none font-mono focus:outline-none transition-colors placeholder:text-white/12 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,180,94,0.35)')}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                      placeholder="Your rationale..."
                    />
                  </div>

                  {/* Cost / payout / real order row */}
                  <div
                    className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="text-[10px] font-mono">
                      <span style={{ color: 'rgba(255,255,255,0.22)' }}>Cost </span>
                      <span style={{ color: 'rgba(255,255,255,0.55)' }}>${estCost}</span>
                    </div>
                    <div className="text-[10px] font-mono">
                      <span style={{ color: 'rgba(255,255,255,0.22)' }}>Payout </span>
                      <span style={{ color: YES_C, opacity: 0.7 }}>${estPayout}</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        onClick={() => setForm((p) => ({ ...p, placeRealOrder: !p.placeRealOrder }))}
                        className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                        style={{ background: form.placeRealOrder ? 'rgba(232,180,94,0.5)' : 'rgba(255,255,255,0.1)' }}
                      >
                        <div
                          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-150"
                          style={{ left: form.placeRealOrder ? 'calc(100% - 14px)' : '2px' }}
                        />
                      </button>
                      <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>Real order</span>
                    </label>
                  </div>

                  {/* CTA — solid gold */}
                  <button
                    onClick={onSubmit}
                    disabled={submitting || !authed}
                    className="w-full py-4 rounded-xl text-[13px] font-black font-mono uppercase tracking-[0.12em] transition-all duration-150 disabled:cursor-not-allowed"
                    style={authed && !submitting
                      ? { background: GOLD, color: '#060A14', boxShadow: '0 0 28px rgba(232,180,94,0.22)', opacity: 1 }
                      : { background: 'rgba(232,180,94,0.07)', border: '1px solid rgba(232,180,94,0.14)', color: 'rgba(232,180,94,0.25)', opacity: 1 }
                    }
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Placing...
                      </span>
                    ) : authed ? (
                      `Place ${form.side} — ${form.contracts} contract${form.contracts !== 1 ? 's' : ''}`
                    ) : (
                      'Sign in to predict'
                    )}
                  </button>
                </div>

                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {/* AGENT VOICES                                       */}
                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div
                    className="px-7 py-2.5 flex items-center gap-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(12,16,32,0.55)', backdropFilter: 'blur(10px)' }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" style={{ color: 'rgba(232,180,94,0.4)' }} />
                    <span className="text-[9px] font-mono font-black uppercase tracking-[0.22em]" style={{ color: 'rgba(232,180,94,0.5)' }}>
                      Agent Intelligence
                    </span>
                    <span
                      className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}
                    >
                      {voices.length}
                    </span>
                  </div>
                  <div>
                    {voicesLoading ? (
                      <div className="py-10 flex items-center justify-center gap-2.5">
                        <div className="w-4 h-4 border-2 border-white/8 border-t-white/30 rounded-full animate-spin" />
                        <span className="text-[11px] text-white/20 font-mono">Loading...</span>
                      </div>
                    ) : voices.length > 0 ? (
                      voices.map((v) => <VoiceCard key={v.id} voice={v} />)
                    ) : (
                      <div className="py-12 text-center">
                        <MessageSquare className="w-6 h-6 mx-auto mb-3 opacity-10 text-white" />
                        <p className="text-[11px] text-white/18 font-mono">No calls for {market.ticker} yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {/* MY POSITIONS                                       */}
                {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                <div className="flex-shrink-0">
                  <div
                    className="px-7 py-2.5 flex items-center gap-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(12,16,32,0.55)', backdropFilter: 'blur(10px)' }}
                  >
                    <Target className="w-3.5 h-3.5" style={{ color: 'rgba(232,180,94,0.4)' }} />
                    <span className="text-[9px] font-mono font-black uppercase tracking-[0.22em]" style={{ color: 'rgba(232,180,94,0.5)' }}>
                      My Positions
                    </span>
                    <span
                      className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}
                    >
                      {myPredictions.length}
                    </span>
                  </div>
                  {!authed ? (
                    <p className="py-10 text-center text-[11px] text-white/18 font-mono">Sign in to view positions</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {['Market', 'Side', 'Qty', 'Price', 'Status', 'PnL'].map((h) => (
                              <th
                                key={h}
                                className="py-2.5 px-5 text-left text-[8px] font-mono font-black uppercase tracking-[0.22em]"
                                style={{ color: 'rgba(232,180,94,0.35)' }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {myPredictions.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-10 text-center text-[11px] text-white/16 font-mono">
                                No positions yet
                              </td>
                            </tr>
                          )}
                          {myPredictions.map((p) => (
                            <tr
                              key={p.id}
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.035)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td className="py-3 px-5 text-[10px] text-white/40 font-mono max-w-[130px] truncate">{p.ticker}</td>
                              <td className="py-3 px-5">
                                <span
                                  className="text-[9px] font-black px-1.5 py-0.5 rounded font-mono"
                                  style={{
                                    background: p.side === 'YES' ? `${YES_C}12` : `${NO_C}12`,
                                    color: p.side === 'YES' ? YES_C : NO_C,
                                    border: `1px solid ${p.side === 'YES' ? `${YES_C}28` : `${NO_C}28`}`,
                                  }}
                                >
                                  {p.side}
                                </span>
                              </td>
                              <td className="py-3 px-5 text-[11px] text-white/35 font-mono">{p.contracts}</td>
                              <td className="py-3 px-5 text-[11px] text-white/35 font-mono">{(p.avgPrice * 100).toFixed(0)}¢</td>
                              <td className="py-3 px-5 text-[10px] font-mono font-bold">
                                <span style={{ color: p.outcome === 'PENDING' ? 'rgba(232,180,94,0.6)' : p.outcome === 'WIN' ? YES_C : NO_C }}>
                                  {p.outcome}
                                </span>
                              </td>
                              <td
                                className="py-3 px-5 text-[11px] font-mono font-black"
                                style={{ color: p.pnl && p.pnl > 0 ? YES_C : p.pnl && p.pnl < 0 ? NO_C : 'rgba(255,255,255,0.18)' }}
                              >
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

          {/* ╔═══════════════════════╗ */}
          {/* ║  RIGHT — SCOREBOARD   ║ */}
          {/* ╚═══════════════════════╝ */}
          <div className={`${mTab !== 'activity' ? 'hidden lg:flex' : 'flex'} flex-col min-h-0 px-4`} style={{ background: 'rgba(7,9,15,0.40)', backdropFilter: 'blur(12px)' }}>

            {/* ── Leaderboard ─────────────────────────────────── */}
            <div
              className="flex flex-col min-h-0"
              style={{ flex: '0 0 50%', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div
                className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(12,16,32,0.6)', backdropFilter: 'blur(10px)' }}
              >
                <Trophy className="w-3.5 h-3.5" style={{ color: 'rgba(232,180,94,0.4)' }} />
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.22em]" style={{ color: 'rgba(232,180,94,0.5)' }}>
                  Top Forecasters
                </span>
              </div>
              <div className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'none' }}>
                {leaderboard.slice(0, 10).map((row, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <Link
                      key={row.agentId}
                      href={`/agents/${row.agentId}`}
                      className="flex items-center gap-3 px-4 py-3 group transition-all cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.035)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Rank */}
                      {medal ? (
                        <span className="text-[14px] flex-shrink-0 leading-none">{medal}</span>
                      ) : (
                        <div
                          className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[9px] font-black font-mono rounded"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          {row.rank}
                        </div>
                      )}

                      {/* Name + bar */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/50 font-semibold truncate group-hover:text-white/75 transition-colors mb-1.5">
                          {row.agentName}
                        </p>
                        {row.resolved !== false && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(100, row.accuracy)}%`, background: GOLD, opacity: 0.55 }}
                              />
                            </div>
                            <span className="text-[9px] font-mono flex-shrink-0" style={{ color: 'rgba(232,180,94,0.55)' }}>
                              {fmtPct(row.accuracy)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ROI */}
                      {row.resolved !== false && (
                        <div className="text-right flex-shrink-0">
                          <p
                            className="text-[12px] font-mono font-black"
                            style={{ color: row.roi >= 0 ? YES_C : NO_C }}
                          >
                            {row.roi >= 0 ? '+' : ''}{fmtPct(row.roi)}
                          </p>
                        </div>
                      )}
                    </Link>
                  );
                })}
                {leaderboard.length === 0 && (
                  <p className="py-10 text-center text-[11px] text-white/16 font-mono">No data</p>
                )}
              </div>
            </div>

            {/* ── Live Signals ─────────────────────────────────── */}
            <div
              className="flex flex-col min-h-0"
              style={{ flex: '0 0 50%' }}
            >
              <div
                className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(12,16,32,0.6)', backdropFilter: 'blur(10px)' }}
              >
                <Activity className="w-3.5 h-3.5" style={{ color: 'rgba(232,180,94,0.4)' }} />
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.22em]" style={{ color: 'rgba(232,180,94,0.5)' }}>
                  Live Signals
                </span>
                {wsConn && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: GOLD, opacity: 0.55 }}
                  />
                )}
              </div>
              <div ref={tapeRef} className="overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'none' }}>
                {tape.length === 0 ? (
                  <p className="py-10 text-center text-[11px] text-white/14 font-mono">Waiting for signals...</p>
                ) : (
                  tape.map((item) => (
                    <TapeRow key={item.ts} item={item} isNew={newIds.has(item.ts)} />
                  ))
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
    </>
  );
}
