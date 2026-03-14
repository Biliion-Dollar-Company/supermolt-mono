/**
 * Market Regime Detection
 * Fetches BTC price data and classifies the current market as bull/bear/sideways.
 * Returns a kelly multiplier to adjust position sizing accordingly.
 */

export type Regime = 'bull' | 'bear' | 'sideways';

export interface RegimeResult {
  regime: Regime;
  kellyMultiplier: 0.8 | 1.0 | 1.2;
}

interface CoinGeckoPriceResponse {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
  };
}

/**
 * Fetches BTC price change and classifies the market regime.
 *
 * Classification thresholds:
 * - Bull: 24h change > +3%   → kellyMultiplier 1.2 (more aggressive)
 * - Bear: 24h change < -3%   → kellyMultiplier 0.8 (conservative)
 * - Sideways: otherwise      → kellyMultiplier 1.0 (baseline)
 */
export async function detectMarketRegime(): Promise<RegimeResult> {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as CoinGeckoPriceResponse;
  const change24h = data.bitcoin.usd_24h_change;

  if (change24h > 3) {
    return { regime: 'bull', kellyMultiplier: 1.2 };
  }

  if (change24h < -3) {
    return { regime: 'bear', kellyMultiplier: 0.8 };
  }

  return { regime: 'sideways', kellyMultiplier: 1.0 };
}
