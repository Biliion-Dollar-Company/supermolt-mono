/**
 * Gamma Scanner — Liquidity Monitoring
 *
 * Detects tokens with rapidly growing liquidity pools (new DEX listings,
 * liquidity injections). Runs every 15 minutes.
 */

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface LiquiditySignal {
  tokenMint: string;
  tokenSymbol: string;
  liquidityUsd: number;
  liquidityGrowthPct: number; // % increase in last window
  convictionScore: number;
}

/**
 * Fetch liquidity growth signals from DEX data.
 * Placeholder: extend with DexScreener / Birdeye trending pools API.
 */
async function fetchLiquiditySignals(): Promise<LiquiditySignal[]> {
  // TODO: integrate DexScreener /latest/dex/tokens or Birdeye liquidity endpoint
  return [];
}

/**
 * Submit a scanner call for a liquidity signal
 */
async function submitCall(signal: LiquiditySignal): Promise<boolean> {
  try {
    const payload = {
      scannerId: 'gamma',
      tokenAddress: signal.tokenMint,
      tokenSymbol: signal.tokenSymbol,
      convictionScore: signal.convictionScore,
      reasoning: [
        `Liquidity: $${signal.liquidityUsd.toLocaleString()}`,
        `Growth: +${signal.liquidityGrowthPct.toFixed(1)}% this window`,
        'Liquidity surge detected',
      ],
      takeProfitPct: 30,
      stopLossPct: 12,
    };

    const response = await fetch(`${API_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.success) {
      console.log(`[Gamma Scanner] Submitted call for ${signal.tokenSymbol}`);
      return true;
    }
    console.log(`[Gamma Scanner] Failed to submit: ${data.error?.message}`);
    return false;
  } catch (error: any) {
    console.error('[Gamma Scanner] Error submitting call:', error.message);
    return false;
  }
}

/**
 * Run Gamma Scanner — liquidity sweep
 */
export async function runGammaScanner() {
  console.log('[Gamma Scanner] Starting liquidity scan...');

  const signals = await fetchLiquiditySignals();
  console.log(`[Gamma Scanner] ${signals.length} liquidity signals detected`);

  const highConviction = signals.filter((s) => s.convictionScore >= 0.75);

  let submitted = 0;
  for (const signal of highConviction) {
    const success = await submitCall(signal);
    if (success) submitted++;
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[Gamma Scanner] Scan complete: ${submitted}/${highConviction.length} calls submitted`);
  return { signals: signals.length, submitted };
}
