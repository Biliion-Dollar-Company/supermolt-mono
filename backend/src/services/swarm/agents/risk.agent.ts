/**
 * Risk Agent — Specialization: Risk management and portfolio safety
 * Has VETO power to override consensus when risk thresholds are exceeded
 */

import { AgentVote, MarketSignal } from '../swarm.types';

const AGENT_ID = 'swarm-risk';
const MAX_DRAWDOWN_PCT = 15;
const MAX_KELLY_FRACTION = 0.25;
const MIN_HOURS_TO_EXPIRY = 24;
const MIN_VOLUME = 1000; // Minimum volume for sufficient liquidity

export async function analyze(signal: MarketSignal): Promise<AgentVote> {
  const risks: string[] = [];
  let riskScore = 0;

  // Check market end date — if < 24h away, reduce confidence 50%
  const hoursToExpiry = (signal.endDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursToExpiry < 0) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 1.0,
      reasoning: 'VETO: Market has already expired',
    };
  }

  if (hoursToExpiry < MIN_HOURS_TO_EXPIRY) {
    risks.push(`Expiry in ${hoursToExpiry.toFixed(1)}h (< ${MIN_HOURS_TO_EXPIRY}h threshold)`);
    riskScore += 0.3;
  }

  // Check liquidity
  const volume = signal.volume ?? 0;
  if (volume < MIN_VOLUME) {
    risks.push(`Low volume: $${volume.toFixed(0)} (min: $${MIN_VOLUME})`);
    riskScore += 0.3;
  }

  // Check for max drawdown risk — extreme prices are risky
  const maxLoss = Math.max(signal.yesPrice, signal.noPrice);
  if (maxLoss > 0.85) {
    const potentialDrawdown = maxLoss * 100;
    if (potentialDrawdown > MAX_DRAWDOWN_PCT) {
      risks.push(`Max drawdown risk: ${potentialDrawdown.toFixed(0)}% (limit: ${MAX_DRAWDOWN_PCT}%)`);
      riskScore += 0.25;
    }
  }

  // Kelly fraction limit check
  const impliedProb = signal.yesPrice;
  const odds = 1 / impliedProb - 1;
  const kellyFraction = odds > 0 ? (impliedProb * odds - (1 - impliedProb)) / odds : 0;
  if (kellyFraction > MAX_KELLY_FRACTION) {
    risks.push(`Kelly fraction ${(kellyFraction * 100).toFixed(1)}% exceeds ${MAX_KELLY_FRACTION * 100}% limit`);
    riskScore += 0.15;
  }

  // Check for suspicious pricing (both sides very low = likely stale/illiquid)
  if (signal.combinedPrice < 0.8) {
    risks.push(`Suspicious combined price: ${signal.combinedPrice.toFixed(3)} (likely stale orderbook)`);
    riskScore += 0.3;
  }

  // VETO threshold: if risk score > 0.8, strongly recommend NO_TRADE
  if (riskScore >= 0.8) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: Math.min(1, riskScore),
      reasoning: `VETO: High risk detected — ${risks.join('; ')}`,
    };
  }

  if (riskScore >= 0.5) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: riskScore,
      reasoning: `Elevated risk — ${risks.join('; ')}`,
    };
  }

  // Market passes risk checks
  return {
    agentId: AGENT_ID,
    vote: 'ABSTAIN',
    confidence: 0.1,
    reasoning: risks.length > 0
      ? `Acceptable risk level. Minor flags: ${risks.join('; ')}`
      : 'All risk checks passed. Market is within acceptable parameters.',
  };
}
