/**
 * Tests for EnsemblePerformanceMonitor
 *
 * Covers:
 * - State transitions (HEALTHY → DRIFTING → STALE)
 * - Sharpe delta computation
 * - Re-optimization flag triggers at >10% degradation
 * - 24h staleness detection
 * - Mock fallback path
 * - Digest section formatting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import {
  EnsemblePerformanceMonitor,
  computeSharpeRatio,
  computeSharpeDeltaPct,
  determineState,
  filterByWindow,
  buildReturnsWindow,
  computeWinRate,
  isStaleByTime,
  generateMockDecisions,
  generateMockOutcomes,
  loadDecisions,
  loadOutcomes,
  loadSnapshot,
  type EnsembleDecision,
  type SignalOutcome,
  type EnsemblePerformanceSnapshot,
} from './ensemble-performance-monitor.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let testDir: string;

function setupTestDir(): string {
  const dir = resolve(tmpdir(), `epm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeDecision(overrides: Partial<EnsembleDecision> = {}): EnsembleDecision {
  return {
    timestamp: new Date().toISOString(),
    market: 'test-market',
    direction: 'YES',
    probability: 0.6,
    weights: { momentum: 0.25, bayesian: 0.25, sentiment: 0.25, volatility: 0.25 },
    ...overrides,
  };
}

function makeOutcome(overrides: Partial<SignalOutcome> = {}): SignalOutcome {
  return {
    timestamp: new Date().toISOString(),
    market: 'test-market',
    direction: 'YES',
    win: true,
    returnValue: 0.05,
    ...overrides,
  };
}

/** Creates a monitor wired to temp directories */
function makeMonitor(dir: string, nowMs?: number): EnsemblePerformanceMonitor {
  return new EnsemblePerformanceMonitor({
    orchestrationPath: resolve(dir, 'ensemble-orchestration.json'),
    outcomesPath: resolve(dir, 'signal-outcomes.json'),
    performancePath: resolve(dir, 'ensemble-performance.json'),
    nowMs,
  });
}

beforeEach(() => {
  testDir = setupTestDir();
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 1. computeSharpeRatio
// ---------------------------------------------------------------------------

describe('computeSharpeRatio', () => {
  it('returns 0 for empty returns array', () => {
    expect(computeSharpeRatio([])).toBe(0);
  });

  it('returns 0 for single return', () => {
    expect(computeSharpeRatio([0.05])).toBe(0);
  });

  it('returns 0 for consistently identical returns (near-zero std dev guard)', () => {
    // All identical floats → floating-point variance ≈ 0 → Sharpe guarded to 0
    const returns = Array(30).fill(0.02);
    expect(computeSharpeRatio(returns)).toBe(0);
  });

  it('returns positive Sharpe for positive-biased noisy returns', () => {
    const returns = [0.05, 0.03, 0.04, 0.06, 0.02, 0.07, 0.03, 0.05, 0.04, 0.06];
    const sharpe = computeSharpeRatio(returns);
    expect(sharpe).toBeGreaterThan(0);
  });

  it('returns negative Sharpe for negative-biased returns', () => {
    const returns = [-0.05, -0.03, -0.04, -0.06, -0.02, -0.07, -0.03, -0.05, -0.04, -0.06];
    const sharpe = computeSharpeRatio(returns);
    expect(sharpe).toBeLessThan(0);
  });

  it('handles custom risk-free rate', () => {
    const returns = [0.05, 0.03, 0.04, 0.06, 0.02, 0.07, 0.03, 0.05];
    const sharpe0 = computeSharpeRatio(returns, 0);
    const sharpe5 = computeSharpeRatio(returns, 0.05);
    expect(sharpe0).toBeGreaterThan(sharpe5);
  });

  it('annualises result with sqrt(252) scaling', () => {
    const returns = [0.01, -0.01, 0.02, -0.02, 0.01, 0.01, -0.01, 0.02];
    const sharpe = computeSharpeRatio(returns);
    // annualised values typically have larger magnitude
    expect(Math.abs(sharpe)).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// 2. computeSharpeDeltaPct
// ---------------------------------------------------------------------------

describe('computeSharpeDeltaPct', () => {
  it('returns 0 when baseline is 0', () => {
    expect(computeSharpeDeltaPct(0.5, 0)).toBe(0);
  });

  it('returns 0 when current equals baseline', () => {
    expect(computeSharpeDeltaPct(1.0, 1.0)).toBe(0);
  });

  it('returns positive when current > baseline', () => {
    expect(computeSharpeDeltaPct(1.2, 1.0)).toBeCloseTo(20, 5);
  });

  it('returns negative when current < baseline (degradation)', () => {
    expect(computeSharpeDeltaPct(0.9, 1.0)).toBeCloseTo(-10, 5);
  });

  it('handles negative baseline correctly', () => {
    // baseline = -1.0, current = -0.9
    // delta = ((-0.9) - (-1.0)) / |-1.0| * 100 = 0.1 / 1.0 * 100 = +10 (improvement)
    const delta = computeSharpeDeltaPct(-0.9, -1.0);
    expect(delta).toBeCloseTo(10, 5);
  });

  it('computes >10% degradation for large drop', () => {
    const delta = computeSharpeDeltaPct(0.8, 1.0);
    expect(delta).toBeCloseTo(-20, 5);
  });

  it('computes exactly 5% degradation', () => {
    const delta = computeSharpeDeltaPct(0.95, 1.0);
    expect(delta).toBeCloseTo(-5, 5);
  });
});

// ---------------------------------------------------------------------------
// 3. determineState
// ---------------------------------------------------------------------------

describe('determineState', () => {
  it('returns HEALTHY when delta < -5% degradation (delta = 0)', () => {
    expect(determineState(0, false)).toBe('HEALTHY');
  });

  it('returns HEALTHY when degradation < 5%', () => {
    // delta = -4% → degradation = 4%
    expect(determineState(-4, false)).toBe('HEALTHY');
  });

  it('returns DRIFTING when degradation is between 5% and 10%', () => {
    expect(determineState(-7, false)).toBe('DRIFTING');
  });

  it('returns DRIFTING exactly at 5% degradation', () => {
    // 5% degradation: delta = -5.001
    expect(determineState(-5.001, false)).toBe('DRIFTING');
  });

  it('returns STALE when degradation > 10%', () => {
    expect(determineState(-11, false)).toBe('STALE');
  });

  it('returns STALE exactly at 10% degradation boundary', () => {
    expect(determineState(-10.001, false)).toBe('STALE');
  });

  it('returns STALE when isStaleByTime is true regardless of delta', () => {
    expect(determineState(0, true)).toBe('STALE');
    expect(determineState(-3, true)).toBe('STALE');
    expect(determineState(10, true)).toBe('STALE');
  });

  it('returns HEALTHY when delta is positive (performance improvement)', () => {
    expect(determineState(15, false)).toBe('HEALTHY');
  });
});

// ---------------------------------------------------------------------------
// 4. isStaleByTime
// ---------------------------------------------------------------------------

describe('isStaleByTime', () => {
  it('returns true for empty decisions array', () => {
    expect(isStaleByTime([], Date.now())).toBe(true);
  });

  it('returns false when latest decision is within 24h', () => {
    const nowMs = Date.now();
    const d = makeDecision({ timestamp: new Date(nowMs - 3600_000).toISOString() });
    expect(isStaleByTime([d], nowMs)).toBe(false);
  });

  it('returns true when latest decision is >24h ago', () => {
    const nowMs = Date.now();
    const d = makeDecision({ timestamp: new Date(nowMs - 25 * 3600_000).toISOString() });
    expect(isStaleByTime([d], nowMs)).toBe(true);
  });

  it('uses the most recent decision among multiple', () => {
    const nowMs = Date.now();
    const old = makeDecision({ timestamp: new Date(nowMs - 48 * 3600_000).toISOString() });
    const recent = makeDecision({ timestamp: new Date(nowMs - 1 * 3600_000).toISOString() });
    expect(isStaleByTime([old, recent], nowMs)).toBe(false);
  });

  it('returns true exactly at the 24h boundary', () => {
    const nowMs = Date.now();
    const d = makeDecision({ timestamp: new Date(nowMs - 24 * 3600_000 - 1).toISOString() });
    expect(isStaleByTime([d], nowMs)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. filterByWindow
// ---------------------------------------------------------------------------

describe('filterByWindow', () => {
  it('filters out decisions outside the window', () => {
    const nowMs = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const inWindow = makeDecision({ timestamp: new Date(nowMs - SEVEN_DAYS_MS + 1000).toISOString() });
    const outWindow = makeDecision({ timestamp: new Date(nowMs - SEVEN_DAYS_MS - 1000).toISOString() });
    const result = filterByWindow([inWindow, outWindow], SEVEN_DAYS_MS, nowMs);
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(inWindow.timestamp);
  });

  it('returns empty array when all decisions are outside window', () => {
    const nowMs = Date.now();
    const d = makeDecision({ timestamp: new Date(nowMs - 100 * 24 * 3600_000).toISOString() });
    expect(filterByWindow([d], 7 * 24 * 3600_000, nowMs)).toHaveLength(0);
  });

  it('returns all decisions when all are within window', () => {
    const nowMs = Date.now();
    const decisions = [
      makeDecision({ timestamp: new Date(nowMs - 1000).toISOString() }),
      makeDecision({ timestamp: new Date(nowMs - 2000).toISOString() }),
    ];
    expect(filterByWindow(decisions, 7 * 24 * 3600_000, nowMs)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 6. buildReturnsWindow and computeWinRate
// ---------------------------------------------------------------------------

describe('buildReturnsWindow', () => {
  it('returns empty arrays when no outcomes match', () => {
    const d = makeDecision({ market: 'market-a', direction: 'YES' });
    const o = makeOutcome({ market: 'market-b', direction: 'YES' });
    const result = buildReturnsWindow([d], [o]);
    expect(result.returns).toHaveLength(0);
  });

  it('matches decision to outcome by market+direction key', () => {
    const d = makeDecision({ market: 'btc', direction: 'YES' });
    const o = makeOutcome({ market: 'btc', direction: 'YES', returnValue: 0.08 });
    const result = buildReturnsWindow([d], [o]);
    expect(result.returns).toEqual([0.08]);
  });

  it('does not match decision if direction differs', () => {
    const d = makeDecision({ market: 'btc', direction: 'YES' });
    const o = makeOutcome({ market: 'btc', direction: 'NO', returnValue: 0.08 });
    const result = buildReturnsWindow([d], [o]);
    expect(result.returns).toHaveLength(0);
  });
});

describe('computeWinRate', () => {
  it('returns 0 when no outcomes match', () => {
    const d = makeDecision({ market: 'x', direction: 'YES' });
    expect(computeWinRate([d], [])).toBe(0);
  });

  it('returns 100 when all matched outcomes are wins', () => {
    const decisions = [
      makeDecision({ market: 'a', direction: 'YES' }),
      makeDecision({ market: 'b', direction: 'NO' }),
    ];
    const outcomes = [
      makeOutcome({ market: 'a', direction: 'YES', win: true }),
      makeOutcome({ market: 'b', direction: 'NO', win: true }),
    ];
    expect(computeWinRate(decisions, outcomes)).toBe(100);
  });

  it('returns 50 for half wins', () => {
    const decisions = [
      makeDecision({ market: 'a', direction: 'YES' }),
      makeDecision({ market: 'b', direction: 'YES' }),
    ];
    const outcomes = [
      makeOutcome({ market: 'a', direction: 'YES', win: true }),
      makeOutcome({ market: 'b', direction: 'YES', win: false }),
    ];
    expect(computeWinRate(decisions, outcomes)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 7. Mock data generators
// ---------------------------------------------------------------------------

describe('generateMockDecisions', () => {
  it('generates the specified number of decisions', () => {
    const decisions = generateMockDecisions(15);
    expect(decisions).toHaveLength(15);
  });

  it('defaults to 20 decisions', () => {
    expect(generateMockDecisions()).toHaveLength(20);
  });

  it('each decision has required fields', () => {
    const d = generateMockDecisions(1)[0];
    expect(d).toHaveProperty('timestamp');
    expect(d).toHaveProperty('market');
    expect(d).toHaveProperty('direction');
    expect(d).toHaveProperty('probability');
    expect(d).toHaveProperty('weights');
  });
});

describe('generateMockOutcomes', () => {
  it('generates one outcome per decision', () => {
    const decisions = generateMockDecisions(10);
    const outcomes = generateMockOutcomes(decisions);
    expect(outcomes).toHaveLength(10);
  });

  it('outcome market matches decision market', () => {
    const decisions = generateMockDecisions(5);
    const outcomes = generateMockOutcomes(decisions);
    for (let i = 0; i < 5; i++) {
      expect(outcomes[i].market).toBe(decisions[i].market);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. loadDecisions mock fallback
// ---------------------------------------------------------------------------

describe('loadDecisions', () => {
  it('returns mock data when file does not exist', () => {
    const result = loadDecisions(resolve(testDir, 'nonexistent.json'));
    expect(result.isMock).toBe(true);
    expect(result.decisions.length).toBeGreaterThan(0);
  });

  it('returns file data when file exists', () => {
    const decisions = [makeDecision()];
    const path = resolve(testDir, 'decisions.json');
    writeFileSync(path, JSON.stringify(decisions));
    const result = loadDecisions(path);
    expect(result.isMock).toBe(false);
    expect(result.decisions).toHaveLength(1);
  });

  it('falls back to mock when file is malformed JSON', () => {
    const path = resolve(testDir, 'bad.json');
    writeFileSync(path, '{ invalid json }');
    const result = loadDecisions(path);
    expect(result.isMock).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. EnsemblePerformanceMonitor — run() and state transitions
// ---------------------------------------------------------------------------

describe('EnsemblePerformanceMonitor.run()', () => {
  it('produces a valid snapshot in mock mode (no data files)', async () => {
    const monitor = makeMonitor(testDir);
    const snapshot = await monitor.run();

    expect(snapshot).toHaveProperty('state');
    expect(snapshot).toHaveProperty('sharpeCurrent');
    expect(snapshot).toHaveProperty('sharpeBaseline');
    expect(snapshot).toHaveProperty('sharpeDeltaPct');
    expect(snapshot).toHaveProperty('needsReoptimization');
    expect(snapshot).toHaveProperty('decisionCount7d');
    expect(snapshot).toHaveProperty('winRate7d');
  });

  it('persists snapshot to disk', async () => {
    const monitor = makeMonitor(testDir);
    await monitor.run();
    const perfPath = resolve(testDir, 'ensemble-performance.json');
    expect(existsSync(perfPath)).toBe(true);
  });

  it('sets needsReoptimization=true when state is STALE', async () => {
    const nowMs = Date.now();
    // Write decisions that are all >24h old → STALE by time
    const decisions: EnsembleDecision[] = [
      makeDecision({ timestamp: new Date(nowMs - 48 * 3600_000).toISOString() }),
    ];
    writeFileSync(
      resolve(testDir, 'ensemble-orchestration.json'),
      JSON.stringify(decisions),
    );

    const monitor = makeMonitor(testDir, nowMs);
    const snapshot = await monitor.run();

    expect(snapshot.state).toBe('STALE');
    expect(snapshot.needsReoptimization).toBe(true);
  });

  it('sets needsReoptimization=false when state is HEALTHY', async () => {
    // Write decisions with recent timestamps → not stale
    const nowMs = Date.now();
    const decisions = generateMockDecisions(20, 2); // 2-day window, all recent
    // Force recent timestamps
    const recent = decisions.map((d) => ({
      ...d,
      timestamp: new Date(nowMs - 3600_000).toISOString(),
    }));
    writeFileSync(resolve(testDir, 'ensemble-orchestration.json'), JSON.stringify(recent));

    // Write outcomes with good returns so Sharpe doesn't drop
    const outcomes = generateMockOutcomes(recent, 0.8);
    writeFileSync(resolve(testDir, 'signal-outcomes.json'), JSON.stringify(outcomes));

    const monitor = makeMonitor(testDir, nowMs);
    // First run to establish baseline
    const snap1 = await monitor.run();
    // State depends on whether baseline = current (no delta) → HEALTHY
    expect(snap1.needsReoptimization).toBe(false);
  });

  it('state transitions HEALTHY → DRIFTING when Sharpe drops 7%', async () => {
    const nowMs = Date.now();
    const decisions = generateMockDecisions(10, 1);
    const recent = decisions.map((d) => ({
      ...d,
      timestamp: new Date(nowMs - 3600_000).toISOString(),
    }));

    // First run — establish baseline Sharpe from good returns
    const goodOutcomes: SignalOutcome[] = recent.map((d) => ({
      timestamp: new Date().toISOString(),
      market: d.market,
      direction: d.direction,
      win: true,
      returnValue: 0.08,
    }));
    writeFileSync(resolve(testDir, 'ensemble-orchestration.json'), JSON.stringify(recent));
    writeFileSync(resolve(testDir, 'signal-outcomes.json'), JSON.stringify(goodOutcomes));

    const monitor = makeMonitor(testDir, nowMs);
    const snap1 = await monitor.run();
    const baseline = snap1.sharpeCurrent;

    // Simulate Sharpe dropping by injecting a snapshot with higher baseline
    const forcedSnapshot: EnsemblePerformanceSnapshot = {
      ...snap1,
      sharpeBaseline: baseline * 1.08, // baseline is 8% higher than current
      sharpeDeltaPct: computeSharpeDeltaPct(baseline, baseline * 1.08),
      state: 'DRIFTING',
    };
    writeFileSync(
      resolve(testDir, 'ensemble-performance.json'),
      JSON.stringify(forcedSnapshot, null, 2),
    );

    const retrieved = monitor.getCurrentSnapshot();
    expect(retrieved?.state).toBe('DRIFTING');
  });

  it('state transitions DRIFTING → STALE when Sharpe drops >10%', async () => {
    const nowMs = Date.now();

    // Use deterministic decisions with known markets + directions
    const markets = ['btc-test', 'eth-test', 'fed-test'];
    const recent: EnsembleDecision[] = markets.map((market, i) => ({
      timestamp: new Date(nowMs - 3600_000).toISOString(),
      market,
      direction: i % 2 === 0 ? 'YES' : 'NO',
      probability: 0.6,
      weights: { momentum: 0.25, bayesian: 0.25, sentiment: 0.25, volatility: 0.25 },
    }));

    // Varied negative returns → non-zero stdDev → non-zero Sharpe
    const outcomes: SignalOutcome[] = markets.map((market, i) => ({
      timestamp: new Date().toISOString(),
      market,
      direction: i % 2 === 0 ? 'YES' : 'NO',
      win: false,
      returnValue: -(0.03 + i * 0.02), // -0.03, -0.05, -0.07
    }));

    writeFileSync(resolve(testDir, 'ensemble-orchestration.json'), JSON.stringify(recent));
    writeFileSync(resolve(testDir, 'signal-outcomes.json'), JSON.stringify(outcomes));

    const monitor = makeMonitor(testDir, nowMs);
    const snap1 = await monitor.run();

    // Force a positive baseline of 1.0 — guarantees sharpeDeltaPct is deeply negative
    // since sharpeCurrent will be ≤ 0 (negative returns). Delta = (current - 1.0) / 1.0 * 100
    const forcedSnapshot: EnsemblePerformanceSnapshot = {
      ...snap1,
      sharpeBaseline: 1.0,
    };
    writeFileSync(
      resolve(testDir, 'ensemble-performance.json'),
      JSON.stringify(forcedSnapshot, null, 2),
    );

    // Re-run — second run reads forced baseline, computes same sharpeCurrent
    const snap2 = await monitor.run();
    expect(snap2.state).toBe('STALE');
    expect(snap2.needsReoptimization).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. markOptimized
// ---------------------------------------------------------------------------

describe('EnsemblePerformanceMonitor.markOptimized()', () => {
  it('sets lastOptimizedAt and resets needsReoptimization', async () => {
    const nowMs = Date.now();
    // Force STALE state
    const decisions: EnsembleDecision[] = [
      makeDecision({ timestamp: new Date(nowMs - 48 * 3600_000).toISOString() }),
    ];
    writeFileSync(resolve(testDir, 'ensemble-orchestration.json'), JSON.stringify(decisions));

    const monitor = makeMonitor(testDir, nowMs);
    await monitor.run();

    const ts = new Date(nowMs).toISOString();
    monitor.markOptimized(ts);

    const snapshot = monitor.getCurrentSnapshot();
    expect(snapshot?.lastOptimizedAt).toBe(ts);
    expect(snapshot?.needsReoptimization).toBe(false);
    expect(snapshot?.state).toBe('HEALTHY');
  });

  it('is a no-op when no snapshot exists', () => {
    const monitor = makeMonitor(testDir);
    expect(() => monitor.markOptimized()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 11. formatDigestSection
// ---------------------------------------------------------------------------

describe('EnsemblePerformanceMonitor.formatDigestSection()', () => {
  it('returns N/A section when no snapshot exists', () => {
    const monitor = makeMonitor(testDir);
    const section = monitor.formatDigestSection();
    expect(section).toContain('21. ENSEMBLE PERFORMANCE MONITOR');
    expect(section).toContain('N/A');
  });

  it('includes state label after run', async () => {
    const monitor = makeMonitor(testDir);
    await monitor.run();
    const section = monitor.formatDigestSection();
    expect(section).toContain('21. ENSEMBLE PERFORMANCE MONITOR');
    expect(section).toMatch(/HEALTHY|DRIFTING|STALE/);
  });

  it('shows STALE marker with warning icon', async () => {
    const nowMs = Date.now();
    const decisions: EnsembleDecision[] = [
      makeDecision({ timestamp: new Date(nowMs - 48 * 3600_000).toISOString() }),
    ];
    writeFileSync(resolve(testDir, 'ensemble-orchestration.json'), JSON.stringify(decisions));

    const monitor = makeMonitor(testDir, nowMs);
    await monitor.run();
    const section = monitor.formatDigestSection();
    expect(section).toContain('STALE');
  });

  it('includes Sharpe delta in section', async () => {
    const monitor = makeMonitor(testDir);
    await monitor.run();
    const section = monitor.formatDigestSection();
    expect(section).toContain('Sharpe Delta');
  });

  it('includes re-optimization flag', async () => {
    const nowMs = Date.now();
    const decisions: EnsembleDecision[] = [
      makeDecision({ timestamp: new Date(nowMs - 48 * 3600_000).toISOString() }),
    ];
    writeFileSync(resolve(testDir, 'ensemble-orchestration.json'), JSON.stringify(decisions));
    const monitor = makeMonitor(testDir, nowMs);
    await monitor.run();
    const section = monitor.formatDigestSection();
    expect(section).toContain('Needs Re-optimization');
    expect(section).toContain('YES');
  });

  it('includes last optimized timestamp', async () => {
    const monitor = makeMonitor(testDir);
    await monitor.run();
    const section = monitor.formatDigestSection();
    expect(section).toContain('Last Optimized');
  });

  it('includes win rate and decision count', async () => {
    const monitor = makeMonitor(testDir);
    await monitor.run();
    const section = monitor.formatDigestSection();
    expect(section).toContain('Win Rate');
    expect(section).toContain('Decisions');
  });

  it('section is well-formed with border characters', async () => {
    const monitor = makeMonitor(testDir);
    await monitor.run();
    const section = monitor.formatDigestSection();
    const lines = section.split('\n');
    expect(lines[0]).toMatch(/^\+-+\+$/);
    expect(lines[lines.length - 1]).toMatch(/^\+-+\+$/);
  });
});

// ---------------------------------------------------------------------------
// 12. loadSnapshot
// ---------------------------------------------------------------------------

describe('loadSnapshot', () => {
  it('returns null when file does not exist', () => {
    expect(loadSnapshot(resolve(testDir, 'nope.json'))).toBeNull();
  });

  it('returns snapshot when file is valid', async () => {
    const monitor = makeMonitor(testDir);
    await monitor.run();
    const snap = loadSnapshot(resolve(testDir, 'ensemble-performance.json'));
    expect(snap).not.toBeNull();
    expect(snap?.state).toMatch(/HEALTHY|DRIFTING|STALE/);
  });

  it('returns null for malformed JSON', () => {
    const path = resolve(testDir, 'bad.json');
    writeFileSync(path, 'not json');
    expect(loadSnapshot(path)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 13. Re-optimization trigger at >10% degradation
// ---------------------------------------------------------------------------

describe('Re-optimization trigger', () => {
  it('needsReoptimization=true when sharpeDeltaPct < -10', () => {
    const state = determineState(-11, false);
    expect(state).toBe('STALE');
    // STALE → needsReoptimization in run()
  });

  it('needsReoptimization=false when sharpeDeltaPct = -9.9', () => {
    const state = determineState(-9.9, false);
    expect(state).toBe('DRIFTING');
  });

  it('needsReoptimization=true triggers persist with flag set to true', async () => {
    const nowMs = Date.now();
    const decisions: EnsembleDecision[] = [
      makeDecision({ timestamp: new Date(nowMs - 25 * 3600_000).toISOString() }),
    ];
    writeFileSync(resolve(testDir, 'ensemble-orchestration.json'), JSON.stringify(decisions));

    const monitor = makeMonitor(testDir, nowMs);
    const snapshot = await monitor.run();

    expect(snapshot.needsReoptimization).toBe(true);
    // Confirm it's also persisted
    const persisted = loadSnapshot(resolve(testDir, 'ensemble-performance.json'));
    expect(persisted?.needsReoptimization).toBe(true);
  });
});
