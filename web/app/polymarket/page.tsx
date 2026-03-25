'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Clock,
  Percent,
  DollarSign,
  Crosshair,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import {
  getPolymarketSignals,
  getPolymarketMarkets,
  getPolymarketArbOpportunities,
  getPolymarketBrierHistory,
  getPredictionStats,
  getMyPredictions,
} from '@/lib/api';
import type { AgentPrediction, PredictionStats } from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────

interface PortfolioSummary {
  bankroll: number;
  totalPnl: number;
  totalPnlPct: number;
  winRate: number;
  brierScore: number;
  activePredictions: number;
}

interface MarketPosition {
  id: string;
  title: string;
  ticker: string;
  side: 'YES' | 'NO';
  entryPrice: number;
  currentPrice: number;
  contracts: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  expiresAt: string;
}

interface ArbOpportunity {
  id: string;
  market: string;
  spreadPct: number;
  expectedProfitPct: number;
  direction: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedAt: string;
  expiresInHours: number;
}

interface BrierHistoryEntry {
  timestamp: string;
  brierScore: number;
  winRate: number;
  sharpe: number;
  totalMarkets: number;
  activePredictions: number;
  avgEdgePct: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function timeUntil(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

function confidenceColor(c: string): string {
  switch (c) {
    case 'HIGH': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'MEDIUM': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default: return 'bg-white/5 text-text-muted border-white/10';
  }
}

// ── Stat Card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subValue,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="group relative p-4 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden">
      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/[0.06] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/[0.06] pointer-events-none" />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-text-muted/60">{icon}</span>
        <p className="text-[10px] text-text-muted uppercase tracking-wider font-mono">{label}</p>
      </div>
      <p className={`text-xl font-semibold tabular-nums ${valueColor || 'text-text-primary'}`}>{value}</p>
      {subValue && <p className="text-[10px] text-text-muted font-mono mt-0.5 tabular-nums">{subValue}</p>}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────

function SectionHeader({ title, icon, count }: { title: string; icon: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">{title}</h2>
      </div>
      {count !== undefined && (
        <span className="text-[10px] text-text-muted font-mono">{count}</span>
      )}
    </div>
  );
}

// ── Custom Tooltip for Chart ──────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d0f16] border border-white/[0.12] px-3 py-2 text-xs font-mono">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function PolymarketDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Data
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<MarketPosition[]>([]);
  const [arbOpps, setArbOpps] = useState<ArbOpportunity[]>([]);
  const [brierHistory, setBrierHistory] = useState<BrierHistoryEntry[]>([]);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [myPredictions, setMyPredictions] = useState<AgentPrediction[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────────

  const refreshData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);

    try {
      const [signalsRes, marketsRes, arbRes, historyRes, statsRes, predictionsRes] = await Promise.allSettled([
        getPolymarketSignals(),
        getPolymarketMarkets(),
        getPolymarketArbOpportunities(),
        getPolymarketBrierHistory(),
        getPredictionStats(),
        getMyPredictions(100).catch(() => []),
      ]);

      // Parse signals into portfolio summary
      if (signalsRes.status === 'fulfilled' && signalsRes.value) {
        const s = signalsRes.value?.data || signalsRes.value;
        setPortfolio({
          bankroll: s.bankroll ?? s.totalBankroll ?? 1000,
          totalPnl: s.totalPnl ?? s.pnl ?? 0,
          totalPnlPct: s.totalPnlPct ?? s.pnlPct ?? 0,
          winRate: s.winRate ?? 0,
          brierScore: s.brierScore ?? s.brier ?? 0,
          activePredictions: s.activePredictions ?? s.active ?? 0,
        });
      }

      // Parse markets into positions
      if (marketsRes.status === 'fulfilled') {
        const raw = marketsRes.value;
        const markets = Array.isArray(raw) ? raw : [];
        // Merge with user's predictions for position data
        const preds = predictionsRes.status === 'fulfilled' ? (predictionsRes.value as AgentPrediction[]) : [];
        setMyPredictions(preds);

        const activePositions: MarketPosition[] = preds
          .filter((p) => p.outcome === 'PENDING')
          .map((p) => {
            const market = markets.find((m: any) => m.ticker === p.ticker || m.id === p.ticker);
            const currentYes = market?.yesPrice ?? p.currentYesPrice ?? p.avgPrice;
            const currentPrice = p.side === 'YES' ? currentYes : 1 - currentYes;
            const unrealisedPnl = (currentPrice - p.avgPrice) * p.contracts;
            const unrealisedPnlPct = p.avgPrice > 0 ? ((currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;

            return {
              id: p.id,
              title: p.marketTitle || p.ticker,
              ticker: p.ticker,
              side: p.side,
              entryPrice: p.avgPrice,
              currentPrice,
              contracts: p.contracts,
              unrealisedPnl,
              unrealisedPnlPct,
              expiresAt: market?.expiresAt || '',
            };
          });
        setPositions(activePositions);
      }

      // Arb opportunities
      if (arbRes.status === 'fulfilled') {
        setArbOpps(arbRes.value as ArbOpportunity[]);
      }

      // Brier history for chart
      if (historyRes.status === 'fulfilled') {
        const hist = (historyRes.value as BrierHistoryEntry[]).map((h, i) => ({
          ...h,
          timestamp: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        }));
        setBrierHistory(hist);
      }

      // Stats
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value as PredictionStats);
      }

      // Build portfolio from predictions if signals endpoint failed
      if (signalsRes.status === 'rejected' && predictionsRes.status === 'fulfilled') {
        const preds = predictionsRes.value as AgentPrediction[];
        const wins = preds.filter((p) => p.outcome === 'WIN').length;
        const resolved = preds.filter((p) => p.outcome !== 'PENDING').length;
        const totalPnl = preds.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
        setPortfolio({
          bankroll: 1000 + totalPnl,
          totalPnl,
          totalPnlPct: (totalPnl / 1000) * 100,
          winRate: resolved > 0 ? (wins / resolved) * 100 : 0,
          brierScore: (statsRes.status === 'fulfilled' ? (statsRes.value as PredictionStats).avgBrierScore : 0),
          activePredictions: preds.filter((p) => p.outcome === 'PENDING').length,
        });
      }

      setLastRefresh(new Date());
    } catch {
      // Partial failures are OK — individual states remain as-is
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    intervalRef.current = setInterval(() => refreshData(), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refreshData]);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          <p className="text-sm text-text-muted font-mono">Loading Polymarket dashboard...</p>
        </div>
      </div>
    );
  }

  const totalPnlColor = (portfolio?.totalPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] relative">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(16,185,129,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(37,99,235,0.04) 0%, transparent 50%), radial-gradient(ellipse at center, rgba(10,10,18,1) 0%, rgba(5,5,12,1) 100%)',
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
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
                Polymarket P&L
              </h1>
              <p className="text-[11px] text-text-muted/60 font-mono tracking-wide">
                PAPER TRADING DASHBOARD &mdash; PORTFOLIO + ARB SCANNER
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[10px] text-text-muted font-mono">
                Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => refreshData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-white/[0.1] text-text-muted hover:text-text-primary hover:border-white/[0.2] transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Portfolio Stats ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Paper Bankroll"
            value={formatMoney(portfolio?.bankroll ?? 1000)}
            icon={<DollarSign className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Total P&L"
            value={formatMoney(portfolio?.totalPnl ?? 0)}
            subValue={formatPct(portfolio?.totalPnlPct ?? 0)}
            icon={(portfolio?.totalPnl ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            valueColor={totalPnlColor}
          />
          <StatCard
            label="Win Rate"
            value={`${(portfolio?.winRate ?? 0).toFixed(1)}%`}
            subValue={`${positions.length} active`}
            icon={<Target className="w-3.5 h-3.5" />}
            valueColor={(portfolio?.winRate ?? 0) >= 50 ? 'text-emerald-400' : 'text-amber-400'}
          />
          <StatCard
            label="Brier Score"
            value={(portfolio?.brierScore ?? 0).toFixed(4)}
            subValue="Lower is better"
            icon={<Crosshair className="w-3.5 h-3.5" />}
            valueColor={(portfolio?.brierScore ?? 0) < 0.25 ? 'text-emerald-400' : 'text-amber-400'}
          />
          <StatCard
            label="Active Positions"
            value={String(portfolio?.activePredictions ?? positions.length)}
            subValue={stats ? `${stats.totalMarkets} markets tracked` : undefined}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
          />
        </div>

        {/* ── Main Grid: Positions + Arb + Chart ──────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          {/* ── LEFT Column ─────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Active Positions Table */}
            <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
              <SectionHeader
                title="Active Positions"
                icon={<Target className="w-3.5 h-3.5 text-accent-primary" />}
                count={positions.length}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead className="sticky top-0 z-10 bg-[#0d0f16]/95 backdrop-blur">
                    <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="py-2.5 px-4 min-w-[200px]">Market</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3 text-right">Entry</th>
                      <th className="py-2.5 px-3 text-right">Current</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unrealised P&L</th>
                      <th className="py-2.5 px-3 text-right">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {positions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-4">
                          <p className="text-text-primary text-xs font-medium line-clamp-1">{pos.title}</p>
                          <p className="text-[10px] text-text-muted font-mono">{pos.ticker}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded-sm ${
                              pos.side === 'YES'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {pos.side === 'YES' ? (
                              <ArrowUpRight className="w-2.5 h-2.5" />
                            ) : (
                              <ArrowDownRight className="w-2.5 h-2.5" />
                            )}
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary font-mono text-xs text-right">
                          {(pos.entryPrice * 100).toFixed(0)}c
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary font-mono text-xs text-right">
                          {(pos.currentPrice * 100).toFixed(0)}c
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary font-mono text-xs text-right">
                          {pos.contracts}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`font-mono text-xs ${
                              pos.unrealisedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {pos.unrealisedPnl >= 0 ? '+' : ''}
                            {pos.unrealisedPnl.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-text-muted ml-1.5 font-mono">
                            ({formatPct(pos.unrealisedPnlPct)})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-[10px] text-text-muted font-mono inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {pos.expiresAt ? timeUntil(pos.expiresAt) : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {positions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center">
                          <Target className="w-5 h-5 text-text-muted/30 mx-auto mb-2" />
                          <p className="text-xs text-text-muted font-mono">No active positions</p>
                          <p className="text-[10px] text-text-muted/50 font-mono mt-1">
                            Place predictions in the{' '}
                            <Link href="/arena/predictions" className="text-accent-primary hover:underline">
                              Prediction Arena
                            </Link>
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Brier Score Chart */}
            <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
              <SectionHeader
                title="Strategy Evolution"
                icon={<BarChart3 className="w-3.5 h-3.5 text-cyan-400" />}
                count={brierHistory.length}
              />
              <div className="p-4">
                {brierHistory.length > 1 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={brierHistory} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <defs>
                        <linearGradient id="brierGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="sharpeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      />
                      <RechartsTooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="brierScore"
                        name="Brier Score"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#brierGradient)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#10b981', stroke: '#0d0f16', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sharpe"
                        name="Sharpe"
                        stroke="#2563EB"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 3, fill: '#2563EB', stroke: '#0d0f16', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[240px]">
                    <BarChart3 className="w-6 h-6 text-text-muted/20 mb-2" />
                    <p className="text-xs text-text-muted font-mono">Not enough history data for chart</p>
                    <p className="text-[10px] text-text-muted/50 font-mono mt-1">Run more strategy cycles to build history</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT Column: Arb Feed ──────────────────────────────── */}
          <div className="space-y-4">
            <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
              <SectionHeader
                title="Arb Opportunities"
                icon={<Percent className="w-3.5 h-3.5 text-amber-400" />}
                count={arbOpps.length}
              />
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                {arbOpps.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <AlertTriangle className="w-5 h-5 text-text-muted/20 mx-auto mb-2" />
                    <p className="text-xs text-text-muted font-mono">No arb opportunities detected</p>
                    <p className="text-[10px] text-text-muted/50 font-mono mt-1">
                      Scanner checks Polymarket vs 1Win spreads
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {arbOpps.map((arb) => (
                      <div
                        key={arb.id}
                        className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-text-primary font-medium line-clamp-2 flex-1">
                            {arb.market}
                          </p>
                          <span
                            className={`shrink-0 inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded-sm ${confidenceColor(arb.confidence)}`}
                          >
                            {arb.confidence}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[9px] text-text-muted uppercase tracking-wider font-mono">Spread</p>
                            <p className="text-sm font-mono text-amber-400">
                              {arb.spreadPct.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-text-muted uppercase tracking-wider font-mono">Expected</p>
                            <p className="text-sm font-mono text-emerald-400">
                              +{arb.expectedProfitPct.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-text-muted uppercase tracking-wider font-mono">Action</p>
                            <p className="text-sm font-mono text-text-primary">
                              {arb.direction === 'buy_poly_yes' ? 'BUY YES' : 'BUY NO'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-muted font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Expires in {arb.expiresInHours.toFixed(0)}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Settled Predictions Summary */}
            <div className="border border-white/[0.08] bg-[#0d0f16]/90 backdrop-blur-sm overflow-hidden">
              <SectionHeader
                title="Recent Settled"
                icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                count={myPredictions.filter((p) => p.outcome !== 'PENDING').length}
              />
              <div className="max-h-[320px] overflow-y-auto divide-y divide-white/[0.04]">
                {myPredictions
                  .filter((p) => p.outcome !== 'PENDING')
                  .slice(0, 15)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-primary font-mono truncate">{p.ticker}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[9px] font-mono px-1 py-0.5 rounded-sm ${
                              p.side === 'YES'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {p.side}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">
                            {p.contracts} @ {(p.avgPrice * 100).toFixed(0)}c
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-mono font-medium ${
                            p.outcome === 'WIN' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {p.outcome}
                        </span>
                        <p
                          className={`text-[10px] font-mono ${
                            (p.pnl ?? 0) >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'
                          }`}
                        >
                          {p.pnl != null
                            ? `${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                {myPredictions.filter((p) => p.outcome !== 'PENDING').length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-text-muted font-mono">
                    No settled predictions yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
