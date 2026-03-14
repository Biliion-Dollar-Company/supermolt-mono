/**
 * Risk Dashboard
 *
 * Generates a unified risk report combining position tracker metrics,
 * strategy performance, and (optionally) portfolio exposure aggregation.
 *
 * Usage:
 *   npm run risk:dashboard        # Live mode
 *   npm run risk:dashboard:mock   # Mock mode (no API calls)
 *
 * @module
 */

import { loadTrackerSummary } from '../positions/paper-tracker.ts';
import { BankrollManager, type BankrollStatus } from '../finance/bankroll-manager.ts';
import {
  aggregateExposure,
  formatExposureReport,
  type ExposureReport,
  type ActivePosition,
} from '../analysis/exposure-aggregator.ts';
import type { TrackedPosition } from '../positions/paper-tracker.ts';
import { MOCK_TRACKER_POSITIONS } from '../positions/paper-tracker.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for generating the risk dashboard */
export interface RiskDashboardOptions {
  /** Use mock data instead of live sources */
  mock?: boolean;
  /** Optional provider for exposure data. Receives open positions and returns a report. */
  exposureProvider?: (positions: ActivePosition[]) => ExposureReport;
}

/** The full risk dashboard report */
export interface RiskDashboardReport {
  generatedAt: string;
  riskSummary: {
    openPositions: number;
    totalTrades: number;
    winRate: number;
    realizedPnl: number;
    source: string;
  };
  /** Optional exposure breakdown (requires exposureProvider or mock mode) */
  exposure?: ExposureReport;
  /** Bankroll health snapshot */
  bankroll?: BankrollStatus;
}

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

/** Generate a sample exposure report for mock mode */
function generateMockExposure(): ExposureReport {
  const openMocks = MOCK_TRACKER_POSITIONS.filter(
    (p): p is TrackedPosition & { status: 'open' } => p.status === 'open',
  );

  // Add a few extra mock open positions to make the report interesting
  const extendedMocks: ActivePosition[] = [
    ...openMocks,
    {
      id: 'mock-eth-1',
      market: 'ETH hits $5000 in Q3',
      direction: 'YES',
      entryPrice: 0.42,
      size: 120,
      status: 'open',
      predictedProb: 0.42,
      strategy: 'MOMENTUM',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'mock-fed-1',
      market: 'Fed cuts rate by 50bps',
      direction: 'NO',
      entryPrice: 0.35,
      size: 80,
      status: 'open',
      predictedProb: 0.35,
      strategy: 'FADE_MARKET',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'mock-nba-1',
      market: 'NBA Championship won by Lakers',
      direction: 'YES',
      entryPrice: 0.2,
      size: 50,
      status: 'open',
      predictedProb: 0.2,
      strategy: 'HIGH_EDGE',
      timestamp: new Date().toISOString(),
    },
  ];

  return aggregateExposure(extendedMocks);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Generate the full risk dashboard report.
 *
 * @param options - Dashboard generation options
 * @returns A structured RiskDashboardReport
 */
export function generateRiskDashboard(options: RiskDashboardOptions = {}): RiskDashboardReport {
  const { mock = false, exposureProvider } = options;

  // Position tracker metrics
  const trackerSummary = loadTrackerSummary(mock);

  // Exposure report
  let exposure: ExposureReport | undefined;

  if (exposureProvider) {
    // Use the caller-provided exposure provider
    const openPositions = mock
      ? (MOCK_TRACKER_POSITIONS.filter(
          (p): p is ActivePosition => p.status === 'open',
        ))
      : [];
    exposure = exposureProvider(openPositions);
  } else if (mock) {
    exposure = generateMockExposure();
  }

  // Bankroll snapshot
  const bankrollManager = new BankrollManager();
  const bankroll = bankrollManager.getStatus();

  return {
    generatedAt: new Date().toISOString(),
    riskSummary: {
      openPositions: trackerSummary.openPositions,
      totalTrades: trackerSummary.totalTrades,
      winRate: trackerSummary.winRate,
      realizedPnl: trackerSummary.realizedPnl,
      source: trackerSummary.source,
    },
    exposure,
    bankroll,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a RiskDashboardReport as a human-readable ASCII string.
 *
 * Appends the exposure section when present.
 *
 * @param report - The dashboard report to format
 * @returns Multi-line ASCII string
 */
export function formatRiskDashboard(report: RiskDashboardReport): string {
  const lines: string[] = [];
  const push = (s = '') => lines.push(s);
  const hr = '═'.repeat(60);

  push(`╔${hr}╗`);
  push(`║  🛡️  RISK DASHBOARD${' '.repeat(40)}║`);
  push(`╚${hr}╝`);
  push();

  push(`  Generated : ${report.generatedAt}`);
  push(`  Source    : ${report.riskSummary.source}`);
  push();

  push('─'.repeat(60));
  push('  POSITION SUMMARY');
  push('─'.repeat(60));
  push(`  Open Positions : ${report.riskSummary.openPositions}`);
  push(`  Total Trades   : ${report.riskSummary.totalTrades}`);
  push(`  Win Rate       : ${report.riskSummary.winRate.toFixed(1)}%`);
  push(`  Realized PnL   : $${report.riskSummary.realizedPnl.toFixed(2)}`);
  push();

  // Exposure section
  if (report.exposure) {
    push();
    push(formatExposureReport(report.exposure));
  }

  // Bankroll section
  if (report.bankroll) {
    const bk = report.bankroll;
    push();
    push('─'.repeat(60));
    push('  💰 BANKROLL STATUS');
    push('─'.repeat(60));
    push(`  Status         : ${bk.status}`);
    push(`  Total Capital  : $${bk.totalCapital.toFixed(2)}`);
    push(`  Available      : $${bk.availableCapital.toFixed(2)}`);
    push(`  Used Capital   : $${bk.usedCapital.toFixed(2)}`);
    push(`  Daily PnL      : $${bk.dailyPnL.toFixed(2)}`);
    push(`  Total PnL      : $${bk.totalPnL.toFixed(2)}`);
    push(`  Drawdown       : ${(bk.drawdownPct * 100).toFixed(2)}% / ${(bk.maxDrawdownPct * 100).toFixed(2)}% max`);
    push(`  Strategies     : ${bk.strategies.length}`);
    push();
  }

  push('─'.repeat(60));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMock = process.argv.includes('--mock');
const report = generateRiskDashboard({ mock: isMock });
console.log(formatRiskDashboard(report));
