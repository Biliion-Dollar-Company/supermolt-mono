/**
 * Tests for Portfolio Exposure Aggregator
 *
 * 25+ Vitest tests covering:
 *  - Empty positions → LOW risk
 *  - Category domination → HIGH risk
 *  - Balanced portfolio → LOW risk
 *  - Single position > 25% → CLOSE action
 *  - categorizeMarket keyword routing
 *  - EV accuracy for YES/NO sides
 *  - Rebalance suggested sizes (REDUCE = 0.6x)
 *  - riskLevel thresholds
 *  - Dashboard integration
 */

import { describe, it, expect } from 'vitest';
import {
  categorizeMarket,
  aggregateExposure,
  formatExposureReport,
  type ActivePosition,
} from './exposure-aggregator.ts';
import { generateRiskDashboard, formatRiskDashboard } from '../reports/risk-dashboard.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePosition(
  overrides: Partial<ActivePosition> & { id: string; market: string; size: number },
): ActivePosition {
  return {
    id: overrides.id,
    market: overrides.market,
    direction: overrides.direction ?? 'YES',
    entryPrice: overrides.entryPrice ?? 0.5,
    size: overrides.size,
    status: 'open',
    predictedProb: overrides.predictedProb ?? overrides.entryPrice ?? 0.5,
    strategy: overrides.strategy ?? 'TEST',
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// categorizeMarket
// ---------------------------------------------------------------------------

describe('categorizeMarket', () => {
  it('classifies bitcoin as crypto', () => {
    expect(categorizeMarket('Will Bitcoin hit $100k?')).toBe('crypto');
  });

  it('classifies ethereum as crypto', () => {
    expect(categorizeMarket('Ethereum surpasses $5000')).toBe('crypto');
  });

  it('classifies BTC (uppercase) as crypto', () => {
    expect(categorizeMarket('BTC dominance above 60%')).toBe('crypto');
  });

  it('classifies SOL as crypto', () => {
    expect(categorizeMarket('SOL reaches $500 by Q4')).toBe('crypto');
  });

  it('classifies DeFi as crypto', () => {
    expect(categorizeMarket('Top DeFi protocol by TVL')).toBe('crypto');
  });

  it('classifies election as politics', () => {
    expect(categorizeMarket('2024 presidential election winner')).toBe('politics');
  });

  it('classifies trump as politics', () => {
    expect(categorizeMarket('Trump signs executive order on AI')).toBe('politics');
  });

  it('classifies senate as politics', () => {
    expect(categorizeMarket('Senate passes infrastructure bill')).toBe('politics');
  });

  it('classifies NBA as sports', () => {
    expect(categorizeMarket('NBA Finals winner 2025')).toBe('sports');
  });

  it('classifies world cup as sports', () => {
    expect(categorizeMarket('World Cup champion 2026')).toBe('sports');
  });

  it('classifies fed as macro', () => {
    expect(categorizeMarket('Fed cuts rates in March')).toBe('macro');
  });

  it('classifies inflation as macro', () => {
    expect(categorizeMarket('US CPI inflation above 3%')).toBe('macro');
  });

  it('classifies GDP as macro', () => {
    expect(categorizeMarket('US GDP growth exceeds 2.5% Q1')).toBe('macro');
  });

  it('falls back to other for unrecognized topics', () => {
    expect(categorizeMarket('Will it rain in Paris next week?')).toBe('other');
  });

  it('is case-insensitive for matching', () => {
    expect(categorizeMarket('ETHEREUM 2.0 staking rewards')).toBe('crypto');
  });
});

// ---------------------------------------------------------------------------
// aggregateExposure — empty / zero cases
// ---------------------------------------------------------------------------

describe('aggregateExposure — empty positions', () => {
  it('returns LOW risk for empty array', () => {
    const report = aggregateExposure([]);
    expect(report.riskLevel).toBe('LOW');
  });

  it('returns 0 totalAllocated for empty array', () => {
    const report = aggregateExposure([]);
    expect(report.totalAllocated).toBe(0);
  });

  it('returns empty categoryBreakdown for empty array', () => {
    const report = aggregateExposure([]);
    expect(report.categoryBreakdown).toHaveLength(0);
  });

  it('returns no rebalanceActions for empty array', () => {
    const report = aggregateExposure([]);
    expect(report.rebalanceActions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// aggregateExposure — EV accuracy
// ---------------------------------------------------------------------------

describe('aggregateExposure — EV calculation', () => {
  it('calculates YES EV as size × probability', () => {
    const positions = [
      makePosition({ id: '1', market: 'BTC hits $100k', size: 100, direction: 'YES', predictedProb: 0.6 }),
    ];
    const report = aggregateExposure(positions);
    // EV = 100 × 0.6 = 60
    expect(report.totalEV).toBeCloseTo(60, 2);
  });

  it('calculates NO EV as size × (1 - probability)', () => {
    const positions = [
      makePosition({ id: '1', market: 'BTC hits $100k', size: 100, direction: 'NO', predictedProb: 0.6 }),
    ];
    const report = aggregateExposure(positions);
    // EV = 100 × (1 - 0.6) = 40
    expect(report.totalEV).toBeCloseTo(40, 2);
  });

  it('sums EV across multiple positions', () => {
    const positions = [
      makePosition({ id: '1', market: 'BTC hits $100k', size: 100, direction: 'YES', predictedProb: 0.5 }),
      makePosition({ id: '2', market: 'Fed cuts rate', size: 200, direction: 'YES', predictedProb: 0.4 }),
    ];
    const report = aggregateExposure(positions);
    // 100×0.5 + 200×0.4 = 50 + 80 = 130
    expect(report.totalEV).toBeCloseTo(130, 2);
  });
});

// ---------------------------------------------------------------------------
// aggregateExposure — risk levels
// ---------------------------------------------------------------------------

describe('aggregateExposure — riskLevel thresholds', () => {
  it('returns LOW risk for balanced portfolio', () => {
    // 4 categories, each ~25%
    const positions = [
      makePosition({ id: '1', market: 'BTC rally', size: 100 }),
      makePosition({ id: '2', market: 'Fed rate cut', size: 100 }),
      makePosition({ id: '3', market: 'NBA finals', size: 100 }),
      makePosition({ id: '4', market: 'Senate vote', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    expect(report.riskLevel).toBe('LOW');
  });

  it('returns MEDIUM risk when max category > 25% but <= 40%', () => {
    // crypto = 300/900 ≈ 33.3%, others split remainder
    const positions = [
      makePosition({ id: '1', market: 'BTC rally', size: 150 }),
      makePosition({ id: '2', market: 'ETH breakout', size: 150 }),
      makePosition({ id: '3', market: 'Fed rate cut', size: 200 }),
      makePosition({ id: '4', market: 'NBA finals', size: 200 }),
      makePosition({ id: '5', market: 'Senate vote', size: 200 }),
    ];
    const report = aggregateExposure(positions);
    expect(report.riskLevel).toBe('MEDIUM');
  });

  it('returns HIGH risk when category > 40% of portfolio', () => {
    // crypto = 500/700 ≈ 71.4%
    const positions = [
      makePosition({ id: '1', market: 'BTC rally', size: 250 }),
      makePosition({ id: '2', market: 'ETH breakout', size: 250 }),
      makePosition({ id: '3', market: 'Fed rate cut', size: 100 }),
      makePosition({ id: '4', market: 'NBA finals', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    expect(report.riskLevel).toBe('HIGH');
  });

  it('returns HIGH risk when single position > 25%', () => {
    // Single position = 300 out of 500 = 60%
    const positions = [
      makePosition({ id: '1', market: 'BTC rally', size: 300 }),
      makePosition({ id: '2', market: 'Fed rate cut', size: 100 }),
      makePosition({ id: '3', market: 'NBA finals', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    expect(report.riskLevel).toBe('HIGH');
  });
});

// ---------------------------------------------------------------------------
// aggregateExposure — rebalance actions
// ---------------------------------------------------------------------------

describe('aggregateExposure — rebalance actions', () => {
  it('generates CLOSE action for single position > 25% of portfolio', () => {
    const positions = [
      makePosition({ id: 'big1', market: 'BTC rally', size: 400 }),
      makePosition({ id: 'sm1', market: 'Fed rate cut', size: 100 }),
      makePosition({ id: 'sm2', market: 'NBA finals', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    const closeActions = report.rebalanceActions.filter((a) => a.action === 'CLOSE');
    expect(closeActions.length).toBeGreaterThan(0);
    const closedId = closeActions.find((a) => a.marketId === 'big1');
    expect(closedId).toBeDefined();
  });

  it('sets suggestedSize to 0 for CLOSE actions', () => {
    const positions = [
      makePosition({ id: 'big1', market: 'BTC rally', size: 400 }),
      makePosition({ id: 'sm1', market: 'Fed rate cut', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    const closeAction = report.rebalanceActions.find((a) => a.action === 'CLOSE');
    expect(closeAction?.suggestedSize).toBe(0);
  });

  it('generates REDUCE action for overweight category position', () => {
    // crypto dominates (> 40%), but each individual position is < 25% of total
    // 5 crypto positions × 80 = 400, others = 200. total = 600
    // each crypto = 80/600 = 13.3% < 25% → REDUCE (not CLOSE)
    // crypto category = 400/600 = 66.7% → overweight
    const positions = [
      makePosition({ id: 'c1', market: 'BTC rally', size: 80 }),
      makePosition({ id: 'c2', market: 'ETH breakout', size: 80 }),
      makePosition({ id: 'c3', market: 'Crypto token launch', size: 80 }),
      makePosition({ id: 'c4', market: 'DeFi protocol upgrade', size: 80 }),
      makePosition({ id: 'c5', market: 'NFT marketplace volume', size: 80 }),
      makePosition({ id: 'other1', market: 'Fed rate cut', size: 100 }),
      makePosition({ id: 'other2', market: 'NBA finals winner', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    const reduceActions = report.rebalanceActions.filter((a) => a.action === 'REDUCE');
    expect(reduceActions.length).toBeGreaterThan(0);
  });

  it('sets suggestedSize to 0.6x currentSize for REDUCE actions', () => {
    // crypto dominates, no single position > 25% of total (each = 300/700 ≈ 42.8% - oops, that's > 25%)
    // Let's make crypto dominate without any single > 25%
    const positions = [
      makePosition({ id: 'c1', market: 'BTC rally', size: 100 }),
      makePosition({ id: 'c2', market: 'ETH breakout', size: 100 }),
      makePosition({ id: 'c3', market: 'Crypto token launch', size: 100 }),
      makePosition({ id: 'c4', market: 'DeFi protocol upgrade', size: 100 }),
      makePosition({ id: 'other', market: 'Fed rate cut', size: 50 }),
    ];
    // crypto = 400/450 ≈ 88.9% — definitely overweight
    // each crypto position = 100/450 ≈ 22.2% < 25%, so REDUCE not CLOSE
    const report = aggregateExposure(positions);
    const reduceAction = report.rebalanceActions.find((a) => a.action === 'REDUCE');
    expect(reduceAction).toBeDefined();
    if (reduceAction) {
      expect(reduceAction.suggestedSize).toBeCloseTo(reduceAction.currentSize * 0.6, 1);
    }
  });

  it('flags overweightCategories when category > 40%', () => {
    const positions = [
      makePosition({ id: '1', market: 'BTC rally', size: 300 }),
      makePosition({ id: '2', market: 'ETH breakout', size: 300 }),
      makePosition({ id: '3', market: 'NBA finals', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    expect(report.overweightCategories).toContain('crypto');
  });

  it('no rebalance actions for perfectly balanced portfolio', () => {
    const positions = [
      makePosition({ id: '1', market: 'BTC rally', size: 100 }),
      makePosition({ id: '2', market: 'Fed rate cut', size: 100 }),
      makePosition({ id: '3', market: 'NBA finals', size: 100 }),
      makePosition({ id: '4', market: 'Senate vote', size: 100 }),
    ];
    const report = aggregateExposure(positions);
    expect(report.rebalanceActions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatExposureReport
// ---------------------------------------------------------------------------

describe('formatExposureReport', () => {
  it('returns a non-empty string', () => {
    const report = aggregateExposure([
      makePosition({ id: '1', market: 'BTC rally', size: 100 }),
    ]);
    const formatted = formatExposureReport(report);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('includes PORTFOLIO EXPOSURE REPORT header', () => {
    const report = aggregateExposure([]);
    const formatted = formatExposureReport(report);
    expect(formatted).toContain('PORTFOLIO EXPOSURE REPORT');
  });

  it('includes risk level in output', () => {
    const report = aggregateExposure([
      makePosition({ id: '1', market: 'BTC rally', size: 100 }),
      makePosition({ id: '2', market: 'Fed rate cut', size: 100 }),
    ]);
    const formatted = formatExposureReport(report);
    expect(formatted).toMatch(/Risk Level/i);
  });

  it('includes REBALANCE ACTIONS when present', () => {
    const positions = [
      makePosition({ id: 'big', market: 'BTC rally', size: 500 }),
      makePosition({ id: 'sm', market: 'Fed cut', size: 50 }),
    ];
    const report = aggregateExposure(positions);
    const formatted = formatExposureReport(report);
    expect(formatted).toContain('REBALANCE ACTIONS');
  });

  it('includes overweight warning when categories are flagged', () => {
    const positions = [
      makePosition({ id: '1', market: 'BTC rally', size: 300 }),
      makePosition({ id: '2', market: 'ETH breakout', size: 300 }),
      makePosition({ id: '3', market: 'NBA finals', size: 50 }),
    ];
    const report = aggregateExposure(positions);
    const formatted = formatExposureReport(report);
    expect(formatted).toContain('OVERWEIGHT CATEGORIES');
  });
});

// ---------------------------------------------------------------------------
// Risk Dashboard integration
// ---------------------------------------------------------------------------

describe('Risk Dashboard integration', () => {
  it('generateRiskDashboard mock mode includes exposure', () => {
    const dashboard = generateRiskDashboard({ mock: true });
    expect(dashboard.exposure).toBeDefined();
  });

  it('generateRiskDashboard mock mode has correct structure', () => {
    const dashboard = generateRiskDashboard({ mock: true });
    expect(dashboard.riskSummary).toHaveProperty('openPositions');
    expect(dashboard.riskSummary).toHaveProperty('winRate');
    expect(dashboard.riskSummary).toHaveProperty('realizedPnl');
  });

  it('generateRiskDashboard with custom exposureProvider uses it', () => {
    const customExposure = aggregateExposure([
      makePosition({ id: 'x1', market: 'Custom market btc', size: 100 }),
    ]);
    const dashboard = generateRiskDashboard({
      mock: true,
      exposureProvider: () => customExposure,
    });
    expect(dashboard.exposure?.totalAllocated).toBe(100);
  });

  it('formatRiskDashboard includes RISK DASHBOARD header', () => {
    const dashboard = generateRiskDashboard({ mock: true });
    const formatted = formatRiskDashboard(dashboard);
    expect(formatted).toContain('RISK DASHBOARD');
  });

  it('formatRiskDashboard includes exposure section when present', () => {
    const dashboard = generateRiskDashboard({ mock: true });
    const formatted = formatRiskDashboard(dashboard);
    expect(formatted).toContain('PORTFOLIO EXPOSURE REPORT');
  });

  it('generateRiskDashboard without mock and no exposureProvider has no exposure', () => {
    // live mode without a provider — exposure should be undefined
    const dashboard = generateRiskDashboard({ mock: false });
    expect(dashboard.exposure).toBeUndefined();
  });
});
