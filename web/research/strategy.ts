/**
 * Betting Strategy — auto-versioned
 * Each mutation increments the version. The evaluate harness is never modified here.
 */

export interface StrategyParams {
  /** Kelly fraction multiplier applied to raw edge */
  kellyFraction: number;
  /** Minimum probability edge required to place a bet (0–1) */
  minEdge: number;
  /** Maximum fraction of bankroll per single bet */
  maxBetFraction: number;
  /** Confidence discount factor for uncertain markets */
  confidenceDiscount: number;
}

export interface Strategy {
  version: number;
  params: StrategyParams;
  createdAt: string;
}

/** Baseline v1 strategy */
export const DEFAULT_STRATEGY: Strategy = {
  version: 1,
  params: {
    kellyFraction: 0.25,
    minEdge: 0.03,
    maxBetFraction: 0.05,
    confidenceDiscount: 0.8,
  },
  createdAt: new Date().toISOString(),
};

/**
 * Mutates a strategy slightly to produce a new candidate for evaluation.
 * Returns a new Strategy with an incremented version number.
 */
export function mutateStrategy(base: Strategy): Strategy {
  const jitter = () => (Math.random() - 0.5) * 0.02;
  return {
    version: base.version + 1,
    createdAt: new Date().toISOString(),
    params: {
      kellyFraction: Math.max(0.05, Math.min(0.5, base.params.kellyFraction + jitter())),
      minEdge: Math.max(0.01, Math.min(0.1, base.params.minEdge + jitter())),
      maxBetFraction: Math.max(0.01, Math.min(0.1, base.params.maxBetFraction + jitter())),
      confidenceDiscount: Math.max(0.5, Math.min(1.0, base.params.confidenceDiscount + jitter())),
    },
  };
}
