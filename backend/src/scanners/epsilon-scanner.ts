/**
 * Epsilon Scanner — Contrarian / Mean-Reversion
 *
 * Identifies tokens that are oversold relative to their on-chain fundamentals
 * (holder growth, recent whale accumulation) and have high bounce potential.
 * Runs every 2 hours.
 */

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface ContrarianSignal {
  tokenMint: string;
  tokenSymbol: string;
  drawdownPct: number;   // How far down from recent peak
  holderGrowthPct: number; // Holder count change (positive = accumulation)
  convictionScore: number;
}

/**
 * Fetch contrarian / mean-reversion signals.
 * Placeholder: extend with holder analytics from Helius or Birdeye.
 */
async function fetchContrarianSignals(): Promise<ContrarianSignal[]> {
  // TODO: cross-reference price drawdown with holder-count growth from Helius
  return [];
}

/**
 * Submit a scanner call for a contrarian signal
 */
async function submitCall(signal: ContrarianSignal): Promise<boolean> {
  try {
    const payload = {
      scannerId: 'epsilon',
      tokenAddress: signal.tokenMint,
      tokenSymbol: signal.tokenSymbol,
      convictionScore: signal.convictionScore,
      reasoning: [
        `Drawdown from peak: -${signal.drawdownPct.toFixed(1)}%`,
        `Holder growth: +${signal.holderGrowthPct.toFixed(1)}%`,
        'Contrarian accumulation pattern detected',
      ],
      takeProfitPct: 50,
      stopLossPct: 20,
    };

    const response = await fetch(`${API_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.success) {
      console.log(`[Epsilon Scanner] Submitted call for ${signal.tokenSymbol}`);
      return true;
    }
    console.log(`[Epsilon Scanner] Failed to submit: ${data.error?.message}`);
    return false;
  } catch (error: any) {
    console.error('[Epsilon Scanner] Error submitting call:', error.message);
    return false;
  }
}

/**
 * Run Epsilon Scanner — contrarian / mean-reversion sweep
 */
export async function runEpsilonScanner() {
  console.log('[Epsilon Scanner] Starting contrarian scan...');

  const signals = await fetchContrarianSignals();
  console.log(`[Epsilon Scanner] ${signals.length} contrarian signals detected`);

  const highConviction = signals.filter((s) => s.convictionScore >= 0.75);

  let submitted = 0;
  for (const signal of highConviction) {
    const success = await submitCall(signal);
    if (success) submitted++;
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[Epsilon Scanner] Scan complete: ${submitted}/${highConviction.length} calls submitted`);
  return { signals: signals.length, submitted };
}
