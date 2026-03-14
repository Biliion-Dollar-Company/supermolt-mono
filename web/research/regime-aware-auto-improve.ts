/**
 * Regime-Aware Auto-Improve Loop
 *
 * Drop-in replacement for auto-improve.ts that adjusts the number of
 * optimisation rounds based on the current BTC market regime:
 *
 *   Bull  → 10 rounds, Kelly ×1.2  (more aggressive)
 *   Bear  →  6 rounds, Kelly ×0.8  (conservative, early-stop on Brier rise)
 *   Sideways → 8 rounds, Kelly ×1.0 (baseline)
 *
 * Falls back to 8-round standard if regime detection fails.
 */

import { detectMarketRegime } from '../src/regime/market-regime.js';
import type { Regime } from '../src/regime/market-regime.js';
import { runIteration, resetIterationState } from './iterate.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunConfig {
  rounds: number;
  kellyMultiplier: number;
}

export interface RegimeRunSummary {
  regime: Regime | 'fallback';
  kellyMultiplier: number;
  roundsPlanned: number;
  roundsCompleted: number;
  finalBrierScore: number;
  earlyStopped: boolean;
}

export interface LastRegimeData {
  timestamp: string;
  regime: Regime | 'fallback';
  kellyMultiplier: number;
  roundsUsed: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Returns the run configuration (rounds + kelly multiplier) for a given regime.
 */
export function getRunConfig(regime: Regime): RunConfig {
  switch (regime) {
    case 'bull':
      return { rounds: 10, kellyMultiplier: 1.2 };
    case 'bear':
      return { rounds: 6, kellyMultiplier: 0.8 };
    case 'sideways':
      return { rounds: 8, kellyMultiplier: 1.0 };
  }
}

/** Brier score delta that triggers early stop in bear market */
export const BEAR_EARLY_STOP_THRESHOLD = 0.02;

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

/**
 * Runs the regime-aware auto-improve loop.
 *
 * 1. Detects BTC market regime (with graceful fallback on failure)
 * 2. Configures rounds + kelly multiplier accordingly
 * 3. Runs optimisation rounds, with early-stop logic for bear markets
 * 4. Persists regime metadata to research/data/last-regime.json
 *
 * @param options.dataDir Override the directory for last-regime.json (useful in tests)
 */
export async function runRegimeAwareAutoImprove(
  options: { dataDir?: string } = {},
): Promise<RegimeRunSummary> {
  let regimeLabel: Regime | 'fallback';
  let config: RunConfig;

  // ── 1. Detect regime ───────────────────────────────────────────────────
  try {
    const result = await detectMarketRegime();
    regimeLabel = result.regime;
    config = getRunConfig(result.regime);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  Regime detection failed (${message}), falling back to 8-round standard`);
    regimeLabel = 'fallback';
    config = { rounds: 8, kellyMultiplier: 1.0 };
  }

  // ── 2. Log regime ──────────────────────────────────────────────────────
  const displayLabel = regimeLabel === 'fallback' ? 'FALLBACK' : regimeLabel.toUpperCase();
  console.log(
    `🔮 Market regime: ${displayLabel} (kellyMultiplier: ${config.kellyMultiplier}) — running ${config.rounds} rounds`,
  );

  // ── 3. Run iterations ──────────────────────────────────────────────────
  resetIterationState();

  let roundsCompleted = 0;
  let finalBrierScore = 0;
  let earlyStopped = false;
  let round1BrierScore: number | null = null;

  for (let round = 1; round <= config.rounds; round++) {
    const result = await runIteration(round, { kellyMultiplier: config.kellyMultiplier });
    finalBrierScore = result.brierScore;
    roundsCompleted = round;

    if (round === 1) {
      round1BrierScore = result.brierScore;
    }

    // Bear market early stop: halt if Brier deteriorates >0.02 vs round 1
    if (regimeLabel === 'bear' && round1BrierScore !== null && round > 1) {
      if (result.brierScore > round1BrierScore + BEAR_EARLY_STOP_THRESHOLD) {
        console.log(
          `🛑 Early stop at round ${round}: Brier ${result.brierScore.toFixed(4)} > ${(round1BrierScore + BEAR_EARLY_STOP_THRESHOLD).toFixed(4)} (round-1 + threshold)`,
        );
        earlyStopped = true;
        break;
      }
    }
  }

  console.log(
    `\n✅ Regime-aware run complete. Rounds: ${roundsCompleted}/${config.rounds}. Final Brier: ${finalBrierScore.toFixed(4)}${earlyStopped ? ' [early stopped]' : ''}`,
  );

  // ── 4. Persist last-regime.json ────────────────────────────────────────
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dataDir =
    options.dataDir ?? path.join(__dirname, 'data');

  await mkdir(dataDir, { recursive: true });

  const lastRegimeData: LastRegimeData = {
    timestamp: new Date().toISOString(),
    regime: regimeLabel,
    kellyMultiplier: config.kellyMultiplier,
    roundsUsed: roundsCompleted,
  };

  await writeFile(
    path.join(dataDir, 'last-regime.json'),
    JSON.stringify(lastRegimeData, null, 2),
    'utf-8',
  );

  return {
    regime: regimeLabel,
    kellyMultiplier: config.kellyMultiplier,
    roundsPlanned: config.rounds,
    roundsCompleted,
    finalBrierScore,
    earlyStopped,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const scriptName = process.argv[1] ?? '';
if (
  scriptName.endsWith('regime-aware-auto-improve.ts') ||
  scriptName.endsWith('regime-aware-auto-improve.js')
) {
  runRegimeAwareAutoImprove().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
