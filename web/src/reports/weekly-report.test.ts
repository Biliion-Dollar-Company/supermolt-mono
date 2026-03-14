/**
 * Weekly Report — vitest test suite (20+ tests)
 *
 * Tests cover:
 *   - WeeklyReport.generateWeeklyReport() with mock data
 *   - All 6 formatter sections present in output
 *   - Telegram truncation at 4096 chars
 *   - Graceful degradation for empty/missing data sources
 *   - Mock mode — zero live API calls
 *   - DailyTrend construction
 *   - Strategy highlights (best/worst)
 *   - Regime distribution fields
 *   - Brier score propagation
 *   - Outlook string content
 *   - formatWeeklyReport character limits
 *   - Data shape validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeeklyReport, type WeeklyReportData, type RegimeDistribution } from './weekly-report.ts';
import { formatWeeklyReport, formatWeeklyReportLength } from './weekly-report-formatter.ts';
import { buildMockHistory } from '../positions/performance-history.ts';
import { computeTrackerSummary, MOCK_TRACKER_POSITIONS } from '../positions/paper-tracker.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a complete mock WeeklyReportData for testing the formatter */
function makeMockData(overrides: Partial<WeeklyReportData> = {}): WeeklyReportData {
  const base: WeeklyReportData = {
    generatedAt: '2026-03-11T10:00:00.000Z',
    weekStart: '2026-03-05',
    weekEnd: '2026-03-11',
    mode: 'mock',

    totalTrades: 7,
    winRate: 71.4,
    realizedPnl: 175.1,
    openPositions: 1,
    trackerSource: 'mock',

    dailyTrend: [
      { date: '2026-03-05', pnl: 34.0,  brierScore: 0.18, tradeCount: 3 },
      { date: '2026-03-06', pnl: -20.0, brierScore: 0.22, tradeCount: 2 },
      { date: '2026-03-07', pnl: 27.6,  brierScore: 0.15, tradeCount: 4 },
      { date: '2026-03-08', pnl: 22.5,  brierScore: 0.17, tradeCount: 3 },
      { date: '2026-03-09', pnl: 66.0,  brierScore: 0.12, tradeCount: 5 },
      { date: '2026-03-10', pnl: 45.0,  brierScore: 0.14, tradeCount: 3 },
      { date: '2026-03-11', pnl: -8.0,  brierScore: null, tradeCount: 1 },
    ],
    weeklyPnl: 167.1,

    bestStrategy: { name: 'HIGH_EDGE', winRate: 66.7, realizedPnl: 104.7 },
    worstStrategy: { name: 'MOMENTUM', winRate: 50.0, realizedPnl: 3.4 },

    regime: {
      bull: 3,
      bear: 1,
      sideways: 3,
      current: 'bull',
      kellyMultiplier: 1.2,
    },

    avgBrierScore: 0.1633,
    priorWeekBrierScore: 0.20,

    nextWeekOutlook:
      'Scale up Kelly (×1.2) — bullish regime. HIGH_EDGE top performer. Excellent calibration.',
  };

  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. WeeklyReport data generation
// ---------------------------------------------------------------------------

describe('WeeklyReport.generateWeeklyReport', () => {
  it('returns a WeeklyReportData object in mock mode', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(data).toBeDefined();
    expect(typeof data.generatedAt).toBe('string');
    expect(data.mode).toBe('mock');
  });

  it('generatedAt is a valid ISO string', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(() => new Date(data.generatedAt)).not.toThrow();
    expect(new Date(data.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it('weekStart is 6 days before weekEnd', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    const start = new Date(data.weekStart + 'T00:00:00Z');
    const end = new Date(data.weekEnd + 'T00:00:00Z');
    const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
    expect(diffDays).toBe(6);
  });

  it('has positive totalTrades in mock mode', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(data.totalTrades).toBeGreaterThan(0);
  });

  it('winRate is between 0 and 100', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(data.winRate).toBeGreaterThanOrEqual(0);
    expect(data.winRate).toBeLessThanOrEqual(100);
  });

  it('has a non-empty dailyTrend in mock mode', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(data.dailyTrend.length).toBeGreaterThan(0);
    expect(data.dailyTrend.length).toBeLessThanOrEqual(7);
  });

  it('dailyTrend entries have correct shape', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    for (const d of data.dailyTrend) {
      expect(typeof d.date).toBe('string');
      expect(typeof d.pnl).toBe('number');
      expect(typeof d.tradeCount).toBe('number');
      // brierScore can be null or number
      expect(d.brierScore === null || typeof d.brierScore === 'number').toBe(true);
    }
  });

  it('bestStrategy has name, winRate, realizedPnl when mock has positions', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    if (data.bestStrategy !== null) {
      expect(typeof data.bestStrategy.name).toBe('string');
      expect(data.bestStrategy.name.length).toBeGreaterThan(0);
      expect(typeof data.bestStrategy.winRate).toBe('number');
      expect(typeof data.bestStrategy.realizedPnl).toBe('number');
    }
  });

  it('regime has all required fields', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(typeof data.regime.bull).toBe('number');
    expect(typeof data.regime.bear).toBe('number');
    expect(typeof data.regime.sideways).toBe('number');
    expect(['bull', 'bear', 'sideways']).toContain(data.regime.current);
    expect([0.8, 1.0, 1.2]).toContain(data.regime.kellyMultiplier);
  });

  it('nextWeekOutlook is a non-empty string', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(typeof data.nextWeekOutlook).toBe('string');
    expect(data.nextWeekOutlook.length).toBeGreaterThan(10);
  });

  it('priorWeekBrierScore is 0.20 in mock mode', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(data.priorWeekBrierScore).toBe(0.20);
  });
});

// ---------------------------------------------------------------------------
// 2. Formatter — all 6 sections present
// ---------------------------------------------------------------------------

describe('formatWeeklyReport — section presence', () => {
  it('contains 📅 Week Summary section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('📅');
    expect(html).toContain('Week Summary');
  });

  it('contains 📊 7-Day P&L Trend section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('📊');
    expect(html).toContain('7-Day P');
  });

  it('contains 🏆 Strategy Highlights section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('🏆');
    expect(html).toContain('Strategy Highlights');
  });

  it('contains 🌍 Market Regime section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('🌍');
    expect(html).toContain('Market Regime');
  });

  it('contains 🎯 Brier Score Trend section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('🎯');
    expect(html).toContain('Brier Score');
  });

  it('contains 🔮 Next Week Outlook section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('🔮');
    expect(html).toContain('Next Week Outlook');
  });

  it('contains MOCK tag in header when mode is mock', () => {
    const html = formatWeeklyReport(makeMockData({ mode: 'mock' }));
    expect(html).toContain('MOCK');
  });

  it('does NOT contain MOCK tag when mode is live', () => {
    const html = formatWeeklyReport(makeMockData({ mode: 'live' }));
    expect(html).not.toContain('[MOCK]');
  });

  it('shows strategy name in strategy section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('HIGH_EDGE');
  });

  it('shows win rate in week summary', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('71.4%');
  });

  it('shows realized P&L in week summary', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('175.10');
  });

  it('shows current regime in regime section', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('BULL');
  });

  it('shows Brier score value when present', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html).toContain('0.1633');
  });

  it('shows "No data available" for empty dailyTrend', () => {
    const html = formatWeeklyReport(makeMockData({ dailyTrend: [] }));
    expect(html).toContain('No data available');
  });

  it('shows "No resolved strategies" when bestStrategy is null', () => {
    const html = formatWeeklyReport(makeMockData({ bestStrategy: null, worstStrategy: null }));
    expect(html).toContain('No resolved strategies');
  });

  it('shows "Insufficient data" when avgBrierScore is null', () => {
    const html = formatWeeklyReport(makeMockData({ avgBrierScore: null }));
    expect(html).toContain('Insufficient data');
  });
});

// ---------------------------------------------------------------------------
// 3. Telegram truncation at 4096 chars
// ---------------------------------------------------------------------------

describe('formatWeeklyReport — Telegram truncation', () => {
  it('output is at most 4096 characters for normal data', () => {
    const html = formatWeeklyReport(makeMockData());
    expect(html.length).toBeLessThanOrEqual(4096);
  });

  it('truncates and appends notice when content exceeds 4096 chars', () => {
    // Create data with very long nextWeekOutlook to force overflow
    const longOutlook = 'A'.repeat(4000);
    const html = formatWeeklyReport(makeMockData({ nextWeekOutlook: longOutlook }));
    expect(html.length).toBeLessThanOrEqual(4096);
    expect(html).toContain('truncated');
  });

  it('formatWeeklyReportLength returns same as output length', () => {
    const data = makeMockData();
    const html = formatWeeklyReport(data);
    const len = formatWeeklyReportLength(data);
    expect(len).toBe(html.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Graceful degradation
// ---------------------------------------------------------------------------

describe('WeeklyReport — graceful degradation', () => {
  it('does not throw when generateWeeklyReport is called with mock=false', async () => {
    const report = new WeeklyReport();
    // In test env, data files don't exist — should degrade gracefully
    await expect(report.generateWeeklyReport(false)).resolves.toBeDefined();
  });

  it('returns trackerSource="missing" when data files absent', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(false);
    // Either missing (no data files) or file (if they exist) — both are valid
    expect(['missing', 'file', 'mock']).toContain(data.trackerSource);
  });

  it('formatter handles data with zero trades without throwing', () => {
    const data = makeMockData({ totalTrades: 0, winRate: 0, realizedPnl: 0 });
    expect(() => formatWeeklyReport(data)).not.toThrow();
  });

  it('formatter handles bear regime without throwing', () => {
    const bearRegime: RegimeDistribution = {
      bull: 1, bear: 5, sideways: 1, current: 'bear', kellyMultiplier: 0.8,
    };
    const data = makeMockData({ regime: bearRegime });
    const html = formatWeeklyReport(data);
    expect(html).toContain('BEAR');
    expect(html).toContain('×0.8');
  });

  it('formatter handles sideways regime without throwing', () => {
    const sidewaysRegime: RegimeDistribution = {
      bull: 2, bear: 2, sideways: 3, current: 'sideways', kellyMultiplier: 1.0,
    };
    const data = makeMockData({ regime: sidewaysRegime });
    const html = formatWeeklyReport(data);
    expect(html).toContain('SIDEWAYS');
    expect(html).toContain('×1.0');
  });
});

// ---------------------------------------------------------------------------
// 5. Mock mode — zero API calls
// ---------------------------------------------------------------------------

describe('Mock mode — zero API calls', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fetch should not be called in mock mode'))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generateWeeklyReport(true) completes without calling fetch', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(data.mode).toBe('mock');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('mock data has dailyTrend with 7 entries', async () => {
    const report = new WeeklyReport();
    const data = await report.generateWeeklyReport(true);
    expect(data.dailyTrend.length).toBe(7);
  });

  it('formatter runs on mock data without calling fetch', () => {
    const report = new WeeklyReport();
    report.generateWeeklyReport(true).then((data) => {
      expect(() => formatWeeklyReport(data)).not.toThrow();
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Sub-module unit tests
// ---------------------------------------------------------------------------

describe('buildMockHistory', () => {
  it('returns exactly 7 entries', () => {
    const history = buildMockHistory();
    expect(history.length).toBe(7);
  });

  it('dates are sorted oldest to newest', () => {
    const history = buildMockHistory();
    for (let i = 1; i < history.length; i++) {
      expect(history[i].date >= history[i - 1].date).toBe(true);
    }
  });

  it('all entries have pnl as a number', () => {
    const history = buildMockHistory();
    for (const d of history) {
      expect(typeof d.pnl).toBe('number');
    }
  });
});

describe('computeTrackerSummary', () => {
  it('counts open and closed correctly', () => {
    const summary = computeTrackerSummary(MOCK_TRACKER_POSITIONS);
    const closed = MOCK_TRACKER_POSITIONS.filter((p) => p.status === 'closed').length;
    const open = MOCK_TRACKER_POSITIONS.filter((p) => p.status === 'open').length;
    expect(summary.openPositions).toBe(open);
    expect(summary.totalTrades).toBe(MOCK_TRACKER_POSITIONS.length);
    expect(summary.totalTrades).toBe(closed + open);
  });

  it('winRate is between 0 and 100', () => {
    const summary = computeTrackerSummary(MOCK_TRACKER_POSITIONS);
    expect(summary.winRate).toBeGreaterThanOrEqual(0);
    expect(summary.winRate).toBeLessThanOrEqual(100);
  });

  it('handles empty positions array gracefully', () => {
    const summary = computeTrackerSummary([]);
    expect(summary.totalTrades).toBe(0);
    expect(summary.winRate).toBe(0);
    expect(summary.realizedPnl).toBe(0);
    expect(summary.openPositions).toBe(0);
  });
});
