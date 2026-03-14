/**
 * Auto Allocator
 *
 * Orchestrates a full allocation cycle:
 *   1. Calls optimizePositionSizing() to build today's position config
 *   2. Uses the resulting config to filter and size candidate trades
 *   3. Returns an AllocationPlan ready for execution
 *
 * Wire-up: call runAllocationCycle() at the start of each automated cycle.
 *
 * @module
 */

import {
  optimizePositionSizing,
  optimizePositionSizingMock,
  type DailyPositionConfig,
  type TopMarketEntry,
} from './position-sizing-optimizer.ts';
import type { MarketInput } from '../quant/ev-calculator.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single proposed allocation */
export interface AllocationEntry {
  marketId: string;
  /** Edge percentage */
  edge: number;
  /** Dollar amount to allocate */
  dollarSize: number;
  /** Fraction of bankroll (adjustedKelly, pre-cap) */
  kellyFraction: number;
}

/** Full allocation plan for this cycle */
export interface AllocationPlan {
  generatedAt: string;
  regime: string;
  decaySeverity: string;
  compositeMultiplier: number;
  recommendedBankrollPct: number;
  allocations: AllocationEntry[];
  /** Total dollars allocated across all positions */
  totalAllocated: number;
  summary: string;
  /** Source of the underlying position config */
  configSource: 'live' | 'mock';
}

// ---------------------------------------------------------------------------
// Core allocation builder
// ---------------------------------------------------------------------------

/**
 * Converts a DailyPositionConfig into an AllocationPlan.
 * Filters out markets with zero dollar size.
 *
 * @param config - Daily position config
 * @param source - Whether the config came from live or mock mode
 * @returns AllocationPlan
 */
export function buildAllocationPlan(
  config: DailyPositionConfig,
  source: 'live' | 'mock',
): AllocationPlan {
  const allocations: AllocationEntry[] = config.topMarkets
    .filter((m: TopMarketEntry) => m.dollarSize > 0)
    .map((m: TopMarketEntry) => ({
      marketId: m.marketId,
      edge: m.edge,
      dollarSize: m.dollarSize,
      kellyFraction: m.adjustedKelly,
    }));

  const totalAllocated =
    Math.round(allocations.reduce((sum, a) => sum + a.dollarSize, 0) * 100) / 100;

  return {
    generatedAt: config.generatedAt,
    regime: config.regime,
    decaySeverity: config.decaySeverity,
    compositeMultiplier: config.compositeMultiplier,
    recommendedBankrollPct: config.recommendedBankrollPct,
    allocations,
    totalAllocated,
    summary: config.summary,
    configSource: source,
  };
}

// ---------------------------------------------------------------------------
// Allocation cycle runner
// ---------------------------------------------------------------------------

/** Options for the allocation cycle */
export interface AllocationCycleOptions {
  /** Use mock data instead of live APIs (default false) */
  mock?: boolean;
  /** Market inputs for EV ranking (live mode only; uses mock if empty) */
  marketInputs?: MarketInput[];
  /** Bankroll in USD (default $1,000) */
  bankrollUSD?: number;
  /** Whether to persist the config to disk (default true) */
  persist?: boolean;
}

/**
 * Runs a full allocation cycle.
 *
 * Steps:
 *  1. Calls optimizePositionSizing() (or mock variant) to get the daily config
 *  2. Builds an AllocationPlan from the config
 *  3. Logs the plan summary
 *
 * @param options - Cycle options
 * @returns AllocationPlan
 *
 * @example
 * ```ts
 * const plan = await runAllocationCycle({ mock: true });
 * console.log(plan.summary);
 * ```
 */
export async function runAllocationCycle(
  options: AllocationCycleOptions = {},
): Promise<AllocationPlan> {
  const {
    mock = false,
    marketInputs = [],
    bankrollUSD = 1_000,
    persist = true,
  } = options;

  console.log(`[auto-allocator] Starting allocation cycle (${mock ? 'mock' : 'live'} mode)...`);

  let config: DailyPositionConfig;
  let source: 'live' | 'mock';

  if (mock) {
    config = await optimizePositionSizingMock(bankrollUSD, persist);
    source = 'mock';
  } else {
    config = await optimizePositionSizing(marketInputs, bankrollUSD, persist);
    source = 'live';
  }

  const plan = buildAllocationPlan(config, source);

  console.log(`[auto-allocator] Cycle complete.`);
  console.log(`[auto-allocator] Regime: ${plan.regime} | Decay: ${plan.decaySeverity}`);
  console.log(
    `[auto-allocator] Composite ×${plan.compositeMultiplier} | ` +
    `${plan.allocations.length} allocation(s) | ` +
    `Total: $${plan.totalAllocated}`,
  );

  return plan;
}
