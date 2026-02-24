/**
 * Delta Scanner — Technical Analysis
 *
 * Uses real Birdeye OHLCV candle data to run proper TA:
 *   - RSI (14-period) for oversold bounces
 *   - Volume breakout detection
 *   - Momentum divergence (price down, volume up)
 *
 * Two-phase approach:
 *   Phase 1: getMemeTokenList to find candidates (100 CU)
 *   Phase 2: getOHLCV on top candidates for real TA (40 CU each, ~10 tokens = 400 CU)
 *
 * Total budget: ~500 CU per run.
 * Runs every hour.
 */

import {
  getMemeTokenList,
  getOHLCV,
  type MemeToken,
  type OHLCVCandle,
} from './birdeye-client';

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface TechnicalSignal {
  tokenMint: string;
  tokenSymbol: string;
  indicator: string;
  convictionScore: number;
  details: string;
}

// ── Technical Indicators ──────────────────────────────────────────────────

/**
 * Calculate RSI from candle closes.
 * Standard 14-period RSI.
 */
function calculateRSI(candles: OHLCVCandle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = candles[i].c - candles[i - 1].c;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  // Smooth over remaining candles
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].c - candles[i - 1].c;
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Detect volume breakout: recent volume >> average volume.
 */
function detectVolumeBreakout(candles: OHLCVCandle[]): {
  multiplier: number;
  recentVol: number;
  avgVol: number;
} | null {
  if (candles.length < 10) return null;

  // Average volume over all candles except last 3
  const baseline = candles.slice(0, -3);
  const avgVol = baseline.reduce((sum, c) => sum + c.vUsd, 0) / baseline.length;

  if (avgVol === 0) return null;

  // Recent volume (last 3 candles)
  const recent = candles.slice(-3);
  const recentVol = recent.reduce((sum, c) => sum + c.vUsd, 0) / recent.length;

  const multiplier = recentVol / avgVol;

  return { multiplier, recentVol, avgVol };
}

/**
 * Detect momentum: is price trending up in recent candles vs earlier?
 */
function detectMomentum(candles: OHLCVCandle[]): {
  recentChange: number;
  oldChange: number;
  divergence: number;
} | null {
  if (candles.length < 12) return null;

  const mid = Math.floor(candles.length / 2);

  // First half price change
  const oldStart = candles[0].c;
  const oldEnd = candles[mid].c;
  const oldChange = oldStart > 0 ? ((oldEnd - oldStart) / oldStart) * 100 : 0;

  // Second half price change
  const recentStart = candles[mid].c;
  const recentEnd = candles[candles.length - 1].c;
  const recentChange = recentStart > 0 ? ((recentEnd - recentStart) / recentStart) * 100 : 0;

  return {
    recentChange,
    oldChange,
    divergence: recentChange - oldChange,
  };
}

/**
 * Run full TA analysis on a single token's OHLCV data.
 */
function analyzeCandles(
  token: MemeToken,
  candles: OHLCVCandle[]
): TechnicalSignal | null {
  if (candles.length < 15) return null;

  const signals: TechnicalSignal[] = [];

  // ── RSI oversold bounce ──
  const rsi = calculateRSI(candles);
  if (rsi !== null && rsi < 35 && rsi > 15) {
    // RSI oversold + recent candle is green (bouncing)
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    const isGreen = lastCandle.c > lastCandle.o;
    const isRecovering = lastCandle.c > prevCandle.c;

    if (isGreen || isRecovering) {
      let score = 0.5;
      if (rsi < 25) score += 0.15; // Deeper oversold = stronger signal
      if (isGreen && isRecovering) score += 0.15; // Both confirm
      if (token.liquidity > 50000) score += 0.1;
      if (token.holder > 200) score += 0.05;

      // Buy pressure confirmation
      const buyRatio = (token.buy_24h + token.sell_24h) > 0
        ? token.buy_24h / (token.buy_24h + token.sell_24h) : 0.5;
      if (buyRatio > 0.55) score += 0.1;

      signals.push({
        tokenMint: token.address,
        tokenSymbol: token.symbol,
        indicator: 'RSI_OVERSOLD',
        convictionScore: Math.min(score, 1),
        details: `RSI: ${rsi.toFixed(1)}, liq: $${(token.liquidity / 1000).toFixed(0)}k, ${token.holder} holders`,
      });
    }
  }

  // ── Volume breakout ──
  const volBreakout = detectVolumeBreakout(candles);
  if (volBreakout && volBreakout.multiplier > 3) {
    const lastCandle = candles[candles.length - 1];
    const priceUp = lastCandle.c > lastCandle.o;

    if (priceUp) {
      let score = 0.45;
      if (volBreakout.multiplier > 6) score += 0.2;
      else if (volBreakout.multiplier > 4) score += 0.12;
      else score += 0.06;

      if (token.liquidity > 50000) score += 0.1;
      if (token.price_change_1h_percent > 5) score += 0.1;
      if (token.holder > 200) score += 0.05;

      signals.push({
        tokenMint: token.address,
        tokenSymbol: token.symbol,
        indicator: 'VOLUME_BREAKOUT',
        convictionScore: Math.min(score, 1),
        details: `Vol: ${volBreakout.multiplier.toFixed(1)}x avg ($${(volBreakout.recentVol / 1000).toFixed(0)}k), liq: $${(token.liquidity / 1000).toFixed(0)}k`,
      });
    }
  }

  // ── Momentum reversal ──
  const momentum = detectMomentum(candles);
  if (momentum && momentum.oldChange < -5 && momentum.recentChange > 5) {
    let score = 0.45;
    const divergence = momentum.divergence;
    if (divergence > 20) score += 0.2;
    else if (divergence > 10) score += 0.12;
    else score += 0.06;

    if (token.liquidity > 50000) score += 0.1;
    if (volBreakout && volBreakout.multiplier > 2) score += 0.1;

    signals.push({
      tokenMint: token.address,
      tokenSymbol: token.symbol,
      indicator: 'MOMENTUM_REVERSAL',
      convictionScore: Math.min(score, 1),
      details: `Trend: ${momentum.oldChange.toFixed(1)}% → ${momentum.recentChange.toFixed(1)}%, div: ${divergence.toFixed(1)}`,
    });
  }

  // Return the strongest signal for this token
  if (signals.length === 0) return null;
  return signals.reduce((best, s) =>
    s.convictionScore > best.convictionScore ? s : best
  );
}

/**
 * Fetch candidates and run OHLCV-based TA on the best ones.
 */
async function fetchTechnicalSignals(): Promise<TechnicalSignal[]> {
  // Phase 1: Get candidates that show interesting patterns
  // Tokens that dropped 24h but have recent 1h activity = potential TA setups
  const candidates = await getMemeTokenList({
    sortBy: 'trade_1h_count',
    sortType: 'desc',
    graduated: true,
    limit: 50,
    minLiquidity: 20000,
    minHolder: 100,
  });

  console.log(`[Delta Scanner] Candidates: ${candidates.length} tokens`);

  // Pre-filter: only tokens with interesting price action
  const interesting = candidates.filter((t) => {
    // Drop that might bounce (TA territory)
    const hasDip = t.price_change_24h_percent < -10;
    // Or strong recent volume (breakout territory)
    const hasVolume = t.volume_1h_usd > 10000;
    // Or significant 1h move (momentum territory)
    const hasMomentum = Math.abs(t.price_change_1h_percent) > 8;

    return hasDip || hasVolume || hasMomentum;
  });

  console.log(`[Delta Scanner] Interesting: ${interesting.length} tokens`);

  // Phase 2: Get OHLCV data for top 10 candidates (400 CU)
  const topCandidates = interesting.slice(0, 10);
  const signals: TechnicalSignal[] = [];

  const now = Math.floor(Date.now() / 1000);
  const fourHoursAgo = now - 4 * 60 * 60; // 4 hours of 5m candles = 48 candles

  for (const token of topCandidates) {
    const candles = await getOHLCV(token.address, '5m', fourHoursAgo, now);

    if (candles.length < 15) {
      console.log(`[Delta Scanner] ${token.symbol}: only ${candles.length} candles, skipping`);
      continue;
    }

    const signal = analyzeCandles(token, candles);
    if (signal) {
      signals.push(signal);
      console.log(
        `[Delta Scanner] ${token.symbol}: ${signal.indicator} (${(signal.convictionScore * 100).toFixed(0)}%)`
      );
    }
  }

  signals.sort((a, b) => b.convictionScore - a.convictionScore);
  return signals;
}

/**
 * Submit a scanner call for a technical signal.
 */
async function submitCall(signal: TechnicalSignal): Promise<boolean> {
  try {
    const payload = {
      scannerId: 'delta',
      tokenAddress: signal.tokenMint,
      tokenSymbol: signal.tokenSymbol,
      convictionScore: signal.convictionScore,
      reasoning: [
        `Indicator: ${signal.indicator}`,
        signal.details,
        'Technical pattern confirmed via OHLCV',
      ],
      takeProfitPct: 35,
      stopLossPct: 15,
    };

    const response = await fetch(`${API_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.success) {
      console.log(
        `[Delta Scanner] Submitted call for ${signal.tokenSymbol} (${signal.indicator})`
      );
      return true;
    }
    console.log(`[Delta Scanner] Failed to submit: ${data.error?.message}`);
    return false;
  } catch (error: any) {
    console.error('[Delta Scanner] Error submitting call:', error.message);
    return false;
  }
}

/**
 * Run Delta Scanner — technical analysis sweep.
 */
export async function runDeltaScanner() {
  console.log('[Delta Scanner] Starting TA scan (Birdeye OHLCV)...');

  const signals = await fetchTechnicalSignals();
  console.log(`[Delta Scanner] ${signals.length} TA signals found`);

  const highConviction = signals.filter((s) => s.convictionScore >= 0.75);
  console.log(`[Delta Scanner] ${highConviction.length} high-conviction (>= 0.75)`);

  let submitted = 0;
  for (const signal of highConviction.slice(0, 8)) {
    const success = await submitCall(signal);
    if (success) submitted++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[Delta Scanner] Complete: ${submitted}/${highConviction.length} submitted`);
  return { signals: signals.length, submitted };
}
