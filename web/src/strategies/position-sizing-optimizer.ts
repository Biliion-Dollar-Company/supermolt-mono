/**
 * Position Sizing Optimizer
 *
 * Combines three signals to compute optimal daily position sizes:
 *   1. Market regime (BTC price → kellyMultiplier 0.8/1.0/1.2)
 *   2. Alpha decay   (strategy health → multiplier 1.0/0.7/0.3)
 *   3. EV ranking    (top markets by edge%)
 *
 * compositeMultiplier = regimeKellyMultiplier × decayMultiplier
 *
 * Usage:
 *   npm run sizing:optimize   → live mode (may call external APIs)
 *   npm run sizing:mock       → mock mode (no external calls)
 *
 * @module
 */

import { writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { detectMarketRegime, type Regime } from '../regime/market-regime.ts';
import { loadDecayResult, type DecaySeverity } from './alpha-decay-monitor.ts';
import { getTopEVMarkets, type MarketInput } from '../quant/ev-calculator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the project root (two dirs up from src/strategies/) */
export const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single market entry in the daily position config */
export interface TopMarketEntry {
  marketId: string;
  /** Edge as a percentage (e.g. 16.0 means 16% edge) */
  edge: number;
  kellyFraction: number;
  /** kellyFraction × compositeMultiplier */
  adjustedKelly: number;
  /** dollarSize = adjustedKelly × bankrollUSD, capped at maxPositionPct */
  dollarSize: number;
}

/** The full daily position configuration */
export interface DailyPositionConfig {
  /** ISO 8601 timestamp when this config was generated */
  generatedAt: string;
  regime: Regime;
  decaySeverity: DecaySeverity;
  /** compositeMultiplier = regimeKellyMultiplier × decayMultiplier */
  compositeMultiplier: number;
  /**
   * Maximum position size as % of bankroll, per trade.
   * Hard-capped at MAX_POSITION_PCT (5%).
   */
  maxPositionPct: number;
  /**
   * Recommended total bankroll exposure.
   * HEALTHY→20%, WARNING→12%, CRITICAL→8%
   */
  recommendedBankrollPct: number;
  topMarkets: TopMarketEntry[];
  /** Human-readable one-liner summarising the config */
  summary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard cap on any single position as % of bankroll */
export const MAX_POSITION_PCT = 5;

/** Bankroll assumption for dollarSize calculation (USD) */
export const DEFAULT_BANKROLL_USD = 1_000;

/** Recommended total exposure by decay severity */
export const RECOMMENDED_BANKROLL_PCT: Record<DecaySeverity, number> = {
  HEALTHY: 20,
  WARNING: 12,
  CRITICAL: 8,
};

/** Top N markets to include in the config */
const TOP_N_MARKETS = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rounds a number to 4 decimal places.
 * @param n - Number to round
 */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Rounds a number to 2 decimal places.
 * @param n - Number to round
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Builds a DailyPositionConfig from its component inputs.
 * Pure function — no I/O.
 *
 * @param regime - Market regime label
 * @param regimeKellyMultiplier - Kelly multiplier from regime (0.8/1.0/1.2)
 * @param decaySeverity - Alpha decay severity
 * @param decayMultiplier - Sizing multiplier from decay (1.0/0.7/0.3)
 * @param marketInputs - Market inputs; passes to getTopEVMarkets (uses mock if empty)
 * @param bankrollUSD - Bankroll for dollar-size calculation
 * @returns Fully populated DailyPositionConfig
 */
export function buildPositionConfig(
  regime: Regime,
  regimeKellyMultiplier: number,
  decaySeverity: DecaySeverity,
  decayMultiplier: number,
  marketInputs: MarketInput[],
  bankrollUSD: number = DEFAULT_BANKROLL_USD,
): DailyPositionConfig {
  const compositeMultiplier = round4(regimeKellyMultiplier * decayMultiplier);
  const recommendedBankrollPct = RECOMMENDED_BANKROLL_PCT[decaySeverity];

  const topEV = getTopEVMarkets(marketInputs, TOP_N_MARKETS);

  const topMarkets: TopMarketEntry[] = topEV.map((m) => {
    const adjustedKelly = round4(m.kellyFraction * compositeMultiplier);
    // Cap at MAX_POSITION_PCT / 100 before converting to dollar size
    const cappedFraction = Math.min(adjustedKelly, MAX_POSITION_PCT / 100);
    const dollarSize = round2(cappedFraction * bankrollUSD);

    return {
      marketId: m.marketId,
      edge: m.edgePercent,
      kellyFraction: m.kellyFraction,
      adjustedKelly,
      dollarSize,
    };
  });

  // maxPositionPct: composite × 100, hard-capped at MAX_POSITION_PCT
  const rawMaxPct = round2(compositeMultiplier * 100);
  const maxPositionPct = Math.min(rawMaxPct, MAX_POSITION_PCT);

  const summary =
    `Regime: ${regime} (×${regimeKellyMultiplier}), ` +
    `Alpha: ${decaySeverity} (×${decayMultiplier}), ` +
    `composite ×${compositeMultiplier} → ` +
    `max ${maxPositionPct}% per trade, ${recommendedBankrollPct}% total exposure`;

  return {
    generatedAt: new Date().toISOString(),
    regime,
    decaySeverity,
    compositeMultiplier,
    maxPositionPct,
    recommendedBankrollPct,
    topMarkets,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Atomic file writer
// ---------------------------------------------------------------------------

/**
 * Atomically writes the DailyPositionConfig to `data/daily-position-config.json`.
 * Creates the `data/` directory if it doesn't exist.
 * Writes to a `.tmp` file then renames atomically.
 *
 * @param config - Config to persist
 * @param dataDir - Override data directory (defaults to PROJECT_ROOT/data)
 */
export function savePositionConfig(
  config: DailyPositionConfig,
  dataDir?: string,
): void {
  const dir = dataDir ?? resolve(PROJECT_ROOT, 'data');

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const targetPath = resolve(dir, 'daily-position-config.json');
  const tmpPath = `${targetPath}.tmp`;
  const json = JSON.stringify(config, null, 2);

  writeFileSync(tmpPath, json, 'utf-8');
  renameSync(tmpPath, targetPath); // atomic on POSIX filesystems
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Runs the full position-sizing optimisation pipeline (live mode).
 * Calls external APIs (CoinGecko for regime detection).
 * Falls back gracefully to 'sideways' regime on external failures.
 *
 * @param marketInputs - Market inputs; passes through to EV ranker (mock if empty)
 * @param bankrollUSD - Bankroll for dollar-size calculation (default $1,000)
 * @param persist - Whether to save output to disk (default true)
 * @returns DailyPositionConfig
 */
export async function optimizePositionSizing(
  marketInputs: MarketInput[] = [],
  bankrollUSD: number = DEFAULT_BANKROLL_USD,
  persist = true,
): Promise<DailyPositionConfig> {
  // 1. Detect market regime (falls back to sideways on any error)
  let regime: Regime = 'sideways';
  let regimeKellyMultiplier: 0.8 | 1.0 | 1.2 = 1.0;

  try {
    const regimeResult = await detectMarketRegime();
    regime = regimeResult.regime;
    regimeKellyMultiplier = regimeResult.kellyMultiplier;
  } catch (err) {
    console.warn(
      '[position-sizing-optimizer] Regime detection failed, defaulting to sideways:',
      err,
    );
  }

  // 2. Load alpha decay result (reads data/research-state.json or falls back to mock)
  const decayResult = loadDecayResult(false);

  // 3. Build config (pure)
  const config = buildPositionConfig(
    regime,
    regimeKellyMultiplier,
    decayResult.severity,
    decayResult.multiplier,
    marketInputs,
    bankrollUSD,
  );

  // 4. Persist to disk
  if (persist) {
    try {
      savePositionConfig(config);
    } catch (err) {
      console.warn('[position-sizing-optimizer] Failed to persist config:', err);
    }
  }

  return config;
}

/**
 * Mock version of optimizePositionSizing — no external API calls.
 * Uses MOCK_MARKET_INPUTS from ev-calculator and MOCK_DECAY_RESULT from alpha-decay-monitor.
 *
 * @param bankrollUSD - Bankroll for dollar-size calculation (default $1,000)
 * @param persist - Whether to save output to disk (default false)
 * @returns DailyPositionConfig built from mock data
 */
export async function optimizePositionSizingMock(
  bankrollUSD: number = DEFAULT_BANKROLL_USD,
  persist = false,
): Promise<DailyPositionConfig> {
  const decayResult = loadDecayResult(true);

  // Passing empty [] → getTopEVMarkets auto-selects MOCK_MARKET_INPUTS
  const config = buildPositionConfig(
    'sideways',
    1.0,
    decayResult.severity,
    decayResult.multiplier,
    [],
    bankrollUSD,
  );

  if (persist) {
    try {
      savePositionConfig(config);
    } catch (err) {
      console.warn('[position-sizing-optimizer] Failed to persist mock config:', err);
    }
  }

  return config;
}
