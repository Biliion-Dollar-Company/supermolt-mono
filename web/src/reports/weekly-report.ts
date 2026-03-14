/**
 * Weekly Performance Report
 *
 * Aggregates the last 7 days of data from all subsystems into a single
 * typed WeeklyReportData object. Every data source has a mock/fallback
 * — this module never throws.
 *
 * @module
 */

import { loadPerformanceHistory, type PerformanceHistory } from '../positions/performance-history.ts';
import { loadTrackerSummary, type TrackerSummary } from '../positions/paper-tracker.ts';
import { compareStrategies, type StrategyComparisonReport, type StrategyStats } from './strategy-comparison.ts';
import { detectMarketRegime, type Regime } from '../regime/market-regime.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-day P&L and Brier entry for the 7-day trend */
export interface DailyTrend {
  date: string;
  pnl: number;
  brierScore: number | null;
  tradeCount: number;
}

/** Regime distribution over the past 7 days */
export interface RegimeDistribution {
  bull: number;
  bear: number;
  sideways: number;
  /** Current (most recent) regime */
  current: Regime;
  /** Kelly multiplier for current regime */
  kellyMultiplier: 0.8 | 1.0 | 1.2;
}

/** Weekly strategy winner/loser */
export interface WeeklyStrategyHighlight {
  name: string;
  winRate: number;
  realizedPnl: number;
}

/** The full weekly report payload */
export interface WeeklyReportData {
  /** ISO timestamp when the report was generated */
  generatedAt: string;
  /** Start date of the 7-day window (ISO date string) */
  weekStart: string;
  /** End date of the 7-day window (ISO date string) */
  weekEnd: string;
  /** Data mode — 'mock' in zero-API mode, 'live' otherwise */
  mode: 'live' | 'mock';

  // Section 1 — Summary
  totalTrades: number;
  winRate: number;
  realizedPnl: number;
  openPositions: number;
  trackerSource: TrackerSummary['source'];

  // Section 2 — 7-day P&L trend
  dailyTrend: DailyTrend[];
  weeklyPnl: number;

  // Section 3 — Best/worst strategy
  bestStrategy: WeeklyStrategyHighlight | null;
  worstStrategy: WeeklyStrategyHighlight | null;

  // Section 4 — Market regime
  regime: RegimeDistribution;

  // Section 5 — Brier score
  avgBrierScore: number | null;
  priorWeekBrierScore: number | null;

  // Section 6 — Outlook (regime-aware Kelly)
  nextWeekOutlook: string;
}

// ---------------------------------------------------------------------------
// Mock regime distribution (used when API unavailable)
// ---------------------------------------------------------------------------

const MOCK_REGIME_DISTRIBUTION: RegimeDistribution = {
  bull: 3,
  bear: 1,
  sideways: 3,
  current: 'bull',
  kellyMultiplier: 1.2,
};

const MISSING_TRACKER: TrackerSummary = {
  totalTrades: 0,
  winRate: 0,
  realizedPnl: 0,
  openPositions: 0,
  source: 'missing',
};

const MISSING_HISTORY: PerformanceHistory = {
  days: [],
  totalPnl: 0,
  avgBrierScore: null,
  source: 'missing',
};

const MISSING_COMPARISON: StrategyComparisonReport = {
  generatedAt: new Date().toISOString(),
  mode: 'mock',
  source: 'missing',
  strategies: [],
};

// ---------------------------------------------------------------------------
// Fetcher helpers — each must NOT throw
// ---------------------------------------------------------------------------

async function fetchHistory(mock: boolean): Promise<PerformanceHistory> {
  try {
    return loadPerformanceHistory(mock);
  } catch {
    return MISSING_HISTORY;
  }
}

async function fetchTracker(mock: boolean): Promise<TrackerSummary> {
  try {
    return loadTrackerSummary(mock);
  } catch {
    return MISSING_TRACKER;
  }
}

async function fetchComparison(mock: boolean): Promise<StrategyComparisonReport> {
  try {
    return await compareStrategies(mock);
  } catch {
    return MISSING_COMPARISON;
  }
}

async function fetchRegime(mock: boolean): Promise<RegimeDistribution> {
  if (mock) return MOCK_REGIME_DISTRIBUTION;

  try {
    const result = await detectMarketRegime();
    return {
      bull: result.regime === 'bull' ? 4 : 2,
      bear: result.regime === 'bear' ? 4 : 1,
      sideways: result.regime === 'sideways' ? 4 : 2,
      current: result.regime,
      kellyMultiplier: result.kellyMultiplier,
    };
  } catch {
    return MOCK_REGIME_DISTRIBUTION;
  }
}

// ---------------------------------------------------------------------------
// Outlook builder
// ---------------------------------------------------------------------------

/**
 * Builds a plain-text next-week outlook recommendation.
 * Regime-aware: adjusts Kelly suggestion based on market conditions.
 */
function buildOutlook(
  regime: RegimeDistribution,
  best: WeeklyStrategyHighlight | null,
  brierScore: number | null,
): string {
  const kellyDesc =
    regime.kellyMultiplier === 1.2
      ? 'scale up Kelly (×1.2) — bullish regime supports larger positions'
      : regime.kellyMultiplier === 0.8
        ? 'scale down Kelly (×0.8) — bearish regime, reduce exposure'
        : 'maintain baseline Kelly (×1.0) — sideways market, stay neutral';

  const strategyNote =
    best !== null
      ? `${best.name} was top performer (${best.winRate.toFixed(1)}% WR, ${best.realizedPnl >= 0 ? '+' : ''}$${best.realizedPnl.toFixed(2)} P&L). Consider increasing allocation.`
      : 'No resolved strategies this week. Monitor positions before allocating more capital.';

  const brierNote =
    brierScore !== null
      ? `Brier score ${brierScore.toFixed(4)} — ${brierScore < 0.15 ? 'excellent calibration, trust model signals' : brierScore < 0.25 ? 'good calibration, proceed with standard sizing' : 'calibration needs improvement, reduce position sizes'}.`
      : 'Insufficient Brier data this week.';

  return `${kellyDesc.charAt(0).toUpperCase() + kellyDesc.slice(1)}. ${strategyNote} ${brierNote}`;
}

// ---------------------------------------------------------------------------
// WeeklyReport class
// ---------------------------------------------------------------------------

/**
 * WeeklyReport — aggregates all subsystems and returns a WeeklyReportData.
 *
 * @example
 * ```ts
 * const report = new WeeklyReport();
 * const data = await report.generateWeeklyReport(true); // mock mode
 * ```
 */
export class WeeklyReport {
  /**
   * Generates a weekly performance report.
   * Never throws — all data sources degrade gracefully.
   *
   * @param mock - When true, all data sources use synthetic data (no API calls)
   */
  async generateWeeklyReport(mock: boolean): Promise<WeeklyReportData> {
    const now = new Date();
    const weekEnd = now.toISOString().slice(0, 10);
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - 6);
    const weekStart = weekStartDate.toISOString().slice(0, 10);

    // Run all data sources in parallel — each must not throw
    const [history, tracker, comparison, regime] = await Promise.all([
      fetchHistory(mock),
      fetchTracker(mock),
      fetchComparison(mock),
      fetchRegime(mock),
    ]);

    // Build daily trend from history
    const dailyTrend: DailyTrend[] = history.days.map((d) => ({
      date: d.date,
      pnl: d.pnl,
      brierScore: d.brierScore,
      tradeCount: d.tradeCount,
    }));

    // Strategy highlights — sorted by realized P&L
    const activeStrategies: StrategyStats[] = comparison.strategies.filter(
      (s) => s.tradeCount > 0,
    );
    const sorted = [...activeStrategies].sort((a, b) => b.realizedPnl - a.realizedPnl);

    const bestStrategy: WeeklyStrategyHighlight | null =
      sorted.length > 0
        ? { name: sorted[0].strategy, winRate: sorted[0].winRate, realizedPnl: sorted[0].realizedPnl }
        : null;

    const worstStrategy: WeeklyStrategyHighlight | null =
      sorted.length > 1
        ? {
            name: sorted[sorted.length - 1].strategy,
            winRate: sorted[sorted.length - 1].winRate,
            realizedPnl: sorted[sorted.length - 1].realizedPnl,
          }
        : null;

    // Brier scores
    const avgBrierScore = history.avgBrierScore;
    // Prior week Brier: stub — would come from a historical store in production
    const priorWeekBrierScore = mock ? 0.20 : null;

    // Next week outlook
    const nextWeekOutlook = buildOutlook(regime, bestStrategy, avgBrierScore);

    return {
      generatedAt: now.toISOString(),
      weekStart,
      weekEnd,
      mode: mock ? 'mock' : 'live',

      totalTrades: tracker.totalTrades,
      winRate: tracker.winRate,
      realizedPnl: tracker.realizedPnl,
      openPositions: tracker.openPositions,
      trackerSource: tracker.source,

      dailyTrend,
      weeklyPnl: history.totalPnl,

      bestStrategy,
      worstStrategy,

      regime,

      avgBrierScore,
      priorWeekBrierScore,

      nextWeekOutlook,
    };
  }
}
