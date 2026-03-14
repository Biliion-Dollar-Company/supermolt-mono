/**
 * Tests for the Position Sizing Optimizer
 *
 * Covers:
 *  - compositeMultiplier calculation across all regime × decay combinations
 *  - maxPositionPct cap at 5%
 *  - recommendedBankrollPct per decay severity
 *  - mock fallback behaviour
 *  - JSON serialisation round-trip
 *  - buildAllocationPlan (auto-allocator integration)
 *  - edge cases (zero edge, empty inputs, file persistence)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import os from 'os';

import {
  buildPositionConfig,
  savePositionConfig,
  optimizePositionSizingMock,
  MAX_POSITION_PCT,
  RECOMMENDED_BANKROLL_PCT,
  DEFAULT_BANKROLL_USD,
  type DailyPositionConfig,
} from './position-sizing-optimizer.ts';

import { computeMarketEV, rankMarketsByEV } from '../quant/ev-calculator.ts';
import { classifyDecay, DECAY_MULTIPLIERS } from './alpha-decay-monitor.ts';
import { buildAllocationPlan } from './auto-allocator.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  regime: 'bull' | 'bear' | 'sideways',
  regimeMult: number,
  decay: 'HEALTHY' | 'WARNING' | 'CRITICAL',
  decayMult: number,
): DailyPositionConfig {
  return buildPositionConfig(regime, regimeMult, decay, decayMult, []);
}

// ---------------------------------------------------------------------------
// compositeMultiplier = regimeMult × decayMult
// ---------------------------------------------------------------------------

describe('compositeMultiplier calculation', () => {
  it('bull + HEALTHY → 1.2 × 1.0 = 1.2', () => {
    const cfg = makeConfig('bull', 1.2, 'HEALTHY', 1.0);
    expect(cfg.compositeMultiplier).toBe(1.2);
  });

  it('bull + WARNING → 1.2 × 0.7 = 0.84', () => {
    const cfg = makeConfig('bull', 1.2, 'WARNING', 0.7);
    expect(cfg.compositeMultiplier).toBeCloseTo(0.84, 4);
  });

  it('bull + CRITICAL → 1.2 × 0.3 = 0.36', () => {
    const cfg = makeConfig('bull', 1.2, 'CRITICAL', 0.3);
    expect(cfg.compositeMultiplier).toBeCloseTo(0.36, 4);
  });

  it('sideways + HEALTHY → 1.0 × 1.0 = 1.0', () => {
    const cfg = makeConfig('sideways', 1.0, 'HEALTHY', 1.0);
    expect(cfg.compositeMultiplier).toBe(1.0);
  });

  it('sideways + WARNING → 1.0 × 0.7 = 0.7', () => {
    const cfg = makeConfig('sideways', 1.0, 'WARNING', 0.7);
    expect(cfg.compositeMultiplier).toBeCloseTo(0.7, 4);
  });

  it('sideways + CRITICAL → 1.0 × 0.3 = 0.3', () => {
    const cfg = makeConfig('sideways', 1.0, 'CRITICAL', 0.3);
    expect(cfg.compositeMultiplier).toBeCloseTo(0.3, 4);
  });

  it('bear + HEALTHY → 0.8 × 1.0 = 0.8', () => {
    const cfg = makeConfig('bear', 0.8, 'HEALTHY', 1.0);
    expect(cfg.compositeMultiplier).toBe(0.8);
  });

  it('bear + WARNING → 0.8 × 0.7 = 0.56', () => {
    const cfg = makeConfig('bear', 0.8, 'WARNING', 0.7);
    expect(cfg.compositeMultiplier).toBeCloseTo(0.56, 4);
  });

  it('bear + CRITICAL → 0.8 × 0.3 = 0.24', () => {
    const cfg = makeConfig('bear', 0.8, 'CRITICAL', 0.3);
    expect(cfg.compositeMultiplier).toBeCloseTo(0.24, 4);
  });
});

// ---------------------------------------------------------------------------
// maxPositionPct cap
// ---------------------------------------------------------------------------

describe('maxPositionPct cap', () => {
  it('is always ≤ MAX_POSITION_PCT (5%)', () => {
    const combos: Array<['bull' | 'bear' | 'sideways', number, 'HEALTHY' | 'WARNING' | 'CRITICAL', number]> = [
      ['bull', 1.2, 'HEALTHY', 1.0],
      ['sideways', 1.0, 'HEALTHY', 1.0],
      ['bear', 0.8, 'CRITICAL', 0.3],
    ];
    for (const [regime, rm, decay, dm] of combos) {
      const cfg = makeConfig(regime, rm, decay, dm);
      expect(cfg.maxPositionPct).toBeLessThanOrEqual(MAX_POSITION_PCT);
    }
  });

  it('is exactly 5% when compositeMultiplier > 5%', () => {
    // compositeMultiplier = 1.2 → raw pct = 120% → should cap at 5
    const cfg = makeConfig('bull', 1.2, 'HEALTHY', 1.0);
    expect(cfg.maxPositionPct).toBe(MAX_POSITION_PCT);
  });

  it('MAX_POSITION_PCT constant is 5', () => {
    expect(MAX_POSITION_PCT).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// recommendedBankrollPct
// ---------------------------------------------------------------------------

describe('recommendedBankrollPct', () => {
  it('HEALTHY → 20%', () => {
    const cfg = makeConfig('sideways', 1.0, 'HEALTHY', 1.0);
    expect(cfg.recommendedBankrollPct).toBe(20);
    expect(RECOMMENDED_BANKROLL_PCT.HEALTHY).toBe(20);
  });

  it('WARNING → 12%', () => {
    const cfg = makeConfig('sideways', 1.0, 'WARNING', 0.7);
    expect(cfg.recommendedBankrollPct).toBe(12);
    expect(RECOMMENDED_BANKROLL_PCT.WARNING).toBe(12);
  });

  it('CRITICAL → 8%', () => {
    const cfg = makeConfig('sideways', 1.0, 'CRITICAL', 0.3);
    expect(cfg.recommendedBankrollPct).toBe(8);
    expect(RECOMMENDED_BANKROLL_PCT.CRITICAL).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

describe('mock fallback', () => {
  it('optimizePositionSizingMock returns a valid config without external calls', async () => {
    const cfg = await optimizePositionSizingMock();
    expect(cfg).toBeDefined();
    expect(cfg.regime).toBe('sideways');
    expect(cfg.decaySeverity).toBe('HEALTHY');
    expect(cfg.topMarkets.length).toBeGreaterThan(0);
  });

  it('mock config has a non-empty generatedAt ISO timestamp', async () => {
    const cfg = await optimizePositionSizingMock();
    expect(() => new Date(cfg.generatedAt)).not.toThrow();
    expect(new Date(cfg.generatedAt).getFullYear()).toBeGreaterThan(2020);
  });

  it('mock config topMarkets have non-negative dollarSize', async () => {
    const cfg = await optimizePositionSizingMock();
    for (const m of cfg.topMarkets) {
      expect(m.dollarSize).toBeGreaterThanOrEqual(0);
    }
  });

  it('mock config topMarkets dollarSize ≤ MAX_POSITION_PCT of $1000', async () => {
    const cfg = await optimizePositionSizingMock(1_000);
    const maxDollar = (MAX_POSITION_PCT / 100) * 1_000;
    for (const m of cfg.topMarkets) {
      expect(m.dollarSize).toBeLessThanOrEqual(maxDollar + 0.01); // small float tolerance
    }
  });

  it('buildPositionConfig with empty inputs falls back to mock market data', () => {
    const cfg = buildPositionConfig('sideways', 1.0, 'HEALTHY', 1.0, []);
    expect(cfg.topMarkets.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// JSON serialisation round-trip
// ---------------------------------------------------------------------------

describe('JSON serialisation round-trip', () => {
  it('serialises and deserialises without data loss', async () => {
    const cfg = await optimizePositionSizingMock();
    const json = JSON.stringify(cfg);
    const parsed = JSON.parse(json) as DailyPositionConfig;

    expect(parsed.regime).toBe(cfg.regime);
    expect(parsed.decaySeverity).toBe(cfg.decaySeverity);
    expect(parsed.compositeMultiplier).toBe(cfg.compositeMultiplier);
    expect(parsed.maxPositionPct).toBe(cfg.maxPositionPct);
    expect(parsed.recommendedBankrollPct).toBe(cfg.recommendedBankrollPct);
    expect(parsed.topMarkets.length).toBe(cfg.topMarkets.length);
    expect(parsed.summary).toBe(cfg.summary);
  });

  it('savePositionConfig writes valid JSON to the target path', async () => {
    const tmpDir = resolve(os.tmpdir(), `pm-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    const cfg = await optimizePositionSizingMock();
    savePositionConfig(cfg, tmpDir);

    const filePath = resolve(tmpDir, 'daily-position-config.json');
    expect(existsSync(filePath)).toBe(true);

    const contents = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(contents) as DailyPositionConfig;
    expect(parsed.regime).toBe(cfg.regime);

    // Cleanup
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// EV Calculator unit tests
// ---------------------------------------------------------------------------

describe('EV Calculator', () => {
  it('computes correct edge for a positive-EV market', () => {
    const ev = computeMarketEV({
      marketId: 'test-1',
      marketName: 'Test Market',
      marketPrice: 0.40,
      ourProbability: 0.60,
    });
    expect(ev.edge).toBeCloseTo(0.20, 4);
    expect(ev.edgePercent).toBeCloseTo(20.0, 1);
  });

  it('computes Kelly fraction = edge / (1 - price)', () => {
    const ev = computeMarketEV({
      marketId: 'test-2',
      marketName: 'Test Market',
      marketPrice: 0.40,
      ourProbability: 0.60,
    });
    // Kelly = (0.60 - 0.40) / (1 - 0.40) = 0.20 / 0.60 ≈ 0.3333
    expect(ev.kellyFraction).toBeCloseTo(0.3333, 3);
  });

  it('returns kellyFraction = 0 for negative-edge markets', () => {
    const ev = computeMarketEV({
      marketId: 'test-3',
      marketName: 'Negative Edge',
      marketPrice: 0.70,
      ourProbability: 0.50,
    });
    expect(ev.kellyFraction).toBe(0);
  });

  it('rankMarketsByEV filters out markets below minEdgePct', () => {
    const inputs = [
      { marketId: 'a', marketName: 'A', marketPrice: 0.49, ourProbability: 0.50 }, // 1% edge
      { marketId: 'b', marketName: 'B', marketPrice: 0.55, ourProbability: 0.50 }, // negative edge
    ];
    const ranked = rankMarketsByEV(inputs, 2); // min 2% edge
    expect(ranked.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Alpha Decay Monitor unit tests
// ---------------------------------------------------------------------------

describe('Alpha Decay Monitor', () => {
  it('DECAY_MULTIPLIERS match spec', () => {
    expect(DECAY_MULTIPLIERS.HEALTHY).toBe(1.0);
    expect(DECAY_MULTIPLIERS.WARNING).toBe(0.7);
    expect(DECAY_MULTIPLIERS.CRITICAL).toBe(0.3);
  });

  it('classifyDecay returns CRITICAL when winRate < 0.35', () => {
    const result = classifyDecay({ recentWinRate: 0.30, brierScore: 0.20, consecutiveLosses: 0 });
    expect(result.severity).toBe('CRITICAL');
    expect(result.multiplier).toBe(0.3);
  });

  it('classifyDecay returns WARNING when winRate < 0.50', () => {
    const result = classifyDecay({ recentWinRate: 0.42, brierScore: 0.20, consecutiveLosses: 0 });
    expect(result.severity).toBe('WARNING');
    expect(result.multiplier).toBe(0.7);
  });

  it('classifyDecay returns HEALTHY when all metrics are good', () => {
    const result = classifyDecay({ recentWinRate: 0.65, brierScore: 0.18, consecutiveLosses: 1 });
    expect(result.severity).toBe('HEALTHY');
    expect(result.multiplier).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Auto-allocator integration
// ---------------------------------------------------------------------------

describe('Auto-allocator buildAllocationPlan', () => {
  it('converts a mock config into a valid AllocationPlan', async () => {
    const cfg = await optimizePositionSizingMock();
    const plan = buildAllocationPlan(cfg, 'mock');

    expect(plan.regime).toBe(cfg.regime);
    expect(plan.decaySeverity).toBe(cfg.decaySeverity);
    expect(plan.compositeMultiplier).toBe(cfg.compositeMultiplier);
    expect(plan.configSource).toBe('mock');
    expect(plan.allocations.length).toBeGreaterThan(0);
    expect(plan.totalAllocated).toBeGreaterThanOrEqual(0);
  });

  it('totalAllocated equals sum of individual dollarSizes', async () => {
    const cfg = await optimizePositionSizingMock();
    const plan = buildAllocationPlan(cfg, 'mock');

    const sum = plan.allocations.reduce((s, a) => s + a.dollarSize, 0);
    expect(plan.totalAllocated).toBeCloseTo(sum, 2);
  });

  it('all allocation dollarSizes are non-negative', async () => {
    const cfg = await optimizePositionSizingMock();
    const plan = buildAllocationPlan(cfg, 'mock');

    for (const a of plan.allocations) {
      expect(a.dollarSize).toBeGreaterThanOrEqual(0);
    }
  });
});
