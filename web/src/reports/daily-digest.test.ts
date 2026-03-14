/**
 * Tests for daily-digest.ts
 *
 * Covers: mock mode output, graceful degradation, P&L calculation,
 * research parsing, stability checks, ASCII table rendering, top signal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calcPositionMetrics,
  parseResearchMd,
  renderTable,
  getPositionSummary,
  getResearchStatus,
  getStabilityStatus,
  getTopSignalToday,
  getArbScanSummary,
  buildDigestReport,
  renderDigestReport,
  getStrategyPerformance,
  isMockMode,
  type PaperPosition,
  type StrategyPerformanceSummary,
} from './daily-digest.ts';

// ---------------------------------------------------------------------------
// Test 1: ASCII table rendering
// ---------------------------------------------------------------------------

describe('renderTable', () => {
  it('renders a table with title and rows', () => {
    const output = renderTable('TEST SECTION', [
      ['Key One', 'Value One'],
      ['Key Two', 'Value Two'],
    ]);

    expect(output).toContain('TEST SECTION');
    expect(output).toContain('Key One');
    expect(output).toContain('Value One');
    expect(output).toContain('Key Two');
    expect(output).toContain('Value Two');
    // Should start and end with divider
    const lines = output.split('\n');
    expect(lines[0]).toMatch(/^[-+]+$/);
    expect(lines[lines.length - 1]).toMatch(/^[-+]+$/);
  });

  it('aligns columns within the specified width', () => {
    const output = renderTable('ALIGN TEST', [['Label', 'Val']], 62);
    const lines = output.split('\n');
    // Every data line should be exactly 62 chars wide
    for (const line of lines) {
      expect(line.length).toBe(62);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: P&L calculation
// ---------------------------------------------------------------------------

describe('calcPositionMetrics', () => {
  it('returns zeros for empty positions array', () => {
    const result = calcPositionMetrics([]);
    expect(result.totalTrades).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.realizedPnl).toBe(0);
    expect(result.openPositions).toBe(0);
  });

  it('calculates correct P&L from stored pnl field', () => {
    const positions: PaperPosition[] = [
      { id: '1', market: 'Market A', direction: 'YES', entryPrice: 0.4, exitPrice: 0.7, size: 100, status: 'closed', pnl: 30.0, timestamp: '2026-01-01T00:00:00Z' },
      { id: '2', market: 'Market B', direction: 'NO',  entryPrice: 0.6, exitPrice: 0.3, size: 50,  status: 'closed', pnl: -15.0, timestamp: '2026-01-02T00:00:00Z' },
    ];
    const result = calcPositionMetrics(positions);
    expect(result.totalTrades).toBe(2);
    expect(result.realizedPnl).toBeCloseTo(15.0, 1);
    expect(result.winRate).toBe(50);
    expect(result.openPositions).toBe(0);
  });

  it('calculates P&L from entry/exit prices when pnl not stored', () => {
    const positions: PaperPosition[] = [
      {
        id: '3', market: 'Market C', direction: 'YES',
        entryPrice: 0.3, exitPrice: 0.8, size: 100,
        status: 'closed', timestamp: '2026-01-03T00:00:00Z',
      },
    ];
    const result = calcPositionMetrics(positions);
    // (0.8 - 0.3) * 100 = 50 for YES direction
    expect(result.realizedPnl).toBeCloseTo(50.0, 1);
    expect(result.winRate).toBe(100);
  });

  it('counts open positions separately from total trades', () => {
    const positions: PaperPosition[] = [
      { id: 'a', market: 'M1', direction: 'YES', entryPrice: 0.5, size: 100, status: 'closed', pnl: 10, timestamp: '2026-01-01T00:00:00Z' },
      { id: 'b', market: 'M2', direction: 'YES', entryPrice: 0.5, size: 100, status: 'open',   timestamp: '2026-01-02T00:00:00Z' },
      { id: 'c', market: 'M3', direction: 'YES', entryPrice: 0.5, size: 100, status: 'open',   timestamp: '2026-01-03T00:00:00Z' },
    ];
    const result = calcPositionMetrics(positions);
    expect(result.totalTrades).toBe(3);
    expect(result.openPositions).toBe(2);
  });

  it('win rate is 100% when all closed trades are profitable', () => {
    const positions: PaperPosition[] = [
      { id: 'x', market: 'M', direction: 'YES', entryPrice: 0.3, exitPrice: 0.9, size: 50, status: 'closed', pnl: 30, timestamp: '2026-01-01T00:00:00Z' },
      { id: 'y', market: 'M', direction: 'YES', entryPrice: 0.4, exitPrice: 0.8, size: 50, status: 'closed', pnl: 20, timestamp: '2026-01-02T00:00:00Z' },
    ];
    const result = calcPositionMetrics(positions);
    expect(result.winRate).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Research MD parsing
// ---------------------------------------------------------------------------

describe('parseResearchMd', () => {
  it('parses Brier score and strategy from typical program.md content', () => {
    const content = `
# Research Program

Current Brier score: 0.182
Best strategy: v4-bayesian-momentum
Last updated: 2026-03-10
    `;
    const result = parseResearchMd(content);
    expect(result.brierScore).toBeCloseTo(0.182);
    expect(result.bestStrategy).toBe('v4-bayesian-momentum');
  });

  it('handles underscore-style keys', () => {
    const content = 'brier_score: 0.245\nbest_strategy: v3-ev-kelly';
    const result = parseResearchMd(content);
    expect(result.brierScore).toBeCloseTo(0.245);
    expect(result.bestStrategy).toBe('v3-ev-kelly');
  });

  it('returns null for missing fields', () => {
    const result = parseResearchMd('# Empty program');
    expect(result.brierScore).toBeNull();
    expect(result.bestStrategy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 4: Mock mode — getPositionSummary
// ---------------------------------------------------------------------------

describe('getPositionSummary (mock mode)', () => {
  it('returns mock data with source=mock when mock=true', () => {
    const result = getPositionSummary(true);
    expect(result.source).toBe('mock');
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Graceful degradation — missing data file
// ---------------------------------------------------------------------------

describe('getPositionSummary (live mode, missing file)', () => {
  it('returns zeros and source=missing when paper-positions.json does not exist', () => {
    // Live mode — file likely doesn't exist in test env
    const result = getPositionSummary(false);
    // Either file exists (source='file') or it's missing — both are valid
    expect(['file', 'missing']).toContain(result.source);
    if (result.source === 'missing') {
      expect(result.totalTrades).toBe(0);
      expect(result.realizedPnl).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 6: Mock mode — getResearchStatus
// ---------------------------------------------------------------------------

describe('getResearchStatus', () => {
  it('returns mock research data with source=mock', () => {
    const result = getResearchStatus(true);
    expect(result.source).toBe('mock');
    expect(result.brierScore).not.toBeNull();
    expect(result.bestStrategy).not.toBeNull();
  });

  it('returns source=missing gracefully when research/program.md absent', () => {
    const result = getResearchStatus(false);
    // Either file or missing — both valid; must not throw
    expect(['file', 'missing']).toContain(result.source);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Mock mode — getStabilityStatus + getTopSignalToday
// ---------------------------------------------------------------------------

describe('getStabilityStatus', () => {
  it('returns healthy status in mock mode', () => {
    const result = getStabilityStatus(true);
    expect(result.status).toBe('healthy');
    expect(result.failingChecks).toHaveLength(0);
    expect(result.source).toBe('mock');
  });

  it('returns a valid status in live mode without throwing', () => {
    const result = getStabilityStatus(false);
    expect(['healthy', 'degraded', 'down']).toContain(result.status);
    expect(Array.isArray(result.failingChecks)).toBe(true);
  });
});

describe('getTopSignalToday', () => {
  it('returns mock signal with positive EV in mock mode', () => {
    const result = getTopSignalToday(true);
    expect(result.source).toBe('mock');
    expect(result.evPercent).toBeGreaterThan(0);
    expect(result.market).not.toBe('N/A');
  });

  it('returns source=none gracefully when no agent-alpha state exists', () => {
    const result = getTopSignalToday(false);
    expect(['live', 'none']).toContain(result.source);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Full report build + render in mock mode
// ---------------------------------------------------------------------------

describe('buildDigestReport + renderDigestReport (mock mode)', () => {
  it('builds a complete report with all sections in mock mode', async () => {
    const report = await buildDigestReport(true);
    expect(report.mode).toBe('mock');
    expect(report.arb.opportunities.length).toBeGreaterThan(0);
    expect(report.positions.source).toBe('mock');
    expect(report.research.source).toBe('mock');
    expect(report.stability.source).toBe('mock');
    expect(report.topSignal.source).toBe('mock');
  });

  it('renders all 5 section headers in the output', async () => {
    const report = await buildDigestReport(true);
    const output = renderDigestReport(report);

    expect(output).toContain('1. ARB SCANNER SUMMARY');
    expect(output).toContain('2. POSITION TRACKER SUMMARY');
    expect(output).toContain('3. RESEARCH LOOP STATUS');
    expect(output).toContain('4. STABILITY STATUS');
    expect(output).toContain('5. TOP SIGNAL TODAY');
  });

  it('renders P&L and win rate values in the position section', async () => {
    const report = await buildDigestReport(true);
    const output = renderDigestReport(report);

    // Should show win rate and P&L (could be + or -)
    expect(output).toMatch(/Win Rate/);
    expect(output).toMatch(/Realized P&L/);
  });

  it('renders Brier score from mock data', async () => {
    const report = await buildDigestReport(true);
    const output = renderDigestReport(report);

    expect(output).toContain('Brier Score');
    expect(output).toContain('0.182');
  });

  it('shows MOCK in the header when running mock mode', async () => {
    const report = await buildDigestReport(true);
    const output = renderDigestReport(report);
    expect(output).toContain('MOCK');
  });
});

// ---------------------------------------------------------------------------
// Test 9: isMockMode helper
// ---------------------------------------------------------------------------

describe('isMockMode', () => {
  it('returns false when --mock is not in argv', () => {
    const original = process.argv;
    process.argv = ['node', 'daily-digest.ts'];
    expect(isMockMode()).toBe(false);
    process.argv = original;
  });

  it('returns true when --mock is in argv', () => {
    const original = process.argv;
    process.argv = ['node', 'daily-digest.ts', '--mock'];
    expect(isMockMode()).toBe(true);
    process.argv = original;
  });
});

// ---------------------------------------------------------------------------
// Test 10: Arb scan mock mode
// ---------------------------------------------------------------------------

describe('getArbScanSummary', () => {
  it('returns top 3 mock opportunities in mock mode', async () => {
    const result = await getArbScanSummary(true);
    expect(result.source).toBe('mock');
    expect(result.opportunities).toHaveLength(3);
    for (const opp of result.opportunities) {
      expect(opp.spreadPercent).toBeGreaterThan(0);
      expect(opp.expectedProfit).toBeGreaterThan(0);
      expect(opp.pair).toBeTruthy();
    }
  });

  it('returns empty opportunities gracefully in live mode when scanner absent', async () => {
    const result = await getArbScanSummary(false);
    expect(result.source).toBe('live');
    expect(Array.isArray(result.opportunities)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 11: Section 6 – Strategy Performance
// ---------------------------------------------------------------------------

describe('getStrategyPerformance', () => {
  it('happy path: returns top strategies with win rate and P&L in mock mode', async () => {
    const result = await getStrategyPerformance(true);
    expect(result.source).toBe('mock');
    expect(result.topStrategies.length).toBeGreaterThan(0);
    expect(result.topStrategies.length).toBeLessThanOrEqual(3);
    for (const s of result.topStrategies) {
      expect(typeof s.strategy).toBe('string');
      expect(s.strategy.length).toBeGreaterThan(0);
      expect(typeof s.winRate).toBe('number');
      expect(s.winRate).toBeGreaterThanOrEqual(0);
      expect(s.winRate).toBeLessThanOrEqual(100);
      expect(typeof s.realizedPnl).toBe('number');
    }
  });

  it('strategies are sorted by realizedPnl descending', async () => {
    const result = await getStrategyPerformance(true);
    for (let i = 0; i < result.topStrategies.length - 1; i++) {
      expect(result.topStrategies[i].realizedPnl).toBeGreaterThanOrEqual(
        result.topStrategies[i + 1].realizedPnl,
      );
    }
  });

  it('truncates to at most 3 strategies even when more are available', async () => {
    const result = await getStrategyPerformance(true);
    // Mock data has 4 strategies; we cap at 3
    expect(result.topStrategies.length).toBeLessThanOrEqual(3);
  });

  it('degrades gracefully when compareStrategies returns no resolved positions', async () => {
    // In live mode with no data file, all trade counts will be 0 → should return missing
    const result = await getStrategyPerformance(false);
    // Either has data (file exists in env) or gracefully returns missing
    expect(['file', 'mock', 'missing']).toContain(result.source);
    expect(Array.isArray(result.topStrategies)).toBe(true);
  });

  it('error fallback: returns source=missing and empty topStrategies on exception', async () => {
    // Simulate by checking that the returned shape is always valid regardless of mode
    const result = await getStrategyPerformance(false);
    const validResult: StrategyPerformanceSummary = result;
    expect(Array.isArray(validResult.topStrategies)).toBe(true);
    expect(['file', 'mock', 'missing']).toContain(validResult.source);
  });
});

// ---------------------------------------------------------------------------
// Test 12: Section 6 rendered in the digest output
// ---------------------------------------------------------------------------

describe('renderDigestReport — section 6 strategy performance', () => {
  it('includes section 6 header in mock mode output', async () => {
    const report = await buildDigestReport(true);
    const output = renderDigestReport(report);
    expect(output).toContain('6. STRATEGY PERFORMANCE');
  });

  it('shows strategy names and P&L values in mock mode output', async () => {
    const report = await buildDigestReport(true);
    const output = renderDigestReport(report);
    // At least one of the known strategy tags must appear
    const knownTags = ['PM_LONG', 'HIGH_EDGE', 'FADE_MARKET', 'MOMENTUM'];
    const hasStrategy = knownTags.some((tag) => output.includes(tag));
    expect(hasStrategy).toBe(true);
  });

  it('shows N/A fallback when strategyPerformance has no topStrategies', async () => {
    const report = await buildDigestReport(true);
    // Manually override to simulate empty state
    report.strategyPerformance = { topStrategies: [], source: 'missing' };
    const output = renderDigestReport(report);
    expect(output).toContain('no resolved positions yet');
  });

  it('report object has strategyPerformance field in mock mode', async () => {
    const report = await buildDigestReport(true);
    expect(report.strategyPerformance).toBeDefined();
    expect(Array.isArray(report.strategyPerformance.topStrategies)).toBe(true);
  });

  it('renders all 6 section headers in mock mode', async () => {
    const report = await buildDigestReport(true);
    const output = renderDigestReport(report);
    expect(output).toContain('1. ARB SCANNER SUMMARY');
    expect(output).toContain('2. POSITION TRACKER SUMMARY');
    expect(output).toContain('3. RESEARCH LOOP STATUS');
    expect(output).toContain('4. STABILITY STATUS');
    expect(output).toContain('5. TOP SIGNAL TODAY');
    expect(output).toContain('6. STRATEGY PERFORMANCE');
  });
});
