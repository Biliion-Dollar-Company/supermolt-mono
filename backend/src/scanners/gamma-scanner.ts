/**
 * Gamma Scanner — Liquidity Monitoring
 *
 * Detects tokens with strong liquidity, high volume-to-liquidity ratios,
 * and fresh graduates from bonding curves. Uses Birdeye Meme Token List
 * for efficient batch data.
 *
 * API budget: ~3 Birdeye calls per run (300 CU total)
 *   - 1× getMemeTokenList sorted by liquidity (100 CU)
 *   - 1× getMemeTokenList sorted by graduated_time (fresh graduates) (100 CU)
 *   - 1× getMemeTokenList sorted by volume_24h_usd with high min_liquidity (100 CU)
 *
 * Runs every 15 minutes.
 */

import {
  getMemeTokenList,
  type MemeToken,
} from './birdeye-client';

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface LiquiditySignal {
  tokenMint: string;
  tokenSymbol: string;
  liquidityUsd: number;
  volLiqRatio: number;
  convictionScore: number;
  source: string;
}

/**
 * Score a token for liquidity strength.
 */
function scoreLiquidity(token: MemeToken, isFreshGraduate: boolean): LiquiditySignal | null {
  if (token.liquidity < 15000) return null;
  if (!token.symbol) return null;

  const volLiqRatio = token.liquidity > 0 ? token.volume_24h_usd / token.liquidity : 0;
  const vol1hLiqRatio = token.liquidity > 0 ? token.volume_1h_usd / token.liquidity : 0;

  let score = 0;
  const reasons: string[] = [];

  // ── Liquidity depth ──
  if (token.liquidity > 200000) {
    score += 0.2;
    reasons.push(`Deep liq: $${(token.liquidity / 1000).toFixed(0)}k`);
  } else if (token.liquidity > 100000) {
    score += 0.15;
    reasons.push(`Good liq: $${(token.liquidity / 1000).toFixed(0)}k`);
  } else if (token.liquidity > 50000) {
    score += 0.1;
  }

  // ── Volume/Liquidity ratio (capital efficiency) ──
  if (volLiqRatio > 5) {
    score += 0.25;
    reasons.push(`Vol/liq: ${volLiqRatio.toFixed(1)}x`);
  } else if (volLiqRatio > 2) {
    score += 0.15;
    reasons.push(`Vol/liq: ${volLiqRatio.toFixed(1)}x`);
  } else if (volLiqRatio > 1) {
    score += 0.08;
  }

  // ── Recent volume spike (1h) — liquidity flowing in NOW ──
  if (vol1hLiqRatio > 0.5) {
    score += 0.15;
    reasons.push(`1h vol surge: ${(vol1hLiqRatio * 100).toFixed(0)}% of liq`);
  } else if (vol1hLiqRatio > 0.2) {
    score += 0.08;
  }

  // ── Fresh graduate bonus — just hit real DEX liquidity ──
  if (isFreshGraduate) {
    score += 0.15;
    reasons.push('Fresh graduate');
  }

  // ── Buy pressure — money flowing in, not out ──
  const totalTrades = token.buy_24h + token.sell_24h;
  const buyRatio = totalTrades > 0 ? token.buy_24h / totalTrades : 0.5;
  if (buyRatio > 0.6) {
    score += 0.1;
    reasons.push(`Buys: ${(buyRatio * 100).toFixed(0)}%`);
  } else if (buyRatio < 0.4) {
    score -= 0.1; // Net selling — liquidity draining
  }

  // ── Holder distribution — more holders = healthier pool ──
  if (token.holder > 500) {
    score += 0.08;
    reasons.push(`${token.holder} holders`);
  } else if (token.holder > 200) {
    score += 0.04;
  }

  // ── Price momentum confirms liquidity is being used ──
  if (token.price_change_1h_percent > 10) {
    score += 0.08;
  } else if (token.price_change_1h_percent < -15) {
    score -= 0.1; // Liquidity exit
  }

  score = Math.min(Math.max(score, 0), 1);

  if (score < 0.5) return null;

  return {
    tokenMint: token.address,
    tokenSymbol: token.symbol,
    liquidityUsd: token.liquidity,
    volLiqRatio,
    convictionScore: score,
    source: reasons.join(' | '),
  };
}

/**
 * Fetch liquidity signals using Birdeye Meme Token List.
 */
async function fetchLiquiditySignals(): Promise<LiquiditySignal[]> {
  const allSignals = new Map<string, LiquiditySignal>();

  // 1. Highest liquidity tokens (deep pools)
  const deepLiq = await getMemeTokenList({
    sortBy: 'liquidity',
    sortType: 'desc',
    graduated: true,
    limit: 50,
    minLiquidity: 50000,
  });
  console.log(`[Gamma Scanner] Deep liquidity: ${deepLiq.length} tokens`);
  for (const t of deepLiq) {
    const sig = scoreLiquidity(t, false);
    if (sig) allSignals.set(sig.tokenMint, sig);
  }

  // 2. Fresh graduates — just migrated to real DEX pools
  const freshGrads = await getMemeTokenList({
    sortBy: 'graduated_time',
    sortType: 'desc',
    graduated: true,
    limit: 50,
    minLiquidity: 15000,
  });
  console.log(`[Gamma Scanner] Fresh graduates: ${freshGrads.length} tokens`);
  for (const t of freshGrads) {
    const sig = scoreLiquidity(t, true);
    if (sig) {
      const existing = allSignals.get(sig.tokenMint);
      if (!existing || sig.convictionScore > existing.convictionScore) {
        allSignals.set(sig.tokenMint, sig);
      }
    }
  }

  // 3. Highest 24h volume with good liquidity floor
  const highVol = await getMemeTokenList({
    sortBy: 'volume_24h_usd',
    sortType: 'desc',
    graduated: true,
    limit: 50,
    minLiquidity: 30000,
  });
  console.log(`[Gamma Scanner] High volume: ${highVol.length} tokens`);
  for (const t of highVol) {
    const sig = scoreLiquidity(t, false);
    if (sig) {
      const existing = allSignals.get(sig.tokenMint);
      if (!existing || sig.convictionScore > existing.convictionScore) {
        allSignals.set(sig.tokenMint, sig);
      }
    }
  }

  const signals = Array.from(allSignals.values());
  signals.sort((a, b) => b.convictionScore - a.convictionScore);
  return signals;
}

/**
 * Submit a scanner call for a liquidity signal.
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
        `Vol/Liq: ${signal.volLiqRatio.toFixed(1)}x`,
        signal.source,
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
      console.log(
        `[Gamma Scanner] Submitted call for ${signal.tokenSymbol} (liq: $${(signal.liquidityUsd / 1000).toFixed(0)}k)`
      );
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
 * Run Gamma Scanner — liquidity sweep.
 */
export async function runGammaScanner() {
  console.log('[Gamma Scanner] Starting liquidity scan (Birdeye)...');

  const signals = await fetchLiquiditySignals();
  console.log(`[Gamma Scanner] ${signals.length} liquidity signals found`);

  const highConviction = signals.filter((s) => s.convictionScore >= 0.75);
  console.log(`[Gamma Scanner] ${highConviction.length} high-conviction (>= 0.75)`);

  let submitted = 0;
  for (const signal of highConviction.slice(0, 10)) {
    const success = await submitCall(signal);
    if (success) submitted++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[Gamma Scanner] Complete: ${submitted}/${highConviction.length} submitted`);
  return { signals: signals.length, submitted };
}
