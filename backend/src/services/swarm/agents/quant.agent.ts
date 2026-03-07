/**
 * Quant Agent — Specialization: Historical pattern analysis & market microstructure
 * Applies momentum signals, mean-reversion, and Kelly criterion
 */

import { AgentVote, MarketSignal } from '../swarm.types';

const AGENT_ID = 'swarm-quant';

function kellyFraction(winProb: number, odds: number): number {
  const q = 1 - winProb;
  const f = (winProb * odds - q) / odds;
  return Math.max(0, Math.min(0.25, f)); // Cap at 25%
}

export async function analyze(signal: MarketSignal): Promise<AgentVote> {
  const { yesPrice, priceHistory } = signal;

  // Need price history for quant analysis
  if (!priceHistory || priceHistory.length < 2) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0.1,
      reasoning: 'Insufficient price history for quantitative analysis',
    };
  }

  // Calculate 24h price movement
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const recentPrices = priceHistory.filter((p) => p.timestamp > oneDayAgo);

  if (recentPrices.length < 2) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0.1,
      reasoning: 'Insufficient recent price data (need 24h history)',
    };
  }

  const oldestRecent = recentPrices[0].yesPrice;
  const latestRecent = recentPrices[recentPrices.length - 1].yesPrice;
  const priceChange = (latestRecent - oldestRecent) / oldestRecent;
  const priceChangePct = priceChange * 100;

  // Mean-reversion signal: extreme prices tend to revert
  const isMeanReversion = yesPrice > 0.85 || yesPrice < 0.15;

  // Momentum signal: strong trend in last 24h
  const isMomentumUp = priceChangePct > 10;
  const isMomentumDown = priceChangePct < -10;

  // Kelly criterion position sizing
  let winProb: number;
  let vote: 'YES' | 'NO' | 'ABSTAIN';
  let reasoning: string;

  if (isMeanReversion) {
    // Mean reversion: bet against the extreme
    if (yesPrice > 0.85) {
      winProb = 0.4; // Expect reversion down
      vote = 'NO';
      reasoning = `Mean-reversion: YES price at ${(yesPrice * 100).toFixed(1)}c is extreme, expecting pullback. 24h change: ${priceChangePct.toFixed(1)}%`;
    } else {
      winProb = 0.4;
      vote = 'YES';
      reasoning = `Mean-reversion: YES price at ${(yesPrice * 100).toFixed(1)}c is very low, expecting bounce. 24h change: ${priceChangePct.toFixed(1)}%`;
    }
  } else if (isMomentumUp) {
    winProb = 0.6;
    vote = 'YES';
    reasoning = `Momentum signal: YES price trending up ${priceChangePct.toFixed(1)}% in 24h (${oldestRecent.toFixed(3)} -> ${latestRecent.toFixed(3)})`;
  } else if (isMomentumDown) {
    winProb = 0.6;
    vote = 'NO';
    reasoning = `Momentum signal: YES price trending down ${priceChangePct.toFixed(1)}% in 24h (${oldestRecent.toFixed(3)} -> ${latestRecent.toFixed(3)})`;
  } else {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0.15,
      reasoning: `No strong signal. 24h price change: ${priceChangePct.toFixed(1)}%, current YES: ${(yesPrice * 100).toFixed(1)}c`,
    };
  }

  // Calculate Kelly-sized confidence
  const odds = vote === 'YES' ? 1 / yesPrice - 1 : 1 / (1 - yesPrice) - 1;
  const kelly = kellyFraction(winProb, odds);
  const confidence = Math.min(1, kelly * 4); // Scale kelly (0-0.25) to confidence (0-1)

  return {
    agentId: AGENT_ID,
    vote,
    confidence,
    reasoning: `${reasoning}. Kelly fraction: ${(kelly * 100).toFixed(1)}%`,
  };
}
