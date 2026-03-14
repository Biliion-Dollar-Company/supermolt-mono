/**
 * Realistic mock data for development and demo purposes.
 *
 * All signals and arb alerts are inspired by real Polymarket market formats.
 * No real money or real API calls involved.
 *
 * @remarks
 * Every function returns a fresh copy so callers can mutate without side effects.
 */

import type { ArbData, ResolvedTradeData, SignalData } from './types.js';

// ---------------------------------------------------------------------------
// Mock Signals (3)
// ---------------------------------------------------------------------------

/**
 * Returns an array of 3 realistic mock Polymarket signals.
 */
export function getMockSignals(): SignalData[] {
  return [
    {
      id: 'sig-001',
      marketName: 'Will the Fed cut rates in March 2026?',
      direction: 'NO',
      currentPriceCents: 38,
      evScorePercent: 9.4,
      kellySizePercent: 4.2,
      kellyAmountOn1kUSD: 42,
      confidencePercent: 67,
      expiresAt: 'Mar 19, 2026',
      daysRemaining: 9,
      reasoning:
        'CME FedWatch shows 72% probability of hold. Market is pricing a cut at 38¢ — that is a 16pp discount to consensus. The edge is clear.',
      source: 'Live',
      postedAt: '09:14 UTC',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sig-002',
      marketName: 'Will Trump sign an executive order on TikTok by April 2026?',
      direction: 'YES',
      currentPriceCents: 52,
      evScorePercent: 7.1,
      kellySizePercent: 3.5,
      kellyAmountOn1kUSD: 35,
      confidencePercent: 61,
      expiresAt: 'Apr 30, 2026',
      daysRemaining: 51,
      reasoning:
        'Policy groundwork is in place and the administration has a track record of EO usage. Market at 52¢ underprices the structural pressure to act before mid-term cycle.',
      source: 'Live',
      postedAt: '11:30 UTC',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sig-003',
      marketName: 'Will Bitcoin close above $100K on any day in March 2026?',
      direction: 'NO',
      currentPriceCents: 41,
      evScorePercent: 11.2,
      kellySizePercent: 5.6,
      kellyAmountOn1kUSD: 56,
      confidencePercent: 71,
      expiresAt: 'Mar 31, 2026',
      daysRemaining: 21,
      reasoning:
        'On-chain funding rates are negative and spot ETF inflows have decelerated sharply. Market at 41¢ is still too generous — realised volatility suggests a sub-$90K range is more probable.',
      source: 'Live',
      postedAt: '14:05 UTC',
      createdAt: new Date().toISOString(),
    },
  ];
}

// ---------------------------------------------------------------------------
// Mock Arb Alerts (2)
// ---------------------------------------------------------------------------

/**
 * Returns an array of 2 realistic mock cross-platform arb alerts.
 */
export function getMockArbAlerts(): ArbData[] {
  return [
    {
      id: 'arb-001',
      marketName: 'Lakers vs Celtics — Lakers win (Game 4)',
      polymarketDirection: 'YES',
      polymarketPriceCents: 44,
      bookmakerName: '1WIN',
      bookmakerOutcome: 'Lakers ML',
      bookmakerDecimalOdds: 1.65,
      bookmakerImpliedCents: 60.6,
      spreadPercent: 6.3,
      kellyPolymarketPercent: 3.1,
      kellyPolymarketAmountUSD: 31,
      kellyBookmakerPercent: 3.1,
      kellyBookmakerAmountUSD: 31,
      expiresAt: 'Today, 23:00 UTC',
      postedAt: '11:42 UTC',
      windowAgeMinutes: 2,
      detectedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 'arb-002',
      marketName: 'Super Bowl LXI — Chiefs to win',
      polymarketDirection: 'YES',
      polymarketPriceCents: 47,
      bookmakerName: '1WIN',
      bookmakerOutcome: 'Kansas City Chiefs',
      bookmakerDecimalOdds: 1.71,
      bookmakerImpliedCents: 58.5,
      spreadPercent: 5.8,
      kellyPolymarketPercent: 2.9,
      kellyPolymarketAmountUSD: 29,
      kellyBookmakerPercent: 2.9,
      kellyBookmakerAmountUSD: 29,
      expiresAt: 'Feb 8, 2026, 04:00 UTC',
      postedAt: '16:20 UTC',
      windowAgeMinutes: 4,
      detectedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    },
  ];
}

// ---------------------------------------------------------------------------
// Mock Resolved Trades (1)
// ---------------------------------------------------------------------------

/**
 * Returns one mock resolved trade for testing formatResolvedOutcome.
 */
export function getMockResolvedTrade(): ResolvedTradeData {
  return {
    marketName: 'Will the ECB cut rates in January 2026?',
    calledDirection: 'NO',
    entryPriceCents: 35,
    resolvedOutcome: 'NO',
    exitPriceCents: 100,
    result: 'Win',
    returnPercent: 185.7,
    entryDate: 'Jan 5, 2026',
    exitDate: 'Jan 30, 2026',
    kellySizePercent: 3.8,
    gainLossOn1kUSD: 70.57,
    brierScore: 0.1721,
    brierDelta: -0.0034,
  };
}
