/**
 * Ensemble Performance Monitor
 *
 * Tracks the live orchestrator's ensemble decisions vs actual signal outcomes
 * over time, detects weight drift, and triggers a re-optimization flag when
 * performance degrades.
 *
 * States:
 *   HEALTHY  — Sharpe delta < 5%
 *   DRIFTING — 5–10% degradation
 *   STALE    — >10% degradation or no orchestrator decisions in 24h
 *
 * Output: data/ensemble-performance.json
 *
 * @module
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the project root (two dirs up from src/signals/) */
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single ensemble orchestration decision record */
export interface EnsembleDecision {
  /** ISO timestamp when the decision was made */
  timestamp: string;
  /** Market slug / question identifier */
  market: string;
  /** Direction recommended by the ensemble */
  direction: 'YES' | 'NO';
  /** Final ensemble probability (0–1) */
  probability: number;
  /** Weight configuration snapshot used at decision time */
  weights: Record<string, number>;
}

/** A resolved signal outcome record (written by signal-outcome-recorder) */
export interface SignalOutcome {
  /** ISO timestamp when the outcome was recorded */
  timestamp: string;
  /** Market slug matching an EnsembleDecision */
  market: string;
  /** Direction that was recommended */
  direction: 'YES' | 'NO';
  /** Whether the signal resolved correctly (true = win) */
  win: boolean;
  /** Return of the trade (used for Sharpe calculation) */
  returnValue: number;
}

/** Persistent snapshot stored in data/ensemble-performance.json */
export interface EnsemblePerformanceSnapshot {
  /** ISO timestamp of this snapshot */
  timestamp: string;
  /** Current performance state */
  state: 'HEALTHY' | 'DRIFTING' | 'STALE';
  /** Rolling 7-day Sharpe ratio with current weights */
  sharpeCurrent: number;
  /** Baseline Sharpe ratio (from when weights were last optimized) */
  sharpeBaseline: number;
  /** Percentage change from baseline (negative = degradation) */
  sharpeDeltaPct: number;
  /** Flag for ensemble-weight-optimizer to read */
  needsReoptimization: boolean;
  /** ISO timestamp of last weight optimization, or null if never */
  lastOptimizedAt: string | null;
  /** Number of ensemble decisions in the past 7 days */
  decisionCount7d: number;
  /** Win rate of ensemble decisions in past 7 days (0–100) */
  winRate7d: number;
}

/** Internal raw returns array for Sharpe computation */
interface ReturnsWindow {
  returns: number[];
  timestamps: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Thresholds for state transitions */
const THRESHOLD_DRIFTING = 5;  // >5% degradation → DRIFTING
const THRESHOLD_STALE = 10;    // >10% degradation → STALE

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

/**
 * Generates mock ensemble orchestration decisions for offline/test usage.
 *
 * @param count - Number of decisions to generate (default 20)
 * @param daysBack - How many days back to spread the decisions (default 7)
 */
export function generateMockDecisions(count = 20, daysBack = 7): EnsembleDecision[] {
  const now = Date.now();
  const decisions: EnsembleDecision[] = [];

  const markets = [
    'btc-above-100k-q2',
    'trump-wins-midterms',
    'fed-rate-cut-june',
    'eth-merge-successful',
    'sp500-bear-q1',
    'ai-agi-2026',
  ];

  for (let i = 0; i < count; i++) {
    const offsetMs = Math.random() * daysBack * 24 * 60 * 60 * 1000;
    const ts = new Date(now - offsetMs).toISOString();
    const market = markets[i % markets.length];

    decisions.push({
      timestamp: ts,
      market,
      direction: Math.random() > 0.5 ? 'YES' : 'NO',
      probability: 0.4 + Math.random() * 0.4,
      weights: {
        momentum: 0.25 + Math.random() * 0.1,
        bayesian: 0.25 + Math.random() * 0.1,
        sentiment: 0.25 + Math.random() * 0.1,
        volatility: 0.25 + Math.random() * 0.1,
      },
    });
  }

  return decisions;
}

/**
 * Generates mock signal outcomes aligned with decisions.
 *
 * @param decisions - Decisions to generate outcomes for
 * @param winRateTarget - Target win rate (0–1, default 0.55)
 */
export function generateMockOutcomes(
  decisions: EnsembleDecision[],
  winRateTarget = 0.55,
): SignalOutcome[] {
  return decisions.map((d) => {
    const win = Math.random() < winRateTarget;
    const returnValue = win ? 0.05 + Math.random() * 0.15 : -(0.03 + Math.random() * 0.1);

    return {
      timestamp: new Date(new Date(d.timestamp).getTime() + 3600_000).toISOString(),
      market: d.market,
      direction: d.direction,
      win,
      returnValue,
    };
  });
}

// ---------------------------------------------------------------------------
// Sharpe ratio computation
// ---------------------------------------------------------------------------

/**
 * Computes the annualised Sharpe ratio from a series of daily returns.
 * Returns 0 if fewer than 2 data points are available.
 *
 * @param returns - Array of trade returns
 * @param riskFreeRate - Annualised risk-free rate (default 0.04 = 4%)
 */
export function computeSharpeRatio(returns: number[], riskFreeRate = 0.04): number {
  if (returns.length < 2) return 0;

  const n = returns.length;
  const mean = returns.reduce((sum, r) => sum + r, 0) / n;

  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  // Guard against floating-point near-zero std dev (e.g. all identical returns)
  if (stdDev < 1e-9) return 0;

  // Annualise assuming ~252 trading days
  const dailyRfRate = riskFreeRate / 252;
  const excessReturn = mean - dailyRfRate;

  return (excessReturn / stdDev) * Math.sqrt(252);
}

/**
 * Computes Sharpe delta percentage between current and baseline.
 * Negative value indicates degradation.
 *
 * @param sharpeCurrent - Current Sharpe ratio
 * @param sharpeBaseline - Baseline Sharpe ratio
 */
export function computeSharpeDeltaPct(sharpeCurrent: number, sharpeBaseline: number): number {
  if (sharpeBaseline === 0) return 0;
  return ((sharpeCurrent - sharpeBaseline) / Math.abs(sharpeBaseline)) * 100;
}

/**
 * Determines the performance state based on Sharpe delta and staleness.
 *
 * @param sharpeDeltaPct - Sharpe delta percentage (negative = degradation)
 * @param isStaleByTime - Whether the orchestrator has been silent for 24h
 */
export function determineState(
  sharpeDeltaPct: number,
  isStaleByTime: boolean,
): 'HEALTHY' | 'DRIFTING' | 'STALE' {
  if (isStaleByTime) return 'STALE';

  const degradation = -sharpeDeltaPct; // positive = degradation

  if (degradation > THRESHOLD_STALE) return 'STALE';
  if (degradation > THRESHOLD_DRIFTING) return 'DRIFTING';
  return 'HEALTHY';
}

// ---------------------------------------------------------------------------
// Data loading helpers
// ---------------------------------------------------------------------------

/**
 * Loads ensemble orchestration decisions from disk.
 * Falls back to generated mock data if the file is missing.
 *
 * @param filePath - Path to ensemble-orchestration.json
 */
export function loadDecisions(filePath: string): { decisions: EnsembleDecision[]; isMock: boolean } {
  if (!existsSync(filePath)) {
    return { decisions: generateMockDecisions(), isMock: true };
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as EnsembleDecision[];
    return { decisions: Array.isArray(parsed) ? parsed : [], isMock: false };
  } catch {
    return { decisions: generateMockDecisions(), isMock: true };
  }
}

/**
 * Loads signal outcomes from disk.
 * Falls back to empty array if the file is missing.
 *
 * @param filePath - Path to signal-outcomes.json
 */
export function loadOutcomes(filePath: string): SignalOutcome[] {
  if (!existsSync(filePath)) return [];

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as SignalOutcome[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Loads an existing performance snapshot from disk.
 * Returns null if not found or invalid.
 *
 * @param filePath - Path to ensemble-performance.json
 */
export function loadSnapshot(filePath: string): EnsemblePerformanceSnapshot | null {
  if (!existsSync(filePath)) return null;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as EnsemblePerformanceSnapshot;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

/**
 * Filters decisions to those within a rolling N-day window.
 *
 * @param decisions - Full decision list
 * @param windowMs - Window in milliseconds
 * @param nowMs - Reference "now" timestamp (default: Date.now())
 */
export function filterByWindow(
  decisions: EnsembleDecision[],
  windowMs: number,
  nowMs = Date.now(),
): EnsembleDecision[] {
  return decisions.filter(
    (d) => nowMs - new Date(d.timestamp).getTime() <= windowMs,
  );
}

/**
 * Cross-references decisions with outcomes to build a returns window.
 *
 * @param decisions - Filtered ensemble decisions
 * @param outcomes - All signal outcomes
 */
export function buildReturnsWindow(
  decisions: EnsembleDecision[],
  outcomes: SignalOutcome[],
): ReturnsWindow {
  const outcomeMap = new Map<string, SignalOutcome>();
  for (const o of outcomes) {
    outcomeMap.set(`${o.market}:${o.direction}`, o);
  }

  const returns: number[] = [];
  const timestamps: string[] = [];

  for (const d of decisions) {
    const key = `${d.market}:${d.direction}`;
    const outcome = outcomeMap.get(key);
    if (outcome) {
      returns.push(outcome.returnValue);
      timestamps.push(d.timestamp);
    }
  }

  return { returns, timestamps };
}

/**
 * Computes the win rate from decisions cross-referenced with outcomes.
 *
 * @param decisions - Filtered ensemble decisions
 * @param outcomes - All signal outcomes
 */
export function computeWinRate(
  decisions: EnsembleDecision[],
  outcomes: SignalOutcome[],
): number {
  const outcomeMap = new Map<string, SignalOutcome>();
  for (const o of outcomes) {
    outcomeMap.set(`${o.market}:${o.direction}`, o);
  }

  let wins = 0;
  let matched = 0;

  for (const d of decisions) {
    const key = `${d.market}:${d.direction}`;
    const outcome = outcomeMap.get(key);
    if (outcome) {
      matched++;
      if (outcome.win) wins++;
    }
  }

  if (matched === 0) return 0;
  return (wins / matched) * 100;
}

/**
 * Checks if the orchestrator has been silent (no decisions) for >24h.
 *
 * @param decisions - All decisions (not filtered)
 * @param nowMs - Reference "now" timestamp
 */
export function isStaleByTime(decisions: EnsembleDecision[], nowMs = Date.now()): boolean {
  if (decisions.length === 0) return true;

  const latest = decisions.reduce((max, d) => {
    const ts = new Date(d.timestamp).getTime();
    return ts > max ? ts : max;
  }, 0);

  return nowMs - latest > TWENTY_FOUR_HOURS_MS;
}

// ---------------------------------------------------------------------------
// EnsemblePerformanceMonitor class
// ---------------------------------------------------------------------------

/** Configuration options for EnsemblePerformanceMonitor */
export interface MonitorConfig {
  /** Path to ensemble-orchestration.json */
  orchestrationPath?: string;
  /** Path to signal-outcomes.json */
  outcomesPath?: string;
  /** Path to ensemble-performance.json (output) */
  performancePath?: string;
  /** Override "now" for testing */
  nowMs?: number;
}

/**
 * Monitors ensemble performance, detects drift, and triggers re-optimization.
 */
export class EnsemblePerformanceMonitor {
  private readonly orchestrationPath: string;
  private readonly outcomesPath: string;
  private readonly performancePath: string;
  private nowMs: number;

  constructor(config: MonitorConfig = {}) {
    this.orchestrationPath = config.orchestrationPath
      ?? resolve(PROJECT_ROOT, 'data', 'ensemble-orchestration.json');
    this.outcomesPath = config.outcomesPath
      ?? resolve(PROJECT_ROOT, 'data', 'signal-outcomes.json');
    this.performancePath = config.performancePath
      ?? resolve(PROJECT_ROOT, 'data', 'ensemble-performance.json');
    this.nowMs = config.nowMs ?? Date.now();
  }

  /**
   * Updates the "now" reference time (used in tests to simulate time passage).
   */
  setNow(nowMs: number): void {
    this.nowMs = nowMs;
  }

  /**
   * Runs the full monitoring cycle:
   * 1. Load decisions and outcomes
   * 2. Compute 7-day metrics
   * 3. Determine state
   * 4. Persist snapshot
   *
   * @returns The computed performance snapshot
   */
  async run(): Promise<EnsemblePerformanceSnapshot> {
    const { decisions } = loadDecisions(this.orchestrationPath);
    const outcomes = loadOutcomes(this.outcomesPath);

    // Load previous snapshot to get baseline Sharpe + lastOptimizedAt
    const previous = loadSnapshot(this.performancePath);
    const lastOptimizedAt = previous?.lastOptimizedAt ?? null;

    // Filter to 7-day window
    const recent = filterByWindow(decisions, SEVEN_DAYS_MS, this.nowMs);

    // Build returns and compute current Sharpe
    const returnsWindow = buildReturnsWindow(recent, outcomes);
    const sharpeCurrent = computeSharpeRatio(returnsWindow.returns);

    // Baseline: use previous snapshot's current Sharpe as the new baseline
    // if we just optimized; otherwise keep the stored baseline.
    // If no previous snapshot, treat current as baseline.
    const sharpeBaseline = previous?.sharpeBaseline ?? sharpeCurrent;

    const sharpeDeltaPct = computeSharpeDeltaPct(sharpeCurrent, sharpeBaseline);

    // Staleness check
    const staleByTime = isStaleByTime(decisions, this.nowMs);

    // State determination
    const state = determineState(sharpeDeltaPct, staleByTime);

    // Win rate
    const winRate7d = computeWinRate(recent, outcomes);

    const snapshot: EnsemblePerformanceSnapshot = {
      timestamp: new Date(this.nowMs).toISOString(),
      state,
      sharpeCurrent,
      sharpeBaseline,
      sharpeDeltaPct,
      needsReoptimization: state === 'STALE',
      lastOptimizedAt,
      decisionCount7d: recent.length,
      winRate7d,
    };

    this.persistSnapshot(snapshot);

    return snapshot;
  }

  /**
   * Writes the snapshot to disk.
   *
   * @param snapshot - The snapshot to persist
   */
  persistSnapshot(snapshot: EnsemblePerformanceSnapshot): void {
    const dir = resolve(this.performancePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.performancePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /**
   * Marks the last optimization timestamp in the current snapshot.
   * Called by ensemble-weight-optimizer after completing a run.
   *
   * @param isoTimestamp - ISO timestamp of the optimization (default: now)
   */
  markOptimized(isoTimestamp?: string): void {
    const existing = loadSnapshot(this.performancePath);
    const ts = isoTimestamp ?? new Date(this.nowMs).toISOString();

    if (!existing) return;

    const updated: EnsemblePerformanceSnapshot = {
      ...existing,
      lastOptimizedAt: ts,
      needsReoptimization: false,
      // Reset baseline to current after successful optimization
      sharpeBaseline: existing.sharpeCurrent,
      sharpeDeltaPct: 0,
      state: 'HEALTHY',
    };

    this.persistSnapshot(updated);
  }

  /**
   * Returns the current snapshot from disk, or null if not yet computed.
   */
  getCurrentSnapshot(): EnsemblePerformanceSnapshot | null {
    return loadSnapshot(this.performancePath);
  }

  /**
   * Formats Section 21 of the daily digest as a markdown block.
   *
   * @returns Multi-line markdown string for the daily digest
   */
  formatDigestSection(): string {
    const snapshot = this.getCurrentSnapshot();

    if (!snapshot) {
      return [
        '+--------------------------------------------------------------+',
        '| 21. ENSEMBLE PERFORMANCE MONITOR                             |',
        '+--------------------------------------------------------------+',
        '| Status                        N/A — not yet computed         |',
        '+--------------------------------------------------------------+',
      ].join('\n');
    }

    const stateEmoji =
      snapshot.state === 'HEALTHY' ? '✓ HEALTHY' :
      snapshot.state === 'DRIFTING' ? '⚠ DRIFTING' :
      '✗ STALE';

    const deltaPctStr = snapshot.sharpeDeltaPct >= 0
      ? `+${snapshot.sharpeDeltaPct.toFixed(1)}%`
      : `${snapshot.sharpeDeltaPct.toFixed(1)}%`;

    const lastOpt = snapshot.lastOptimizedAt
      ? snapshot.lastOptimizedAt.slice(0, 19).replace('T', ' ')
      : 'Never';

    const rows: [string, string][] = [
      ['State', stateEmoji],
      ['Sharpe (current)', snapshot.sharpeCurrent.toFixed(3)],
      ['Sharpe (baseline)', snapshot.sharpeBaseline.toFixed(3)],
      ['Sharpe Delta', deltaPctStr],
      ['Needs Re-optimization', snapshot.needsReoptimization ? 'YES ⚠' : 'no'],
      ['Last Optimized', lastOpt],
      ['Decisions (7d)', String(snapshot.decisionCount7d)],
      ['Win Rate (7d)', `${snapshot.winRate7d.toFixed(1)}%`],
      ['Snapshot At', snapshot.timestamp.slice(0, 19).replace('T', ' ')],
    ];

    const width = 62;
    const inner = width - 2;
    const divider = `+${'-'.repeat(inner)}+`;
    const titlePadded = ` 21. ENSEMBLE PERFORMANCE MONITOR `.padEnd(inner, ' ');

    const lines: string[] = [
      divider,
      `|${titlePadded}|`,
      divider,
    ];

    for (const [label, value] of rows) {
      const labelCol = label.padEnd(30);
      const valueWidth = Math.max(1, inner - 33);
      const valueCol = value.padStart(valueWidth);
      lines.push(`| ${labelCol} ${valueCol} |`);
    }

    lines.push(divider);
    return lines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Convenience factory / singleton
// ---------------------------------------------------------------------------

/** Default monitor instance using project-root data paths */
export const defaultMonitor = new EnsemblePerformanceMonitor();

/**
 * Runs the monitor and returns the snapshot.
 * Convenience wrapper for scripted / cron usage.
 */
export async function runEnsemblePerformanceMonitor(
  config?: MonitorConfig,
): Promise<EnsemblePerformanceSnapshot> {
  const monitor = new EnsemblePerformanceMonitor(config);
  return monitor.run();
}
