/**
 * Beta Scanner — AI Sentiment Analysis
 *
 * Uses Birdeye Meme Token List to detect tokens with surging social activity
 * and volume. Tokens with Twitter/Telegram presence + volume spikes + buy
 * pressure = bullish sentiment signal.
 *
 * API budget: ~3 Birdeye calls per run (300 CU total)
 *   - 1× getMemeTokenList sorted by volume_1h_change_percent (100 CU)
 *   - 1× getMemeTokenList sorted by unique_wallet_24h (100 CU)
 *   - 1× getMemeTokenList sorted by price_change_1h_percent (100 CU)
 *
 * Runs every 30 minutes.
 */

import {
  getMemeTokenList,
  type MemeToken,
} from './birdeye-client';

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface SentimentSignal {
  tokenMint: string;
  tokenSymbol: string;
  sentimentScore: number; // 0–1 (1 = extremely bullish)
  source: string;
}

/**
 * Score a token's sentiment based on on-chain + social signals.
 */
function scoreSentiment(token: MemeToken): SentimentSignal | null {
  // Hard filters
  if (token.liquidity < 15000) return null;
  if (token.holder < 50) return null;
  if (!token.symbol) return null;

  let score = 0;
  const reasons: string[] = [];

  // ── Social presence (strongest sentiment signal) ──
  const hasTwitter = !!token.extensions?.twitter;
  const hasTelegram = !!token.extensions?.telegram;
  const hasWebsite = !!token.extensions?.website;

  if (hasTwitter) {
    score += 0.2;
    reasons.push('Twitter active');
  }
  if (hasTelegram) {
    score += 0.1;
    reasons.push('Telegram group');
  }
  if (hasWebsite) {
    score += 0.05;
  }

  // ── Volume surge (market agreeing with sentiment) ──
  if (token.volume_1h_change_percent > 200) {
    score += 0.25;
    reasons.push(`Vol 1h surge: +${token.volume_1h_change_percent.toFixed(0)}%`);
  } else if (token.volume_1h_change_percent > 100) {
    score += 0.15;
    reasons.push(`Vol 1h up: +${token.volume_1h_change_percent.toFixed(0)}%`);
  } else if (token.volume_1h_change_percent > 50) {
    score += 0.08;
  }

  // ── Unique wallets (organic interest, not wash trading) ──
  if (token.unique_wallet_24h > 500) {
    score += 0.15;
    reasons.push(`${token.unique_wallet_24h} unique wallets`);
  } else if (token.unique_wallet_24h > 200) {
    score += 0.08;
  }

  // ── Buy pressure (sentiment → action) ──
  const totalTrades = token.buy_24h + token.sell_24h;
  const buyRatio = totalTrades > 0 ? token.buy_24h / totalTrades : 0.5;
  if (buyRatio > 0.6) {
    score += 0.1;
    reasons.push(`Buy pressure: ${(buyRatio * 100).toFixed(0)}%`);
  }

  // ── Price momentum confirms sentiment ──
  if (token.price_change_1h_percent > 15) {
    score += 0.1;
    reasons.push(`1h: +${token.price_change_1h_percent.toFixed(1)}%`);
  } else if (token.price_change_1h_percent > 5) {
    score += 0.05;
  }

  // ── Penalise dumps (sentiment ≠ reality) ──
  if (token.price_change_1h_percent < -10) {
    score -= 0.15;
  }

  // ── Liquidity depth (can we actually trade?) ──
  if (token.liquidity > 100000) {
    score += 0.05;
  }

  score = Math.min(Math.max(score, 0), 1);

  if (score < 0.5) return null; // Not worth tracking

  return {
    tokenMint: token.address,
    tokenSymbol: token.symbol,
    sentimentScore: score,
    source: reasons.join(' | '),
  };
}

/**
 * Fetch sentiment signals using Birdeye Meme Token List.
 * 3 API calls with different sort criteria to capture different sentiment angles.
 */
async function fetchSentimentSignals(): Promise<SentimentSignal[]> {
  const allTokens = new Map<string, MemeToken>();

  // 1. Tokens with biggest volume surge in last hour (sentiment → action)
  const volumeSurge = await getMemeTokenList({
    sortBy: 'volume_1h_usd',
    sortType: 'desc',
    graduated: true, // Only graduated (real liquidity)
    limit: 50,
    minLiquidity: 15000,
    minHolder: 50,
  });
  for (const t of volumeSurge) allTokens.set(t.address, t);
  console.log(`[Beta Scanner] Volume surge: ${volumeSurge.length} tokens`);

  // 2. Tokens with most unique wallets (organic interest)
  const walletDiversity = await getMemeTokenList({
    sortBy: 'unique_wallet_24h',
    sortType: 'desc',
    graduated: true,
    limit: 50,
    minLiquidity: 15000,
  });
  for (const t of walletDiversity) allTokens.set(t.address, t);
  console.log(`[Beta Scanner] Wallet diversity: ${walletDiversity.length} tokens`);

  // 3. Tokens pumping hard in 1h (market sentiment confirmed by price)
  const pricePump = await getMemeTokenList({
    sortBy: 'price_change_1h_percent',
    sortType: 'desc',
    graduated: true,
    limit: 50,
    minLiquidity: 15000,
    minHolder: 50,
  });
  for (const t of pricePump) allTokens.set(t.address, t);
  console.log(`[Beta Scanner] Price pump: ${pricePump.length} tokens`);

  // Score all unique tokens
  const signals: SentimentSignal[] = [];
  for (const token of allTokens.values()) {
    const signal = scoreSentiment(token);
    if (signal) signals.push(signal);
  }

  // Sort by conviction descending
  signals.sort((a, b) => b.sentimentScore - a.sentimentScore);

  return signals;
}

/**
 * Submit a scanner call for a sentiment signal.
 */
async function submitCall(signal: SentimentSignal): Promise<boolean> {
  try {
    const payload = {
      scannerId: 'beta',
      tokenAddress: signal.tokenMint,
      tokenSymbol: signal.tokenSymbol,
      convictionScore: signal.sentimentScore,
      reasoning: [
        `Sentiment score: ${(signal.sentimentScore * 100).toFixed(1)}%`,
        signal.source,
        'Bullish social + volume signal',
      ],
      takeProfitPct: 40,
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
        `[Beta Scanner] Submitted call for ${signal.tokenSymbol} (${(signal.sentimentScore * 100).toFixed(0)}%)`
      );
      return true;
    }
    console.log(`[Beta Scanner] Failed to submit: ${data.error?.message}`);
    return false;
  } catch (error: any) {
    console.error('[Beta Scanner] Error submitting call:', error.message);
    return false;
  }
}

/**
 * Run Beta Scanner — AI sentiment sweep.
 */
export async function runBetaScanner() {
  console.log('[Beta Scanner] Starting sentiment scan (Birdeye)...');

  const signals = await fetchSentimentSignals();
  console.log(`[Beta Scanner] ${signals.length} sentiment signals found`);

  const highConviction = signals.filter((s) => s.sentimentScore >= 0.75);
  console.log(`[Beta Scanner] ${highConviction.length} high-conviction (>= 0.75)`);

  let submitted = 0;
  for (const signal of highConviction.slice(0, 10)) { // Cap at 10 per run
    const success = await submitCall(signal);
    if (success) submitted++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[Beta Scanner] Complete: ${submitted}/${highConviction.length} submitted`);
  return { signals: signals.length, submitted };
}
