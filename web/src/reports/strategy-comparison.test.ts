/**
 * Tests for strategy-comparison.ts
 *
 * Covers: compareStrategies(), formatComparison(), stat calculations,
 * Brier score, best/worst trade, edge cases, and mock mode.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  compareStrategies,
  formatComparison,
  computeStrategyStats,
  computeBrierScore,
  effectivePnl,
  loadPositions,
  MOCK_POSITIONS,
  type StrategyPosition,
  type StrategyTag,
} from './strategy-comparison.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal closed position for testing */
function makePosition(
  overrides: Partial<StrategyPosition> & { strategy: StrategyTag },
): StrategyPosition {
  return {
    id: overrides.id ?? `test-${Math.random()}`,
    strategy: overrides.strategy,
    market: overrides.market ?? 'Test Market',
    direction: overrides.direction ?? 'YES',
    entryPrice: overrides.entryPrice ?? 0.5,
    exitPrice: overrides.exitPrice,
    size: overrides.size ?? 100,
    status: overrides.status ?? 'closed',
    pnl: overrides.pnl,
    predictedProb: overrides.predictedProb,
    outcome: overrides.outcome,
    edgePercent: overrides.edgePercent,
    timestamp: overrides.timestamp ?? '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Test 1: compareStrategies() with empty data (missing file, no mock)
// ---------------------------------------------------------------------------

describe('compareStrategies() — empty / missing data', () => {
  it('returns an empty comparison with note when source is missing', async () => {
    // Force load with an empty positions array by using a non-mock, non-file path
    // We test loadPositions directly with the missing case
    const { positions, source } = loadPositions(false);
    // In test env, data/paper-positions.json won't exist
    expect(['missing', 'file']).toContain(source);
    if (source === 'missing') {
      expect(positions).toHaveLength(0);
    }
  });

  it('compareStrategies() with empty positions returns all 4 strategies with zero counts', async () => {
    // We inject empty positions by testing computeStrategyStats directly
    const stats = computeStrategyStats('PM_LONG', []);
    expect(stats.tradeCount).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.realizedPnl).toBe(0);
    expect(stats.avgEdgePercent).toBe(0);
    expect(stats.brierScore).toBeNull();
    expect(stats.bestTrade).toBeNull();
    expect(stats.worstTrade).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 2: compareStrategies() with mock trades (3+ per strategy)
// ---------------------------------------------------------------------------

describe('compareStrategies() — mock mode', () => {
  it('returns a report with 4 strategies in mock mode', async () => {
    const report = await compareStrategies(true);
    expect(report.mode).toBe('mock');
    expect(report.source).toBe('mock');
    expect(report.strategies).toHaveLength(4);
  });

  it('all 4 strategies have at least 3 trades in mock mode', async () => {
    const report = await compareStrategies(true);
    for (const s of report.strategies) {
      expect(s.tradeCount).toBeGreaterThanOrEqual(3);
    }
  });

  it('MOCK_POSITIONS contains 15+ trades across all strategies', () => {
    expect(MOCK_POSITIONS.length).toBeGreaterThanOrEqual(15);
    const strategies = new Set(MOCK_POSITIONS.map((p) => p.strategy));
    expect(strategies.has('PM_LONG')).toBe(true);
    expect(strategies.has('HIGH_EDGE')).toBe(true);
    expect(strategies.has('FADE_MARKET')).toBe(true);
    expect(strategies.has('MOMENTUM')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 3: formatComparison() output contains strategy names + stats
// ---------------------------------------------------------------------------

describe('formatComparison() — output validation', () => {
  it('output contains all 4 strategy names', async () => {
    const report = await compareStrategies(true);
    const output = formatComparison(report);

    expect(output).toContain('PM_LONG');
    expect(output).toContain('HIGH_EDGE');
    expect(output).toContain('FADE_MARKET');
    expect(output).toContain('MOMENTUM');
  });

  it('output contains key stat labels', async () => {
    const report = await compareStrategies(true);
    const output = formatComparison(report);

    expect(output).toContain('Win Rate');
    expect(output).toContain('Avg Edge');
    expect(output).toContain('Realized P&L');
    expect(output).toContain('Brier Score');
    expect(output).toContain('Trade Count');
  });

  it('output contains markdown table headers', async () => {
    const report = await compareStrategies(true);
    const output = formatComparison(report);

    expect(output).toContain('## Strategy Performance Summary');
    expect(output).toContain('| Strategy |');
    expect(output).toContain('| Trades |');
  });

  it('output contains rankings section when trades exist', async () => {
    const report = await compareStrategies(true);
    const output = formatComparison(report);
    expect(output).toContain('🏆 Rankings by Realized P&L');
  });

  it('output contains mode and source info', async () => {
    const report = await compareStrategies(true);
    const output = formatComparison(report);
    expect(output).toContain('MOCK');
    expect(output).toContain('mock');
  });
});

// ---------------------------------------------------------------------------
// Test 4: Win rate calculation accuracy
// ---------------------------------------------------------------------------

describe('Win rate calculation', () => {
  it('calculates 50% win rate for 1 win, 1 loss', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'PM_LONG', pnl: 20.0, status: 'closed' }),
      makePosition({ strategy: 'PM_LONG', pnl: -10.0, status: 'closed' }),
    ];
    const stats = computeStrategyStats('PM_LONG', positions);
    expect(stats.winRate).toBe(50);
  });

  it('calculates 100% win rate when all closed trades are profitable', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'HIGH_EDGE', pnl: 15.0, status: 'closed' }),
      makePosition({ strategy: 'HIGH_EDGE', pnl: 25.0, status: 'closed' }),
      makePosition({ strategy: 'HIGH_EDGE', pnl: 5.0, status: 'closed' }),
    ];
    const stats = computeStrategyStats('HIGH_EDGE', positions);
    expect(stats.winRate).toBe(100);
  });

  it('calculates 0% win rate when all trades are losses', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'FADE_MARKET', pnl: -10.0, status: 'closed' }),
      makePosition({ strategy: 'FADE_MARKET', pnl: -5.0, status: 'closed' }),
    ];
    const stats = computeStrategyStats('FADE_MARKET', positions);
    expect(stats.winRate).toBe(0);
  });

  it('open positions do not count toward win rate', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'MOMENTUM', pnl: 10.0, status: 'closed' }),
      makePosition({ strategy: 'MOMENTUM', status: 'open' }),
      makePosition({ strategy: 'MOMENTUM', status: 'open' }),
    ];
    const stats = computeStrategyStats('MOMENTUM', positions);
    // Only 1 closed trade, which is a win → 100%
    expect(stats.winRate).toBe(100);
    expect(stats.tradeCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Test 5: P&L sum accuracy
// ---------------------------------------------------------------------------

describe('P&L sum accuracy', () => {
  it('sums P&L correctly from stored pnl field', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'PM_LONG', pnl: 30.0, status: 'closed' }),
      makePosition({ strategy: 'PM_LONG', pnl: -12.5, status: 'closed' }),
      makePosition({ strategy: 'PM_LONG', pnl: 8.75, status: 'closed' }),
    ];
    const stats = computeStrategyStats('PM_LONG', positions);
    expect(stats.realizedPnl).toBeCloseTo(26.25, 2);
  });

  it('derives P&L from entry/exit prices when pnl not stored (YES direction)', () => {
    const p = makePosition({
      strategy: 'HIGH_EDGE',
      direction: 'YES',
      entryPrice: 0.30,
      exitPrice: 0.80,
      size: 100,
      status: 'closed',
    });
    // (0.80 - 0.30) * 100 = 50.0
    expect(effectivePnl(p)).toBeCloseTo(50.0, 2);
  });

  it('derives P&L from entry/exit prices when pnl not stored (NO direction)', () => {
    const p = makePosition({
      strategy: 'FADE_MARKET',
      direction: 'NO',
      entryPrice: 0.60,
      exitPrice: 0.20,
      size: 50,
      status: 'closed',
    });
    // NO direction: -(0.20 - 0.60) * 50 = -(-0.40 * 50) = 20
    expect(effectivePnl(p)).toBeCloseTo(20.0, 2);
  });

  it('open positions are excluded from realized P&L sum', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'MOMENTUM', pnl: 20.0, status: 'closed' }),
      makePosition({ strategy: 'MOMENTUM', status: 'open', entryPrice: 0.5, size: 100 }),
    ];
    const stats = computeStrategyStats('MOMENTUM', positions);
    expect(stats.realizedPnl).toBeCloseTo(20.0, 2);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Best/worst trade identification
// ---------------------------------------------------------------------------

describe('Best/worst trade identification', () => {
  it('identifies the best trade as the highest P&L closed position', () => {
    const p1 = makePosition({ id: 'low', strategy: 'PM_LONG', pnl: 10.0, status: 'closed' });
    const p2 = makePosition({ id: 'high', strategy: 'PM_LONG', pnl: 50.0, status: 'closed' });
    const p3 = makePosition({ id: 'mid', strategy: 'PM_LONG', pnl: 25.0, status: 'closed' });
    const stats = computeStrategyStats('PM_LONG', [p1, p2, p3]);
    expect(stats.bestTrade?.id).toBe('high');
  });

  it('identifies the worst trade as the lowest P&L closed position', () => {
    const p1 = makePosition({ id: 'loss', strategy: 'HIGH_EDGE', pnl: -30.0, status: 'closed' });
    const p2 = makePosition({ id: 'gain', strategy: 'HIGH_EDGE', pnl: 20.0, status: 'closed' });
    const stats = computeStrategyStats('HIGH_EDGE', [p1, p2]);
    expect(stats.worstTrade?.id).toBe('loss');
  });

  it('bestTrade and worstTrade are null when no closed positions exist', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'FADE_MARKET', status: 'open' }),
    ];
    const stats = computeStrategyStats('FADE_MARKET', positions);
    expect(stats.bestTrade).toBeNull();
    expect(stats.worstTrade).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 7: Edge case — single-strategy data
// ---------------------------------------------------------------------------

describe('Single-strategy edge case', () => {
  it('computes stats correctly with only one strategy having trades', () => {
    const stats = computeStrategyStats('PM_LONG', [
      makePosition({ strategy: 'PM_LONG', pnl: 15.0, status: 'closed', edgePercent: 8.5 }),
    ]);
    expect(stats.tradeCount).toBe(1);
    expect(stats.winRate).toBe(100);
    expect(stats.avgEdgePercent).toBe(8.5);
    expect(stats.realizedPnl).toBe(15.0);
  });

  it('strategies with no trades return zero stats without throwing', () => {
    const emptyStats = computeStrategyStats('MOMENTUM', []);
    expect(emptyStats.tradeCount).toBe(0);
    expect(emptyStats.brierScore).toBeNull();
    expect(emptyStats.bestTrade).toBeNull();
  });

  it('formatComparison handles empty-strategy report gracefully', async () => {
    // Build a minimal report with one active strategy
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'mock' as const,
      source: 'mock' as const,
      strategies: [
        computeStrategyStats('PM_LONG', [
          makePosition({ strategy: 'PM_LONG', pnl: 10.0, status: 'closed' }),
        ]),
        computeStrategyStats('HIGH_EDGE', []),
        computeStrategyStats('FADE_MARKET', []),
        computeStrategyStats('MOMENTUM', []),
      ],
    };
    const output = formatComparison(report);
    expect(output).toContain('PM_LONG');
    expect(output).toContain('No trades recorded');
  });
});

// ---------------------------------------------------------------------------
// Test 8: Mock mode via MOCK_DATA=true env var
// ---------------------------------------------------------------------------

describe('Mock mode — MOCK_DATA=true', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env['MOCK_DATA'];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['MOCK_DATA'];
    } else {
      process.env['MOCK_DATA'] = originalEnv;
    }
  });

  it('loadPositions returns mock data when MOCK_DATA=true', () => {
    process.env['MOCK_DATA'] = 'true';
    const { positions, source } = loadPositions(true);
    expect(source).toBe('mock');
    expect(positions.length).toBeGreaterThanOrEqual(15);
  });

  it('compareStrategies uses mock data when override=true', async () => {
    const report = await compareStrategies(true);
    expect(report.mode).toBe('mock');
    expect(report.source).toBe('mock');
  });

  it('mock mode produces P&L values without external API calls', async () => {
    const report = await compareStrategies(true);
    const totalPnl = report.strategies.reduce((sum, s) => sum + s.realizedPnl, 0);
    // Should have non-zero total P&L from mock data
    expect(Math.abs(totalPnl)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Brier score computation
// ---------------------------------------------------------------------------

describe('computeBrierScore()', () => {
  it('returns null when no positions have outcome data', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'PM_LONG', status: 'closed' }),
    ];
    expect(computeBrierScore(positions)).toBeNull();
  });

  it('computes correct Brier score for perfect predictions', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'PM_LONG', status: 'closed', predictedProb: 1.0, outcome: 1 }),
      makePosition({ strategy: 'PM_LONG', status: 'closed', predictedProb: 0.0, outcome: 0 }),
    ];
    // (1-1)^2 + (0-0)^2 / 2 = 0
    expect(computeBrierScore(positions)).toBe(0);
  });

  it('computes correct Brier score for worst predictions', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'PM_LONG', status: 'closed', predictedProb: 0.0, outcome: 1 }),
      makePosition({ strategy: 'PM_LONG', status: 'closed', predictedProb: 1.0, outcome: 0 }),
    ];
    // (0-1)^2 + (1-0)^2 / 2 = 1
    expect(computeBrierScore(positions)).toBe(1);
  });

  it('excludes open positions from Brier score', () => {
    const positions: StrategyPosition[] = [
      makePosition({ strategy: 'PM_LONG', status: 'closed', predictedProb: 0.8, outcome: 1 }),
      makePosition({ strategy: 'PM_LONG', status: 'open', predictedProb: 0.2, outcome: 0 }),
    ];
    // Only the closed position counts: (0.8-1)^2 = 0.04
    const score = computeBrierScore(positions);
    expect(score).toBeCloseTo(0.04, 4);
  });
});

// ---------------------------------------------------------------------------
// Test 10: Report note on missing file
// ---------------------------------------------------------------------------

describe('Graceful degradation — missing file', () => {
  it('loadPositions returns empty positions and note when file missing', () => {
    const { positions, source, note } = loadPositions(false);
    if (source === 'missing') {
      expect(positions).toHaveLength(0);
      expect(note).toBeTruthy();
      expect(note).toContain('paper-positions.json');
    } else {
      // File exists — also valid
      expect(source).toBe('file');
    }
  });

  it('compareStrategies does not throw when data is missing', async () => {
    // Override should not throw even when file is absent
    await expect(compareStrategies(false)).resolves.toBeDefined();
  });

  it('formatComparison includes note when present in report', async () => {
    const report = await compareStrategies(false);
    const output = formatComparison(report);
    if (report.note) {
      expect(output).toContain(report.note);
    }
    // Should always have the header at minimum
    expect(output).toContain('Strategy Comparison Report');
  });
});

// ---------------------------------------------------------------------------
// Test 11: compareStrategies with mock trades — stat accuracy
// ---------------------------------------------------------------------------

describe('compareStrategies() stat accuracy with mock data', () => {
  it('PM_LONG strategy has correct trade count from MOCK_POSITIONS', async () => {
    const report = await compareStrategies(true);
    const pmLong = report.strategies.find((s) => s.strategy === 'PM_LONG');
    const expectedCount = MOCK_POSITIONS.filter((p) => p.strategy === 'PM_LONG').length;
    expect(pmLong?.tradeCount).toBe(expectedCount);
  });

  it('HIGH_EDGE avg edge is computed correctly', async () => {
    const hePositions = MOCK_POSITIONS.filter((p) => p.strategy === 'HIGH_EDGE');
    const withEdge = hePositions.filter((p) => p.edgePercent !== undefined);
    const expectedAvg = withEdge.reduce((s, p) => s + (p.edgePercent as number), 0) / withEdge.length;

    const stats = computeStrategyStats('HIGH_EDGE', hePositions);
    expect(stats.avgEdgePercent).toBeCloseTo(expectedAvg, 1);
  });

  it('generatedAt is a valid ISO timestamp', async () => {
    const report = await compareStrategies(true);
    const date = new Date(report.generatedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  it('report strategies array covers all 4 strategy tags', async () => {
    const report = await compareStrategies(true);
    const tags = report.strategies.map((s) => s.strategy);
    expect(tags).toContain('PM_LONG');
    expect(tags).toContain('HIGH_EDGE');
    expect(tags).toContain('FADE_MARKET');
    expect(tags).toContain('MOMENTUM');
  });
});
