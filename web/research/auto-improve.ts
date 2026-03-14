/**
 * Auto-improve loop — standard 8-round Brier score optimisation.
 * For regime-aware routing, use regime-aware-auto-improve.ts instead.
 */

import { runIteration, resetIterationState } from './iterate.js';

export interface AutoImproveResult {
  roundsCompleted: number;
  finalBrierScore: number;
}

/**
 * Runs the standard 8-round self-improvement loop.
 * Uses a fixed kelly multiplier of 1.0 (no regime adjustment).
 */
export async function runAutoImprove(): Promise<AutoImproveResult> {
  resetIterationState();

  const ROUNDS = 8;
  const KELLY_MULTIPLIER = 1.0;

  console.log(`🤖 Auto-improve: running ${ROUNDS} rounds (kellyMultiplier: ${KELLY_MULTIPLIER})`);

  let finalBrierScore = 0;

  for (let round = 1; round <= ROUNDS; round++) {
    const result = await runIteration(round, { kellyMultiplier: KELLY_MULTIPLIER });
    finalBrierScore = result.brierScore;
  }

  console.log(`\n✅ Complete. Final Brier score: ${finalBrierScore.toFixed(4)}`);

  return { roundsCompleted: ROUNDS, finalBrierScore };
}

// Entry point when called directly
if (process.argv[1]?.endsWith('auto-improve.ts') || process.argv[1]?.endsWith('auto-improve.js')) {
  runAutoImprove().catch(console.error);
}
