/**
 * Daily Performance Digest CLI
 *
 * Generates a formatted ASCII performance report for the Polymarket Scanner.
 *
 * Usage:
 *   npm run digest           # Live mode (reads real data sources)
 *   npm run digest:mock      # Mock mode (fake data, no live API calls)
 *
 * Sections:
 *   1. Arb Scanner Summary
 *   2. Position Tracker Summary
 *   3. Research Loop Status
 *   4. Stability Status
 *   5. Top Signal Today
 *   6. Strategy Performance
 *
 * @module
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compareStrategies } from './strategy-comparison.ts';
import { EnsemblePerformanceMonitor } from '../signals/ensemble-performance-monitor.ts';

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

/** A single arbitrage opportunity between two market sides */
export interface ArbOpportunity {
  pair: string;
  spreadPercent: number;
  expectedProfit: number;
}

/** Summary from the arb scanner pass */
export interface ArbScanResult {
  opportunities: ArbOpportunity[];
  scannedAt: string;
  source: 'live' | 'mock';
}

/** A paper trading position */
export interface PaperPosition {
  id: string;
  market: string;
  direction: 'YES' | 'NO';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  status: 'open' | 'closed';
  pnl?: number;
  timestamp: string;
}

/** Aggregated position tracker metrics */
export interface PositionSummary {
  totalTrades: number;
  winRate: number;
  realizedPnl: number;
  openPositions: number;
  source: 'file' | 'mock' | 'missing';
}

/** Research loop current state */
export interface ResearchStatus {
  brierScore: number | null;
  bestStrategy: string | null;
  source: 'file' | 'mock' | 'missing';
}

/** Stability monitor result */
export interface StabilityStatus {
  status: 'healthy' | 'degraded' | 'down';
  failingChecks: string[];
  source: 'live' | 'mock';
}

/** Highest-EV signal seen today by agent-alpha */
export interface TopSignal {
  market: string;
  evPercent: number;
  strategy: string;
  direction: 'YES' | 'NO';
  source: 'live' | 'mock' | 'none';
}

/** A single strategy entry in the performance summary */
export interface StrategyEntry {
  strategy: string;
  winRate: number;
  realizedPnl: number;
}

/** Aggregated strategy performance for section 6 */
export interface StrategyPerformanceSummary {
  /** Top strategies sorted by realized P&L (up to 3) */
  topStrategies: StrategyEntry[];
  source: 'file' | 'mock' | 'missing';
}

/** Full digest report payload */
export interface DigestReport {
  generatedAt: string;
  mode: 'live' | 'mock';
  arb: ArbScanResult;
  positions: PositionSummary;
  research: ResearchStatus;
  stability: StabilityStatus;
  topSignal: TopSignal;
  strategyPerformance: StrategyPerformanceSummary;
}

// ---------------------------------------------------------------------------
// ASCII Table renderer
// ---------------------------------------------------------------------------

/**
 * Renders a simple ASCII table from an array of [label, value] rows.
 *
 * @param title - Section heading
 * @param rows  - Array of [label, value] pairs
 * @param width - Total table width (default 62)
 * @returns Formatted multi-line string
 */
export function renderTable(
  title: string,
  rows: [string, string][],
  width = 62,
): string {
  const inner = width - 2; // width minus the two border chars
  const divider = `+${'-'.repeat(inner)}+`;
  const titlePadded = ` ${title} `.padEnd(inner, ' ');

  const lines: string[] = [
    divider,
    `|${titlePadded}|`,
    divider,
  ];

  for (const [label, value] of rows) {
    const labelCol = label.padEnd(30);
    // inner = width - 2; line = "| " + label(30) + " " + value + " |"
    // = 1+1+30+1+value+1+1 = 35 + value => value width = inner - 33
    const valueWidth = Math.max(1, inner - 33);
    const valueCol = value.padStart(valueWidth);
    lines.push(`| ${labelCol} ${valueCol} |`);
  }

  lines.push(divider);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Section 1 – Arb Scanner
// ---------------------------------------------------------------------------

/** Mock arb opportunities for --mock mode */
const MOCK_ARB: ArbOpportunity[] = [
  { pair: 'Trump wins 2026 YES / Kalshi NO', spreadPercent: 4.2, expectedProfit: 42.0 },
  { pair: 'BTC > $100k by EOY YES / NO',     spreadPercent: 3.1, expectedProfit: 31.0 },
  { pair: 'Fed rate cut Q2 YES / NO',         spreadPercent: 2.8, expectedProfit: 28.0 },
];

/**
 * Runs a single arb scan pass.
 * In mock mode, returns hard-coded opportunities immediately.
 * In live mode, attempts to import and call the real scanner; falls back
 * gracefully on any error.
 *
 * @param mock - When true, returns fake data
 */
export async function getArbScanSummary(mock: boolean): Promise<ArbScanResult> {
  if (mock) {
    return {
      opportunities: MOCK_ARB.slice(0, 3),
      scannedAt: new Date().toISOString(),
      source: 'mock',
    };
  }

  try {
    // Attempt to dynamically import a real arb scanner if it exists.
    // The scanner is expected to export runArbScan(): Promise<ArbOpportunity[]>
    const scannerPath = resolve(PROJECT_ROOT, 'src', 'agents', 'arb-scanner.ts');
    if (!existsSync(scannerPath)) {
      // No scanner built yet — return empty with mock fallback label
      return {
        opportunities: [],
        scannedAt: new Date().toISOString(),
        source: 'live',
      };
    }

    // Dynamic import (ESM compatible)
    const mod = await import(scannerPath) as { runArbScan?: () => Promise<ArbOpportunity[]> };
    const opportunities = (await mod.runArbScan?.()) ?? [];

    return {
      opportunities: opportunities.slice(0, 3),
      scannedAt: new Date().toISOString(),
      source: 'live',
    };
  } catch {
    return {
      opportunities: [],
      scannedAt: new Date().toISOString(),
      source: 'live',
    };
  }
}

// ---------------------------------------------------------------------------
// Section 2 – Position Tracker
// ---------------------------------------------------------------------------

/**
 * Calculates position metrics from an array of paper positions.
 *
 * @param positions - Array of PaperPosition records
 */
/** Computes effective P&L for a position, using stored pnl or deriving from entry/exit. */
function effectivePnl(p: PaperPosition): number {
  if (p.pnl !== undefined) return p.pnl;
  if (p.exitPrice !== undefined) {
    const raw = (p.exitPrice - p.entryPrice) * p.size;
    return p.direction === 'YES' ? raw : -raw;
  }
  return 0;
}

export function calcPositionMetrics(
  positions: PaperPosition[],
): Pick<PositionSummary, 'totalTrades' | 'winRate' | 'realizedPnl' | 'openPositions'> {
  const closed = positions.filter((p) => p.status === 'closed');
  const open   = positions.filter((p) => p.status === 'open');

  const wins = closed.filter((p) => effectivePnl(p) > 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

  const realizedPnl = closed.reduce((sum, p) => sum + effectivePnl(p), 0);

  return {
    totalTrades: positions.length,
    winRate: Math.round(winRate * 10) / 10,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    openPositions: open.length,
  };
}

/** Mock positions for --mock mode */
const MOCK_POSITIONS: PaperPosition[] = [
  { id: 'p1', market: 'BTC > $100k',  direction: 'YES', entryPrice: 0.38, exitPrice: 0.65, size: 100, status: 'closed', pnl: 27.0,  timestamp: '2026-03-01T10:00:00Z' },
  { id: 'p2', market: 'ETH fork',     direction: 'NO',  entryPrice: 0.55, exitPrice: 0.20, size: 50,  status: 'closed', pnl: 17.5,  timestamp: '2026-03-02T11:00:00Z' },
  { id: 'p3', market: 'Fed cut Q2',   direction: 'YES', entryPrice: 0.72, exitPrice: 0.40, size: 80,  status: 'closed', pnl: -25.6, timestamp: '2026-03-03T12:00:00Z' },
  { id: 'p4', market: 'Trump 2026',   direction: 'YES', entryPrice: 0.61, size: 120,       status: 'open',                         timestamp: '2026-03-09T09:00:00Z' },
  { id: 'p5', market: 'BTC halving',  direction: 'NO',  entryPrice: 0.44, size: 60,        status: 'open',                         timestamp: '2026-03-10T08:00:00Z' },
];

/**
 * Reads paper-positions.json and returns aggregated position metrics.
 *
 * @param mock - When true, returns fake data
 */
export function getPositionSummary(mock: boolean): PositionSummary {
  if (mock) {
    const metrics = calcPositionMetrics(MOCK_POSITIONS);
    return { ...metrics, source: 'mock' };
  }

  const positionsPath = resolve(PROJECT_ROOT, 'data', 'paper-positions.json');

  if (!existsSync(positionsPath)) {
    return {
      totalTrades: 0,
      winRate: 0,
      realizedPnl: 0,
      openPositions: 0,
      source: 'missing',
    };
  }

  try {
    const raw = readFileSync(positionsPath, 'utf-8');
    const positions = JSON.parse(raw) as PaperPosition[];
    const metrics = calcPositionMetrics(positions);
    return { ...metrics, source: 'file' };
  } catch {
    return {
      totalTrades: 0,
      winRate: 0,
      realizedPnl: 0,
      openPositions: 0,
      source: 'missing',
    };
  }
}

// ---------------------------------------------------------------------------
// Section 3 – Research Loop Status
// ---------------------------------------------------------------------------

/**
 * Parses research/program.md looking for:
 *   - "Brier score: 0.123" (or "brier_score: 0.123")
 *   - "Strategy version: v4" (or "best_strategy: v4")
 *
 * @param content - Markdown file content
 */
export function parseResearchMd(content: string): { brierScore: number | null; bestStrategy: string | null } {
  const brierMatch = content.match(/brier[_ ]score[:\s]+([0-9.]+)/i);
  const stratMatch = content.match(/(?:best[_ ]strategy|strategy[_ ]version)[:\s]+(\S+)/i);

  return {
    brierScore: brierMatch ? parseFloat(brierMatch[1]) : null,
    bestStrategy: stratMatch ? stratMatch[1] : null,
  };
}

/**
 * Reads research/program.md and returns current Brier score + strategy version.
 *
 * @param mock - When true, returns fake data
 */
export function getResearchStatus(mock: boolean): ResearchStatus {
  if (mock) {
    return {
      brierScore: 0.182,
      bestStrategy: 'v4-bayesian-momentum',
      source: 'mock',
    };
  }

  const programPath = resolve(PROJECT_ROOT, 'research', 'program.md');

  if (!existsSync(programPath)) {
    return { brierScore: null, bestStrategy: null, source: 'missing' };
  }

  try {
    const content = readFileSync(programPath, 'utf-8');
    const parsed = parseResearchMd(content);
    return { ...parsed, source: 'file' };
  } catch {
    return { brierScore: null, bestStrategy: null, source: 'missing' };
  }
}

// ---------------------------------------------------------------------------
// Section 4 – Stability Status
// ---------------------------------------------------------------------------

/** Checks performed in the stability monitor */
const STABILITY_CHECKS = [
  'polymarket-api',
  'telegram-bot',
  'data-directory',
  'agent-alpha',
] as const;

type StabilityCheck = typeof STABILITY_CHECKS[number];

/**
 * Runs basic stability checks against the project environment.
 * These are lightweight file/env checks — not live API calls.
 *
 * @param mock - When true, returns healthy mock status
 */
export function getStabilityStatus(mock: boolean): StabilityStatus {
  if (mock) {
    return {
      status: 'healthy',
      failingChecks: [],
      source: 'mock',
    };
  }

  const failingChecks: string[] = [];

  const checkMap: Record<StabilityCheck, () => boolean> = {
    'polymarket-api': () => true, // can't verify without live call
    'telegram-bot': () => {
      return !!(process.env['BOT_TOKEN'] && process.env['SIGNALS_CHANNEL_ID']);
    },
    'data-directory': () => {
      return existsSync(resolve(PROJECT_ROOT, 'data'));
    },
    'agent-alpha': () => {
      return existsSync(resolve(PROJECT_ROOT, 'src', 'agents', 'agent-alpha-multi-strategy.ts'));
    },
  };

  for (const [check, fn] of Object.entries(checkMap) as [StabilityCheck, () => boolean][]) {
    try {
      if (!fn()) failingChecks.push(check);
    } catch {
      failingChecks.push(check);
    }
  }

  let status: StabilityStatus['status'];
  if (failingChecks.length === 0) {
    status = 'healthy';
  } else if (failingChecks.length <= 2) {
    status = 'degraded';
  } else {
    status = 'down';
  }

  return { status, failingChecks, source: 'live' };
}

// ---------------------------------------------------------------------------
// Section 5 – Top Signal Today
// ---------------------------------------------------------------------------

/** State file written by agent-alpha when it runs */
const ALPHA_STATE_FILE = resolve(PROJECT_ROOT, 'data', 'agent-alpha-state.json');

interface AlphaState {
  lastRun: string;
  topSignal?: {
    market: string;
    evPercent: number;
    strategy: string;
    direction: 'YES' | 'NO';
  };
}

/**
 * Surfaces the highest-EV signal seen today by agent-alpha.
 * Reads from data/agent-alpha-state.json if it exists.
 *
 * @param mock - When true, returns fake signal
 */
export function getTopSignalToday(mock: boolean): TopSignal {
  if (mock) {
    return {
      market: 'US GDP > 3% Q1 2026',
      evPercent: 12.4,
      strategy: 'ev-kelly',
      direction: 'YES',
      source: 'mock',
    };
  }

  if (!existsSync(ALPHA_STATE_FILE)) {
    return {
      market: 'N/A',
      evPercent: 0,
      strategy: 'N/A',
      direction: 'YES',
      source: 'none',
    };
  }

  try {
    const raw = readFileSync(ALPHA_STATE_FILE, 'utf-8');
    const state = JSON.parse(raw) as AlphaState;

    if (!state.topSignal) {
      return { market: 'N/A', evPercent: 0, strategy: 'N/A', direction: 'YES', source: 'none' };
    }

    return { ...state.topSignal, source: 'live' };
  } catch {
    return { market: 'N/A', evPercent: 0, strategy: 'N/A', direction: 'YES', source: 'none' };
  }
}

// ---------------------------------------------------------------------------
// Section 6 – Strategy Performance
// ---------------------------------------------------------------------------

/**
 * Fetches and summarises strategy performance for the digest.
 *
 * Calls compareStrategies() and returns the top 3 strategies by realized P&L.
 * Degrades gracefully: if the call fails or returns no resolved positions,
 * the section renders "N/A — no resolved positions yet".
 *
 * @param mock - When true, compareStrategies uses built-in mock positions
 * @returns StrategyPerformanceSummary with top strategies and source tag
 */
export async function getStrategyPerformance(mock: boolean): Promise<StrategyPerformanceSummary> {
  try {
    const report = await compareStrategies(mock);

    const active = report.strategies.filter((s) => s.tradeCount > 0);

    if (active.length === 0) {
      return { topStrategies: [], source: 'missing' };
    }

    const topStrategies: StrategyEntry[] = active
      .sort((a, b) => b.realizedPnl - a.realizedPnl)
      .slice(0, 3)
      .map((s) => ({
        strategy: s.strategy,
        winRate: s.winRate,
        realizedPnl: s.realizedPnl,
      }));

    return {
      topStrategies,
      source: report.source,
    };
  } catch {
    return { topStrategies: [], source: 'missing' };
  }
}

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

/**
 * Assembles all sections into a single DigestReport.
 *
 * @param mock - When true, all sections return fake data
 */
export async function buildDigestReport(mock: boolean): Promise<DigestReport> {
  const [arb, strategyPerformance] = await Promise.all([
    getArbScanSummary(mock),
    getStrategyPerformance(mock),
  ]);

  const positions = getPositionSummary(mock);
  const research = getResearchStatus(mock);
  const stability = getStabilityStatus(mock);
  const topSignal = getTopSignalToday(mock);

  return {
    generatedAt: new Date().toISOString(),
    mode: mock ? 'mock' : 'live',
    arb,
    positions,
    research,
    stability,
    topSignal,
    strategyPerformance,
  };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

const NA = 'N/A';

/** Formats a number as USD with sign */
function fmtUsd(n: number): string {
  const abs = Math.abs(n).toFixed(2);
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
}

/** Formats a percentage */
function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

/**
 * Renders the full digest report to a string.
 *
 * @param report - The assembled digest report
 */
export function renderDigestReport(report: DigestReport): string {
  const sections: string[] = [];
  const header = [
    '╔══════════════════════════════════════════════════════════════╗',
    `║       POLYMARKET SCANNER — DAILY DIGEST                      ║`,
    `║       ${report.generatedAt.slice(0, 19).replace('T', ' ')} UTC   [${report.mode.toUpperCase()}]`.padEnd(63) + '║',
    '╚══════════════════════════════════════════════════════════════╝',
  ].join('\n');
  sections.push(header);

  // 1. Arb Scanner Summary
  const arbRows: [string, string][] = [
    ['Scanned At', report.arb.scannedAt.slice(0, 19).replace('T', ' ')],
    ['Source', report.arb.source],
    ['Top Opportunities Found', String(report.arb.opportunities.length)],
  ];

  for (let i = 0; i < Math.min(3, report.arb.opportunities.length); i++) {
    const opp = report.arb.opportunities[i];
    arbRows.push([
      `  #${i + 1} Pair`,
      opp.pair.length > 28 ? opp.pair.slice(0, 25) + '...' : opp.pair,
    ]);
    arbRows.push([`  #${i + 1} Spread`, fmtPct(opp.spreadPercent)]);
    arbRows.push([`  #${i + 1} Exp. Profit`, fmtUsd(opp.expectedProfit)]);
  }

  if (report.arb.opportunities.length === 0) {
    arbRows.push(['Opportunities', NA]);
  }

  sections.push(renderTable('1. ARB SCANNER SUMMARY', arbRows));

  // 2. Position Tracker Summary
  const pos = report.positions;
  const posRows: [string, string][] = [
    ['Source', pos.source],
    ['Total Trades', pos.source === 'missing' ? NA : String(pos.totalTrades)],
    ['Win Rate', pos.source === 'missing' ? NA : fmtPct(pos.winRate)],
    ['Realized P&L', pos.source === 'missing' ? NA : fmtUsd(pos.realizedPnl)],
    ['Open Positions', pos.source === 'missing' ? NA : String(pos.openPositions)],
  ];
  sections.push(renderTable('2. POSITION TRACKER SUMMARY', posRows));

  // 3. Research Loop Status
  const res = report.research;
  const resRows: [string, string][] = [
    ['Source', res.source],
    ['Brier Score', res.brierScore !== null ? String(res.brierScore) : NA],
    ['Best Strategy', res.bestStrategy ?? NA],
  ];
  sections.push(renderTable('3. RESEARCH LOOP STATUS', resRows));

  // 4. Stability Status
  const stab = report.stability;
  const statusEmoji = stab.status === 'healthy' ? '✓ HEALTHY' : stab.status === 'degraded' ? '⚠ DEGRADED' : '✗ DOWN';
  const stabRows: [string, string][] = [
    ['Status', statusEmoji],
    ['Failing Checks', stab.failingChecks.length === 0 ? 'none' : stab.failingChecks.join(', ')],
    ['Source', stab.source],
  ];
  sections.push(renderTable('4. STABILITY STATUS', stabRows));

  // 5. Top Signal Today
  const sig = report.topSignal;
  const sigRows: [string, string][] = [
    ['Source', sig.source],
    ['Market', sig.source === 'none' ? NA : sig.market],
    ['Direction', sig.source === 'none' ? NA : sig.direction],
    ['EV Score', sig.source === 'none' ? NA : fmtPct(sig.evPercent)],
    ['Strategy', sig.source === 'none' ? NA : sig.strategy],
  ];
  sections.push(renderTable('5. TOP SIGNAL TODAY', sigRows));

  // 6. Strategy Performance
  const sp = report.strategyPerformance;
  const spRows: [string, string][] = [];

  if (sp.topStrategies.length === 0) {
    spRows.push(['Performance', 'N/A \u2014 no resolved positions yet']);
  } else {
    spRows.push(['Source', sp.source]);
    for (let i = 0; i < sp.topStrategies.length; i++) {
      const s = sp.topStrategies[i];
      spRows.push([`  #${i + 1} ${s.strategy}`, `${fmtPct(s.winRate)} win / ${fmtUsd(s.realizedPnl)}`]);
    }
  }
  sections.push(renderTable('6. STRATEGY PERFORMANCE', spRows));

  // 21. Ensemble Performance Monitor
  const ensembleMonitor = new EnsemblePerformanceMonitor();
  sections.push(ensembleMonitor.formatDigestSection());

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/** Detects --mock flag from process.argv */
export function isMockMode(): boolean {
  return process.argv.includes('--mock');
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  const mock = isMockMode();

  if (mock) {
    console.log('\n[digest] Running in MOCK mode — no live API calls\n');
  }

  try {
    const report = await buildDigestReport(mock);
    const output = renderDigestReport(report);
    console.log('\n' + output + '\n');
  } catch (err) {
    console.error('[digest] Fatal error generating report:', err);
    process.exit(1);
  }
}

// Run when invoked directly via tsx/node
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
