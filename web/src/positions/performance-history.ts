/**
 * Performance History — provides daily P&L and Brier score trend data.
 *
 * Reads from data/performance-history.json when available.
 * Falls back to synthetic mock data (zero-API safe) when the file is absent.
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

/** A single day's performance snapshot */
export interface DailySnapshot {
  /** ISO date string, e.g. "2026-03-05" */
  date: string;
  /** Net realized P&L for the day in USD */
  pnl: number;
  /** Brier score for the day (0-1, lower is better), or null if no scored trades */
  brierScore: number | null;
  /** Number of trades closed that day */
  tradeCount: number;
}

/** 7-day performance history result */
export interface PerformanceHistory {
  /** Ordered oldest → newest, max 7 entries */
  days: DailySnapshot[];
  /** Sum of P&L over all days */
  totalPnl: number;
  /** Average Brier score across days that have one, or null */
  avgBrierScore: number | null;
  source: 'file' | 'mock' | 'missing';
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/**
 * Generates 7 days of synthetic performance data relative to today.
 * Each call creates fresh relative timestamps so tests always see "recent" data.
 */
export function buildMockHistory(): DailySnapshot[] {
  const today = new Date();
  const snapshots: DailySnapshot[] = [];

  const mockValues: Array<{ pnl: number; brier: number | null; trades: number }> = [
    { pnl: 34.0,   brier: 0.18, trades: 3 },
    { pnl: -20.0,  brier: 0.22, trades: 2 },
    { pnl: 27.6,   brier: 0.15, trades: 4 },
    { pnl: 22.5,   brier: 0.17, trades: 3 },
    { pnl: 66.0,   brier: 0.12, trades: 5 },
    { pnl: 45.0,   brier: 0.14, trades: 3 },
    { pnl: -8.0,   brier: null, trades: 1 },
  ];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const v = mockValues[6 - i];
    snapshots.push({
      date: dateStr,
      pnl: v.pnl,
      brierScore: v.brier,
      tradeCount: v.trades,
    });
  }

  return snapshots;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Loads the last 7 days of performance history.
 * Never throws — returns source:'missing' on any failure.
 *
 * @param mock - When true, returns synthetic mock history (no file I/O)
 */
export function loadPerformanceHistory(mock: boolean): PerformanceHistory {
  let days: DailySnapshot[];
  let source: PerformanceHistory['source'];

  if (mock) {
    days = buildMockHistory();
    source = 'mock';
  } else {
    const histPath = resolve(PROJECT_ROOT, 'data', 'performance-history.json');

    if (!existsSync(histPath)) {
      return {
        days: [],
        totalPnl: 0,
        avgBrierScore: null,
        source: 'missing',
      };
    }

    try {
      const raw = JSON.parse(readFileSync(histPath, 'utf-8')) as DailySnapshot[];

      // Sort by date and take the last 7 entries
      days = raw
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);
      source = 'file';
    } catch {
      return {
        days: [],
        totalPnl: 0,
        avgBrierScore: null,
        source: 'missing',
      };
    }
  }

  const totalPnl = Math.round(days.reduce((sum, d) => sum + d.pnl, 0) * 100) / 100;

  const brierDays = days.filter((d) => d.brierScore !== null);
  const avgBrierScore =
    brierDays.length > 0
      ? Math.round(
          (brierDays.reduce((sum, d) => sum + (d.brierScore as number), 0) / brierDays.length) *
            10000,
        ) / 10000
      : null;

  return { days, totalPnl, avgBrierScore, source };
}
