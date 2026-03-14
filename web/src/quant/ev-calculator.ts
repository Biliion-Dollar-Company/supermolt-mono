/**
 * EV Calculator — Expected Value + Kelly Criterion ranking for Polymarket markets.
 *
 * Computes per-market edge and Kelly fraction given our probability estimates
 * versus current market prices. Markets are ranked by edge% descending.
 *
 * Kelly fraction (binary Polymarket bet):
 *   kellyFraction = edge / (1 - marketPrice)
 *   where edge = ourProbability - marketPrice
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single Polymarket market with price and our probability estimate */
export interface MarketInput {
  marketId: string;
  marketName: string;
  /** Current YES price on Polymarket (0–1) */
  marketPrice: number;
  /** Our estimated probability of YES (0–1) */
  ourProbability: number;
}

/** EV result for a single market */
export interface MarketEV {
  marketId: string;
  marketName: string;
  marketPrice: number;
  ourProbability: number;
  /** Edge as a fraction (ourProbability - marketPrice) */
  edge: number;
  /** Edge as a percentage */
  edgePercent: number;
  /** Full Kelly fraction of bankroll to allocate */
  kellyFraction: number;
  /** Half Kelly (safer default) */
  halfKelly: number;
}

// ---------------------------------------------------------------------------
// Mock market inputs (no-API fallback)
// ---------------------------------------------------------------------------

/** Mock market inputs used in mock mode or when no live data is available */
export const MOCK_MARKET_INPUTS: MarketInput[] = [
  {
    marketId: 'pm-btc-100k-2025',
    marketName: 'BTC > $100k by end of 2025',
    marketPrice: 0.42,
    ourProbability: 0.58,
  },
  {
    marketId: 'pm-fed-cut-march',
    marketName: 'Fed rate cut in March 2025',
    marketPrice: 0.31,
    ourProbability: 0.45,
  },
  {
    marketId: 'pm-eth-5k-q2',
    marketName: 'ETH > $5k by Q2 2025',
    marketPrice: 0.28,
    ourProbability: 0.38,
  },
  {
    marketId: 'pm-trump-crypto-eo',
    marketName: 'Trump signs crypto EO in Q1',
    marketPrice: 0.65,
    ourProbability: 0.72,
  },
  {
    marketId: 'pm-sol-500-2025',
    marketName: 'SOL > $500 in 2025',
    marketPrice: 0.35,
    ourProbability: 0.41,
  },
  {
    marketId: 'pm-us-recession-2025',
    marketName: 'US Recession in 2025',
    marketPrice: 0.22,
    ourProbability: 0.18,
  },
  {
    marketId: 'pm-ai-regulation-2025',
    marketName: 'US AI Regulation Bill passes in 2025',
    marketPrice: 0.14,
    ourProbability: 0.09,
  },
];

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

/**
 * Computes EV and Kelly fraction for a single market.
 *
 * @param input - Market with price and our probability estimate
 * @returns MarketEV with edge and Kelly metrics
 */
export function computeMarketEV(input: MarketInput): MarketEV {
  const edge = input.ourProbability - input.marketPrice;
  const edgePercent = Math.round(edge * 10_000) / 100; // e.g. 0.16 → 16.00

  // Kelly fraction: edge / (1 - marketPrice) for binary YES/NO bet
  // Guard against division by zero (market at 100%)
  const kellyFraction =
    input.marketPrice >= 1 ? 0 : Math.max(0, edge / (1 - input.marketPrice));

  const halfKelly = kellyFraction / 2;

  return {
    marketId: input.marketId,
    marketName: input.marketName,
    marketPrice: input.marketPrice,
    ourProbability: input.ourProbability,
    edge: Math.round(edge * 10_000) / 10_000,
    edgePercent,
    kellyFraction: Math.round(kellyFraction * 10_000) / 10_000,
    halfKelly: Math.round(halfKelly * 10_000) / 10_000,
  };
}

/**
 * Ranks markets by edge%, returning only those with positive edge.
 *
 * @param inputs - Array of market inputs
 * @param minEdgePct - Minimum edge% to include (default 1%)
 * @returns Sorted array of MarketEV, highest edge first
 */
export function rankMarketsByEV(
  inputs: MarketInput[],
  minEdgePct = 1,
): MarketEV[] {
  return inputs
    .map(computeMarketEV)
    .filter((m) => m.edgePercent >= minEdgePct)
    .sort((a, b) => b.edgePercent - a.edgePercent);
}

/**
 * Returns the top N markets ranked by edge%.
 * Uses mock data as fallback if inputs array is empty.
 *
 * @param inputs - Market inputs (uses MOCK_MARKET_INPUTS if empty)
 * @param topN - How many markets to return (default 5)
 * @param minEdgePct - Minimum edge% to include (default 1%)
 */
export function getTopEVMarkets(
  inputs: MarketInput[],
  topN = 5,
  minEdgePct = 1,
): MarketEV[] {
  const source = inputs.length > 0 ? inputs : MOCK_MARKET_INPUTS;
  return rankMarketsByEV(source, minEdgePct).slice(0, topN);
}
