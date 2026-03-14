/**
 * Strategy Comparison Report
 *
 * Compares all agent strategies head-to-head using paper trading data.
 *
 * Strategies tracked:
 *   - PM_LONG       — agent-alpha-simple (pure Polymarket long signals)
 *   - HIGH_EDGE     — agent-alpha-multi-strategy (high-edge EV filter)
 *   - FADE_MARKET   — agent-alpha-multi-strategy (contrarian fade signals)
 *   - MOMENTUM      — agent-alpha-multi-strategy (price momentum)
 *
 * Data source: data/paper-positions.json
 * Mock mode: set MOCK_DATA=true in environment
 *
 * @module
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the project root (two dirs up from src/reports/) */
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All known strategy tags */
export type StrategyTag = 'PM_LONG' | 'HIGH_EDGE' | 'FADE_MARKET' | 'MOMENTUM';

/** All known strategy tags as an array (for iteration) */
export const ALL_STRATEGY_TAGS: StrategyTag[] = ['PM_LONG', 'HIGH_EDGE', 'FADE_MARKET', 'MOMENTUM'];

/** A single paper trading position with a strategy tag */
export interface StrategyPosition {
  id: string;
  strategy: StrategyTag;
  market: string;
  direction: 'YES' | 'NO';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  status: 'open' | 'closed';
  /** Stored realized P&L (takes precedence over derived) */
  pnl?: number;
  /** Agent's predicted probability at entry (0-1), used for Brier score */
  predictedProb?: number;
  /** Actual outcome (1 = YES won, 0 = NO won), set on close */
  outcome?: 0 | 1;
  /** Edge score at entry (%) */
  edgePercent?: number;
  timestamp: string;
}

/** Per-strategy aggregated stats */
export interface StrategyStats {
  strategy: StrategyTag;
  tradeCount: number;
  winRate: number;
  avgEdgePercent: number;
  realizedPnl: number;
  brierScore: number | null;
  bestTrade: StrategyPosition | null;
  worstTrade: StrategyPosition | null;
}

/** Full comparison report */
export interface StrategyComparisonReport {
  generatedAt: string;
  mode: 'live' | 'mock';
  source: 'file' | 'mock' | 'missing';
  note?: string;
  strategies: StrategyStats[];
}

// ---------------------------------------------------------------------------
// Brier score calculation
// ---------------------------------------------------------------------------

/**
 * Computes the Brier score for a set of closed positions that have outcome data.
 * Brier score = mean((predictedProb - outcome)^2)
 * Lower is better. Returns null when insufficient data.
 *
 * @param positions - Closed positions with predictedProb and outcome fields
 * @returns Brier score (0-1) or null
 */
export function computeBrierScore(positions: StrategyPosition[]): number | null {
  const scored = positions.filter(
    (p) => p.status === 'closed' && p.predictedProb !== undefined && p.outcome !== undefined,
  );

  if (scored.length === 0) return null;

  const sumSquaredError = scored.reduce((sum, p) => {
    const prob = p.predictedProb as number;
    const outcome = p.outcome as number;
    return sum + Math.pow(prob - outcome, 2);
  }, 0);

  return Math.round((sumSquaredError / scored.length) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// P&L helpers
// ---------------------------------------------------------------------------

/**
 * Computes effective P&L for a position.
 * Uses stored pnl field if present, otherwise derives from entry/exit prices.
 *
 * @param p - The position
 * @returns Realized P&L in USD
 */
export function effectivePnl(p: StrategyPosition): number {
  if (p.pnl !== undefined) return p.pnl;
  if (p.exitPrice !== undefined) {
    const raw = (p.exitPrice - p.entryPrice) * p.size;
    // YES direction profits when price goes up; NO direction profits when price goes down
    return p.direction === 'YES' ? raw : -raw;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Per-strategy stat computation
// ---------------------------------------------------------------------------

/**
 * Computes aggregated stats for a single strategy's positions.
 *
 * @param strategy - The strategy tag
 * @param positions - All positions for this strategy
 * @returns StrategyStats object
 */
export function computeStrategyStats(
  strategy: StrategyTag,
  positions: StrategyPosition[],
): StrategyStats {
  if (positions.length === 0) {
    return {
      strategy,
      tradeCount: 0,
      winRate: 0,
      avgEdgePercent: 0,
      realizedPnl: 0,
      brierScore: null,
      bestTrade: null,
      worstTrade: null,
    };
  }

  const closed = positions.filter((p) => p.status === 'closed');

  // Win rate — based on closed positions only
  const wins = closed.filter((p) => effectivePnl(p) > 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 1000) / 10 : 0;

  // Average edge — use stored edgePercent if available
  const withEdge = positions.filter((p) => p.edgePercent !== undefined);
  const avgEdgePercent =
    withEdge.length > 0
      ? Math.round((withEdge.reduce((sum, p) => sum + (p.edgePercent as number), 0) / withEdge.length) * 100) / 100
      : 0;

  // Realized P&L — sum of closed positions
  const realizedPnl = Math.round(closed.reduce((sum, p) => sum + effectivePnl(p), 0) * 100) / 100;

  // Brier score
  const brierScore = computeBrierScore(positions);

  // Best / worst trade by P&L (closed only)
  let bestTrade: StrategyPosition | null = null;
  let worstTrade: StrategyPosition | null = null;

  for (const p of closed) {
    const pnl = effectivePnl(p);
    if (bestTrade === null || pnl > effectivePnl(bestTrade)) bestTrade = p;
    if (worstTrade === null || pnl < effectivePnl(worstTrade)) worstTrade = p;
  }

  return {
    strategy,
    tradeCount: positions.length,
    winRate,
    avgEdgePercent,
    realizedPnl,
    brierScore,
    bestTrade,
    worstTrade,
  };
}

// ---------------------------------------------------------------------------
// Mock data (15+ synthetic trades across all strategies)
// ---------------------------------------------------------------------------

/** 15+ synthetic trades for mock / MOCK_DATA=true mode */
export const MOCK_POSITIONS: StrategyPosition[] = [
  // PM_LONG — 4 trades
  {
    id: 'pm-1', strategy: 'PM_LONG', market: 'BTC > $100k by EOY 2026',
    direction: 'YES', entryPrice: 0.38, exitPrice: 0.72, size: 100,
    status: 'closed', pnl: 34.0, edgePercent: 8.2, predictedProb: 0.65, outcome: 1,
    timestamp: '2026-02-01T10:00:00Z',
  },
  {
    id: 'pm-2', strategy: 'PM_LONG', market: 'ETH > $5k Q2 2026',
    direction: 'YES', entryPrice: 0.55, exitPrice: 0.30, size: 80,
    status: 'closed', pnl: -20.0, edgePercent: 5.1, predictedProb: 0.60, outcome: 0,
    timestamp: '2026-02-05T11:00:00Z',
  },
  {
    id: 'pm-3', strategy: 'PM_LONG', market: 'Fed rate cut March 2026',
    direction: 'YES', entryPrice: 0.62, exitPrice: 0.85, size: 120,
    status: 'closed', pnl: 27.6, edgePercent: 9.5, predictedProb: 0.75, outcome: 1,
    timestamp: '2026-02-10T09:00:00Z',
  },
  {
    id: 'pm-4', strategy: 'PM_LONG', market: 'US GDP > 2.5% Q1 2026',
    direction: 'YES', entryPrice: 0.50, size: 150,
    status: 'open', edgePercent: 6.3,
    timestamp: '2026-03-01T08:00:00Z',
  },

  // HIGH_EDGE — 4 trades
  {
    id: 'he-1', strategy: 'HIGH_EDGE', market: 'DOGE > $1 by Q2 2026',
    direction: 'YES', entryPrice: 0.22, exitPrice: 0.55, size: 200,
    status: 'closed', pnl: 66.0, edgePercent: 15.3, predictedProb: 0.55, outcome: 1,
    timestamp: '2026-02-03T14:00:00Z',
  },
  {
    id: 'he-2', strategy: 'HIGH_EDGE', market: 'AI regulation bill passes',
    direction: 'NO', entryPrice: 0.70, exitPrice: 0.25, size: 100,
    status: 'closed', pnl: 45.0, edgePercent: 12.1, predictedProb: 0.25, outcome: 0,
    timestamp: '2026-02-07T10:00:00Z',
  },
  {
    id: 'he-3', strategy: 'HIGH_EDGE', market: 'Trump signs crypto EO',
    direction: 'YES', entryPrice: 0.45, exitPrice: 0.38, size: 90,
    status: 'closed', pnl: -6.3, edgePercent: 10.8, predictedProb: 0.60, outcome: 0,
    timestamp: '2026-02-15T16:00:00Z',
  },
  {
    id: 'he-4', strategy: 'HIGH_EDGE', market: 'S&P 500 > 5500 by June',
    direction: 'YES', entryPrice: 0.58, size: 130,
    status: 'open', edgePercent: 11.4,
    timestamp: '2026-03-05T09:00:00Z',
  },

  // FADE_MARKET — 4 trades
  {
    id: 'fm-1', strategy: 'FADE_MARKET', market: 'Putin visits US in 2026',
    direction: 'NO', entryPrice: 0.15, exitPrice: 0.05, size: 300,
    status: 'closed', pnl: 30.0, edgePercent: 7.8, predictedProb: 0.08, outcome: 0,
    timestamp: '2026-02-02T12:00:00Z',
  },
  {
    id: 'fm-2', strategy: 'FADE_MARKET', market: 'US recession declared Q1',
    direction: 'NO', entryPrice: 0.40, exitPrice: 0.18, size: 150,
    status: 'closed', pnl: 33.0, edgePercent: 9.2, predictedProb: 0.20, outcome: 0,
    timestamp: '2026-02-08T15:00:00Z',
  },
  {
    id: 'fm-3', strategy: 'FADE_MARKET', market: 'Tesla stock > $500 EOY',
    direction: 'NO', entryPrice: 0.60, exitPrice: 0.75, size: 80,
    status: 'closed', pnl: -12.0, edgePercent: 6.5, predictedProb: 0.35, outcome: 1,
    timestamp: '2026-02-20T11:00:00Z',
  },
  {
    id: 'fm-4', strategy: 'FADE_MARKET', market: 'NFT market revival Q2 2026',
    direction: 'NO', entryPrice: 0.25, size: 200,
    status: 'open', edgePercent: 8.0,
    timestamp: '2026-03-08T10:00:00Z',
  },

  // MOMENTUM — 4 trades
  {
    id: 'mo-1', strategy: 'MOMENTUM', market: 'BTC > $95k this week',
    direction: 'YES', entryPrice: 0.55, exitPrice: 0.80, size: 100,
    status: 'closed', pnl: 25.0, edgePercent: 6.9, predictedProb: 0.72, outcome: 1,
    timestamp: '2026-02-04T09:30:00Z',
  },
  {
    id: 'mo-2', strategy: 'MOMENTUM', market: 'ETH dominance > 20% March',
    direction: 'YES', entryPrice: 0.48, exitPrice: 0.30, size: 120,
    status: 'closed', pnl: -21.6, edgePercent: 5.5, predictedProb: 0.55, outcome: 0,
    timestamp: '2026-02-12T14:00:00Z',
  },
  {
    id: 'mo-3', strategy: 'MOMENTUM', market: 'DOGE weekly 20%+ pump',
    direction: 'YES', entryPrice: 0.35, exitPrice: 0.60, size: 180,
    status: 'closed', pnl: 45.0, edgePercent: 7.2, predictedProb: 0.55, outcome: 1,
    timestamp: '2026-02-18T13:00:00Z',
  },
  {
    id: 'mo-4', strategy: 'MOMENTUM', market: 'SOL > $200 by EOW',
    direction: 'YES', entryPrice: 0.42, size: 90,
    status: 'open', edgePercent: 5.9,
    timestamp: '2026-03-09T10:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Determines whether mock mode is active.
 * Mock mode is enabled when the MOCK_DATA environment variable is set to "true".
 */
export function isMockMode(): boolean {
  return process.env['MOCK_DATA'] === 'true';
}

/**
 * Loads paper positions from disk or returns mock data.
 * Gracefully handles missing file.
 *
 * @param mock - When true, returns built-in mock positions
 * @returns Object containing positions array and source indicator
 */
export function loadPositions(mock: boolean): {
  positions: StrategyPosition[];
  source: 'file' | 'mock' | 'missing';
  note?: string;
} {
  if (mock) {
    return { positions: MOCK_POSITIONS, source: 'mock' };
  }

  const positionsPath = resolve(PROJECT_ROOT, 'data', 'paper-positions.json');

  if (!existsSync(positionsPath)) {
    return {
      positions: [],
      source: 'missing',
      note: 'data/paper-positions.json not found — run the paper tracker to generate position data.',
    };
  }

  try {
    const raw = readFileSync(positionsPath, 'utf-8');
    const parsed = JSON.parse(raw) as StrategyPosition[];
    return { positions: parsed, source: 'file' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      positions: [],
      source: 'missing',
      note: `Failed to parse data/paper-positions.json: ${message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Main comparison function
// ---------------------------------------------------------------------------

/**
 * Compares all agent strategies head-to-head.
 *
 * Reads positions from data/paper-positions.json (or mock data when MOCK_DATA=true),
 * groups by strategy tag, and computes per-strategy performance statistics.
 *
 * @param overrideMock - Optional: override env-based mock detection
 * @returns StrategyComparisonReport with per-strategy stats
 *
 * @example
 * ```ts
 * const report = await compareStrategies();
 * console.log(formatComparison(report));
 * ```
 */
export async function compareStrategies(overrideMock?: boolean): Promise<StrategyComparisonReport> {
  const mock = overrideMock !== undefined ? overrideMock : isMockMode();
  const { positions, source, note } = loadPositions(mock);

  // Group positions by strategy
  const byStrategy: Record<StrategyTag, StrategyPosition[]> = {
    PM_LONG: [],
    HIGH_EDGE: [],
    FADE_MARKET: [],
    MOMENTUM: [],
  };

  for (const position of positions) {
    if (position.strategy in byStrategy) {
      byStrategy[position.strategy].push(position);
    }
  }

  // Compute stats for each strategy
  const strategies: StrategyStats[] = ALL_STRATEGY_TAGS.map((tag) =>
    computeStrategyStats(tag, byStrategy[tag]),
  );

  const report: StrategyComparisonReport = {
    generatedAt: new Date().toISOString(),
    mode: mock ? 'mock' : 'live',
    source,
    strategies,
  };

  if (note) {
    report.note = note;
  }

  return report;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Formats a number as USD with sign */
function fmtUsd(n: number): string {
  const abs = Math.abs(n).toFixed(2);
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
}

/** Formats a percentage */
function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

/** Strategy display names for the report */
const STRATEGY_DISPLAY: Record<StrategyTag, string> = {
  PM_LONG: 'PM_LONG (agent-alpha-simple)',
  HIGH_EDGE: 'HIGH_EDGE (multi-strategy)',
  FADE_MARKET: 'FADE_MARKET (multi-strategy)',
  MOMENTUM: 'MOMENTUM (multi-strategy)',
};

// ---------------------------------------------------------------------------
// Report formatter
// ---------------------------------------------------------------------------

/**
 * Formats a StrategyComparisonReport as a human-readable markdown string.
 *
 * @param report - The comparison report to format
 * @returns Multi-line markdown string
 */
export function formatComparison(report: StrategyComparisonReport): string {
  const lines: string[] = [];

  // Header
  lines.push('# 📊 Strategy Comparison Report');
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt.slice(0, 19).replace('T', ' ')} UTC`);
  lines.push(`**Mode:** ${report.mode.toUpperCase()}`);
  lines.push(`**Source:** ${report.source}`);

  if (report.note) {
    lines.push('');
    lines.push(`> ⚠️ ${report.note}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary table header
  lines.push('## Strategy Performance Summary');
  lines.push('');
  lines.push(
    '| Strategy | Trades | Win Rate | Avg Edge | Realized P&L | Brier Score |',
  );
  lines.push(
    '|----------|--------|----------|----------|--------------|-------------|',
  );

  for (const s of report.strategies) {
    const name = STRATEGY_DISPLAY[s.strategy];
    const trades = s.tradeCount === 0 ? '—' : String(s.tradeCount);
    const winRate = s.tradeCount === 0 ? '—' : fmtPct(s.winRate);
    const edge = s.tradeCount === 0 ? '—' : fmtPct(s.avgEdgePercent, 2);
    const pnl = s.tradeCount === 0 ? '—' : fmtUsd(s.realizedPnl);
    const brier = s.brierScore !== null ? String(s.brierScore) : '—';
    lines.push(`| ${name} | ${trades} | ${winRate} | ${edge} | ${pnl} | ${brier} |`);
  }

  lines.push('');

  // Per-strategy detail sections
  for (const s of report.strategies) {
    lines.push(`---`);
    lines.push('');
    lines.push(`## ${s.strategy}`);
    lines.push(`_${STRATEGY_DISPLAY[s.strategy]}_`);
    lines.push('');

    if (s.tradeCount === 0) {
      lines.push('_No trades recorded for this strategy._');
      lines.push('');
      continue;
    }

    lines.push(`- **Trade Count:** ${s.tradeCount}`);
    lines.push(`- **Win Rate:** ${fmtPct(s.winRate)}`);
    lines.push(`- **Avg Edge:** ${fmtPct(s.avgEdgePercent, 2)}`);
    lines.push(`- **Realized P&L:** ${fmtUsd(s.realizedPnl)}`);
    lines.push(`- **Brier Score:** ${s.brierScore !== null ? s.brierScore : 'N/A (insufficient data)'}`);

    if (s.bestTrade) {
      const bt = s.bestTrade;
      const pnl = fmtUsd(effectivePnl(bt));
      lines.push(`- **Best Trade:** ${bt.market} (${bt.direction}) → ${pnl}`);
    }

    if (s.worstTrade) {
      const wt = s.worstTrade;
      const pnl = fmtUsd(effectivePnl(wt));
      lines.push(`- **Worst Trade:** ${wt.market} (${wt.direction}) → ${pnl}`);
    }

    lines.push('');
  }

  // Rankings
  const ranked = [...report.strategies]
    .filter((s) => s.tradeCount > 0)
    .sort((a, b) => b.realizedPnl - a.realizedPnl);

  if (ranked.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 🏆 Rankings by Realized P&L');
    lines.push('');
    ranked.forEach((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lines.push(`${medal} **${s.strategy}** — ${fmtUsd(s.realizedPnl)} (${fmtPct(s.winRate)} win rate)`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
