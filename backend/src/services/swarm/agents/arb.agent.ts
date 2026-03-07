/**
 * Arb Agent — Specialization: Structural YES+NO arbitrage
 * Pure math — detects when combined price < 0.985 (guaranteed profit)
 */

import { AgentVote, MarketSignal } from '../swarm.types';

const AGENT_ID = 'swarm-arb';
const ARB_THRESHOLD = 0.985;

export async function analyze(signal: MarketSignal): Promise<AgentVote> {
  const { combinedPrice, yesPrice, noPrice } = signal;

  if (combinedPrice >= ARB_THRESHOLD) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0,
      reasoning: `No arb opportunity. Combined price ${combinedPrice.toFixed(4)} >= ${ARB_THRESHOLD} threshold`,
    };
  }

  const expectedProfit = 1.0 - combinedPrice;
  const confidence = Math.min(1, (ARB_THRESHOLD - combinedPrice) / ARB_THRESHOLD);

  // Buy the cheaper side first
  if (yesPrice < noPrice) {
    return {
      agentId: AGENT_ID,
      vote: 'YES',
      confidence,
      reasoning: `Arb detected! Combined ${combinedPrice.toFixed(4)} < ${ARB_THRESHOLD}. Expected profit: ${(expectedProfit * 100).toFixed(2)}%. YES cheaper at ${(yesPrice * 100).toFixed(1)}c vs NO at ${(noPrice * 100).toFixed(1)}c`,
    };
  }

  return {
    agentId: AGENT_ID,
    vote: 'NO',
    confidence,
    reasoning: `Arb detected! Combined ${combinedPrice.toFixed(4)} < ${ARB_THRESHOLD}. Expected profit: ${(expectedProfit * 100).toFixed(2)}%. NO cheaper at ${(noPrice * 100).toFixed(1)}c vs YES at ${(yesPrice * 100).toFixed(1)}c`,
  };
}
