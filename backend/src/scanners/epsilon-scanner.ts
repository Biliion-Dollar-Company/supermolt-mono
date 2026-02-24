/**
 * Epsilon Scanner — Contrarian / Mean-Reversion
 *
 * Finds tokens that dumped hard but show accumulation signals:
 *   - Price down 15-60% on 24h
 *   - Buy pressure still positive (more buys than sells)
 *   - Liquidity maintained (pool not rugged)
 *   - Holder count still growing or stable
 *
 * Two-phase approach:
 *   Phase 1: getMemeTokenList sorted by price_change_24h_percent ASC (biggest dumps) (100 CU)
 *   Phase 2: getTokenSecurity on top candidates for rug safety (50 CU each, ~5 tokens = 250 CU)
 *
 * Total budget: ~450 CU per run.
 * Runs every 2 hours.
 */

import {
  getMemeTokenList,
  getTokenSecurity,
  getTokenTrades,
  type MemeToken,
} from './birdeye-client';

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface ContrarianSignal {
  tokenMint: string;
  tokenSymbol: string;
  drawdownPct: number;
  buyPressurePct: number; // Buy ratio as percentage
  convictionScore: number;
  source: string;
}

/**
 * Score a token for contrarian bounce potential.
 */
function scoreContrarian(token: MemeToken): ContrarianSignal | null {
  // Must be in a drawdown
  if (token.price_change_24h_percent > -15) return null;
  if (token.price_change_24h_percent < -60) return null; // Too risky, might be dead

  // Must have real liquidity
  if (token.liquidity < 20000) return null;
  if (!token.symbol) return null;
  if (token.holder < 100) return null;

  const drawdownPct = Math.abs(token.price_change_24h_percent);
  const totalTrades = token.buy_24h + token.sell_24h;
  const buyRatio = totalTrades > 0 ? token.buy_24h / totalTrades : 0.5;
  const buyPressurePct = buyRatio * 100;

  // Must still have buy interest (the core contrarian signal)
  if (buyRatio < 0.45) return null;

  let score = 0;
  const reasons: string[] = [];

  // ── Drawdown depth (deeper = higher bounce potential, within limits) ──
  if (drawdownPct > 35) {
    score += 0.2;
    reasons.push(`Deep dip: -${drawdownPct.toFixed(0)}%`);
  } else if (drawdownPct > 25) {
    score += 0.15;
    reasons.push(`Dip: -${drawdownPct.toFixed(0)}%`);
  } else {
    score += 0.1;
    reasons.push(`Pullback: -${drawdownPct.toFixed(0)}%`);
  }

  // ── Buy pressure despite drawdown (THE key signal) ──
  if (buyRatio > 0.6) {
    score += 0.25;
    reasons.push(`Strong accumulation: ${buyPressurePct.toFixed(0)}% buys`);
  } else if (buyRatio > 0.55) {
    score += 0.15;
    reasons.push(`Accumulating: ${buyPressurePct.toFixed(0)}% buys`);
  } else if (buyRatio > 0.5) {
    score += 0.08;
    reasons.push(`Balanced: ${buyPressurePct.toFixed(0)}% buys`);
  }

  // ── 1h recovery signal (bounce starting) ──
  if (token.price_change_1h_percent > 5) {
    score += 0.15;
    reasons.push(`1h recovery: +${token.price_change_1h_percent.toFixed(1)}%`);
  } else if (token.price_change_1h_percent > 0) {
    score += 0.08;
    reasons.push('1h stabilising');
  }

  // ── Liquidity depth (safer bounce) ──
  if (token.liquidity > 100000) {
    score += 0.1;
    reasons.push(`Liq: $${(token.liquidity / 1000).toFixed(0)}k`);
  } else if (token.liquidity > 50000) {
    score += 0.05;
  }

  // ── Holder count (community still there) ──
  if (token.holder > 1000) {
    score += 0.1;
    reasons.push(`${token.holder} holders`);
  } else if (token.holder > 500) {
    score += 0.05;
  }

  // ── Unique wallets (organic, not single whale dumping) ──
  if (token.unique_wallet_24h > 200) {
    score += 0.08;
    reasons.push(`${token.unique_wallet_24h} unique wallets`);
  }

  // ── Social presence (project still alive) ──
  if (token.extensions?.twitter) score += 0.05;
  if (token.extensions?.telegram) score += 0.03;

  // ── Volume maintained (not dead) ──
  const volLiq = token.liquidity > 0 ? token.volume_24h_usd / token.liquidity : 0;
  if (volLiq > 1) {
    score += 0.05;
  }

  score = Math.min(Math.max(score, 0), 1);

  if (score < 0.5) return null;

  return {
    tokenMint: token.address,
    tokenSymbol: token.symbol,
    drawdownPct,
    buyPressurePct,
    convictionScore: score,
    source: reasons.join(' | '),
  };
}

/**
 * Validate top candidates with security checks (anti-rug).
 */
async function validateWithSecurity(
  signals: ContrarianSignal[]
): Promise<ContrarianSignal[]> {
  const validated: ContrarianSignal[] = [];

  // Only check top 5 to save CU
  for (const signal of signals.slice(0, 5)) {
    const security = await getTokenSecurity(signal.tokenMint);

    if (!security) {
      // Can't verify — reduce conviction but don't discard
      signal.convictionScore = Math.max(signal.convictionScore - 0.1, 0);
      validated.push(signal);
      continue;
    }

    // Hard rejections
    if (security.isHoneypot) {
      console.log(`[Epsilon Scanner] ${signal.tokenSymbol}: HONEYPOT — rejected`);
      continue;
    }
    if (security.freezeAuthority) {
      console.log(`[Epsilon Scanner] ${signal.tokenSymbol}: freeze authority — rejected`);
      continue;
    }

    // Soft penalties
    if (security.top10HolderPercent > 50) {
      signal.convictionScore -= 0.1;
      signal.source += ` | Top10: ${security.top10HolderPercent.toFixed(0)}%`;
    }
    if (security.creatorBalancePercent > 10) {
      signal.convictionScore -= 0.05;
    }

    // Bonus for safe tokens
    if (!security.mintAuthority && !security.freezeAuthority && security.top10HolderPercent < 30) {
      signal.convictionScore = Math.min(signal.convictionScore + 0.05, 1);
      signal.source += ' | Safe';
    }

    signal.convictionScore = Math.max(signal.convictionScore, 0);
    validated.push(signal);
  }

  // Add remaining unchecked signals (lower priority)
  for (const signal of signals.slice(5)) {
    signal.convictionScore = Math.max(signal.convictionScore - 0.05, 0);
    validated.push(signal);
  }

  return validated;
}

/**
 * Fetch contrarian signals from Birdeye.
 */
async function fetchContrarianSignals(): Promise<ContrarianSignal[]> {
  // Get tokens that dumped hardest in 24h (sorted ascending = biggest drops first)
  const dumped = await getMemeTokenList({
    sortBy: 'price_change_24h_percent',
    sortType: 'asc',
    graduated: true,
    limit: 50,
    minLiquidity: 20000,
    minHolder: 100,
  });

  console.log(`[Epsilon Scanner] Dumped tokens: ${dumped.length}`);

  // Score all candidates
  const rawSignals: ContrarianSignal[] = [];
  for (const token of dumped) {
    const signal = scoreContrarian(token);
    if (signal) rawSignals.push(signal);
  }

  console.log(`[Epsilon Scanner] Passing initial filters: ${rawSignals.length}`);

  // Sort by conviction and validate top picks with security
  rawSignals.sort((a, b) => b.convictionScore - a.convictionScore);

  const validated = await validateWithSecurity(rawSignals);
  validated.sort((a, b) => b.convictionScore - a.convictionScore);

  return validated;
}

/**
 * Submit a scanner call for a contrarian signal.
 */
async function submitCall(signal: ContrarianSignal): Promise<boolean> {
  try {
    const payload = {
      scannerId: 'epsilon',
      tokenAddress: signal.tokenMint,
      tokenSymbol: signal.tokenSymbol,
      convictionScore: signal.convictionScore,
      reasoning: [
        `Drawdown: -${signal.drawdownPct.toFixed(1)}%`,
        `Buy pressure: ${signal.buyPressurePct.toFixed(0)}%`,
        signal.source,
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
      console.log(
        `[Epsilon Scanner] Submitted call for ${signal.tokenSymbol} (down ${signal.drawdownPct.toFixed(0)}%, accumulating)`
      );
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
 * Run Epsilon Scanner — contrarian sweep.
 */
export async function runEpsilonScanner() {
  console.log('[Epsilon Scanner] Starting contrarian scan (Birdeye)...');

  const signals = await fetchContrarianSignals();
  console.log(`[Epsilon Scanner] ${signals.length} contrarian signals found`);

  const highConviction = signals.filter((s) => s.convictionScore >= 0.75);
  console.log(`[Epsilon Scanner] ${highConviction.length} high-conviction (>= 0.75)`);

  let submitted = 0;
  for (const signal of highConviction.slice(0, 8)) {
    const success = await submitCall(signal);
    if (success) submitted++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[Epsilon Scanner] Complete: ${submitted}/${highConviction.length} submitted`);
  return { signals: signals.length, submitted };
}
