/**
 * Paper Tracker — loads paper positions and computes aggregate metrics.
 *
 * Used by the weekly report to surface total trades, win rate, and realized P&L.
 * Falls back gracefully when the data file is absent or corrupt.
 *
 * @module
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the project root (two dirs up from src/positions/) */
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single tracked paper-trading position */
export interface TrackedPosition {
  id: string;
  market: string;
  direction: 'YES' | 'NO';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  status: 'open' | 'closed';
  pnl?: number;
  strategy?: string;
  predictedProb?: number;
  outcome?: 0 | 1;
  edgePercent?: number;
  timestamp: string;
}

/** Aggregated tracker metrics */
export interface TrackerSummary {
  totalTrades: number;
  winRate: number;
  realizedPnl: number;
  openPositions: number;
  source: 'file' | 'mock' | 'missing';
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/** Mock positions spanning the last 7 days for zero-API testing */
export const MOCK_TRACKER_POSITIONS: TrackedPosition[] = [
  {
    id: 't1',
    market: 'BTC > $100k by EOY',
    direction: 'YES',
    entryPrice: 0.38,
    exitPrice: 0.72,
    size: 100,
    status: 'closed',
    pnl: 34.0,
    strategy: 'HIGH_EDGE',
    predictedProb: 0.65,
    outcome: 1,
    timestamp: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  },
  {
    id: 't2',
    market: 'ETH > $5k Q2',
    direction: 'YES',
    entryPrice: 0.55,
    exitPrice: 0.30,
    size: 80,
    status: 'closed',
    pnl: -20.0,
    strategy: 'PM_LONG',
    predictedProb: 0.60,
    outcome: 0,
    timestamp: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    id: 't3',
    market: 'Fed rate cut March',
    direction: 'YES',
    entryPrice: 0.62,
    exitPrice: 0.85,
    size: 120,
    status: 'closed',
    pnl: 27.6,
    strategy: 'MOMENTUM',
    predictedProb: 0.75,
    outcome: 1,
    timestamp: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  },
  {
    id: 't4',
    market: 'US GDP > 2.5% Q1',
    direction: 'YES',
    entryPrice: 0.50,
    exitPrice: 0.65,
    size: 150,
    status: 'closed',
    pnl: 22.5,
    strategy: 'HIGH_EDGE',
    predictedProb: 0.60,
    outcome: 1,
    timestamp: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: 't5',
    market: 'DOGE > $1 by Q2',
    direction: 'YES',
    entryPrice: 0.22,
    exitPrice: 0.55,
    size: 200,
    status: 'closed',
    pnl: 66.0,
    strategy: 'FADE_MARKET',
    predictedProb: 0.55,
    outcome: 1,
    timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: 't6',
    market: 'AI regulation bill',
    direction: 'NO',
    entryPrice: 0.70,
    exitPrice: 0.25,
    size: 100,
    status: 'closed',
    pnl: 45.0,
    strategy: 'HIGH_EDGE',
    predictedProb: 0.25,
    outcome: 0,
    timestamp: new Date(Date.now() - 1 * 86_400_000).toISOString(),
  },
  {
    id: 't7',
    market: 'Trump crypto EO',
    direction: 'YES',
    entryPrice: 0.45,
    size: 90,
    status: 'open',
    strategy: 'MOMENTUM',
    timestamp: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes effective P&L for a position.
 * Prefers stored pnl field; derives from entry/exit prices otherwise.
 */
function effectivePnl(p: TrackedPosition): number {
  if (p.pnl !== undefined) return p.pnl;
  if (p.exitPrice !== undefined) {
    const raw = (p.exitPrice - p.entryPrice) * p.size;
    return p.direction === 'YES' ? raw : -raw;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Computes aggregate tracker metrics from a positions array.
 *
 * @param positions - Array of tracked positions
 * @returns Metrics (without source tag)
 */
export function computeTrackerSummary(
  positions: TrackedPosition[],
): Pick<TrackerSummary, 'totalTrades' | 'winRate' | 'realizedPnl' | 'openPositions'> {
  const closed = positions.filter((p) => p.status === 'closed');
  const open = positions.filter((p) => p.status === 'open');
  const wins = closed.filter((p) => effectivePnl(p) > 0);

  const winRate =
    closed.length > 0 ? Math.round((wins.length / closed.length) * 1000) / 10 : 0;
  const realizedPnl =
    Math.round(closed.reduce((sum, p) => sum + effectivePnl(p), 0) * 100) / 100;

  return {
    totalTrades: positions.length,
    winRate,
    realizedPnl,
    openPositions: open.length,
  };
}

/**
 * Loads positions from disk (or mock) and returns a TrackerSummary.
 * Never throws — returns source:'missing' on any failure.
 *
 * @param mock - When true, uses built-in mock positions
 */
export function loadTrackerSummary(mock: boolean): TrackerSummary {
  if (mock) {
    return { ...computeTrackerSummary(MOCK_TRACKER_POSITIONS), source: 'mock' };
  }

  const positionsPath = resolve(PROJECT_ROOT, 'data', 'paper-positions.json');

  if (!existsSync(positionsPath)) {
    return { totalTrades: 0, winRate: 0, realizedPnl: 0, openPositions: 0, source: 'missing' };
  }

  try {
    const positions = JSON.parse(readFileSync(positionsPath, 'utf-8')) as TrackedPosition[];
    return { ...computeTrackerSummary(positions), source: 'file' };
  } catch {
    return { totalTrades: 0, winRate: 0, realizedPnl: 0, openPositions: 0, source: 'missing' };
  }
}
