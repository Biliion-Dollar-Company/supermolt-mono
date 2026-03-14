/**
 * Single iteration runner for the Brier-score optimisation loop.
 * Each round mutates the current strategy, evaluates it, and keeps the
 * new version only if the Brier score improves.
 */

import { mutateStrategy, DEFAULT_STRATEGY } from './strategy.js';
import type { Strategy } from './strategy.js';

export interface IterationContext {
  /** Kelly multiplier from regime detection (0.8 / 1.0 / 1.2) */
  kellyMultiplier: number;
}

export interface IterationResult {
  round: number;
  brierScore: number;
  strategyVersion: number;
  improved: boolean;
}

/** In-memory current strategy (shared across iterations in a single run) */
let currentStrategy: Strategy = { ...DEFAULT_STRATEGY };
let currentBrierScore = 0.25; // starting baseline

/**
 * Resets the in-memory strategy state.
 * Useful for isolated test runs.
 */
export function resetIterationState(): void {
  currentStrategy = { ...DEFAULT_STRATEGY };
  currentBrierScore = 0.25;
}

/**
 * Evaluates a strategy candidate by simulating Brier score.
 * In production this would call the frozen evaluate harness.
 * Here we model slight random improvement with kelly-weighted noise.
 */
function evaluateStrategy(strategy: Strategy, kellyMultiplier: number): number {
  // Simulate scoring — real impl would call frozen evaluate.ts
  const baseImprovement = 0.001 * kellyMultiplier;
  const noise = (Math.random() - 0.45) * 0.02;
  return Math.max(0.01, currentBrierScore - baseImprovement + noise);
}

/**
 * Runs a single optimisation round.
 * Mutates the strategy, evaluates it, and keeps improvements.
 *
 * @param round   1-indexed round number
 * @param context Regime context including kelly multiplier
 */
export async function runIteration(
  round: number,
  context: IterationContext,
): Promise<IterationResult> {
  const candidate = mutateStrategy(currentStrategy);
  candidate.params.kellyFraction *= context.kellyMultiplier;

  const candidateScore = evaluateStrategy(candidate, context.kellyMultiplier);
  const improved = candidateScore < currentBrierScore;

  if (improved) {
    currentStrategy = candidate;
    currentBrierScore = candidateScore;
  }

  console.log(
    `  Round ${round}: Brier ${candidateScore.toFixed(4)} (v${candidate.version}) ${improved ? '✅ improved' : '⏭️  skipped'}`,
  );

  return {
    round,
    brierScore: candidateScore,
    strategyVersion: candidate.version,
    improved,
  };
}
