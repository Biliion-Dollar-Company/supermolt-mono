/**
 * Alpha Decay Monitor
 *
 * Detects whether the current trading strategy's alpha is decaying by
 * analysing recent win rate, Brier score trend, and consecutive losses.
 *
 * Severity levels:
 *   HEALTHY  → multiplier 1.0 (full position sizing)
 *   WARNING  → multiplier 0.7 (reduce size 30%)
 *   CRITICAL → multiplier 0.3 (drastically reduce exposure)
 *
 * @module
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the project root (two dirs up from src/strategies/) */
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Alpha decay severity level */
export type DecaySeverity = 'HEALTHY' | 'WARNING' | 'CRITICAL';

/** Multiplier associated with each severity level */
export const DECAY_MULTIPLIERS: Record<DecaySeverity, number> = {
  HEALTHY: 1.0,
  WARNING: 0.7,
  CRITICAL: 0.3,
};

/** Inputs for computing alpha decay */
export interface DecayInputs {
  /** Win rate over the last N trades (0–1) */
  recentWinRate: number;
  /** Current Brier score (0–2, lower is better; 0.25 is random) */
  brierScore: number | null;
  /** Number of consecutive losses in recent trades */
  consecutiveLosses: number;
}

/** Result from alpha decay assessment */
export interface DecayResult {
  severity: DecaySeverity;
  /** Sizing multiplier: 1.0 / 0.7 / 0.3 */
  multiplier: number;
  reason: string;
  inputs: DecayInputs;
}

// ---------------------------------------------------------------------------
// Mock / research state (fallback)
// ---------------------------------------------------------------------------

/** Mock alpha decay result for zero-API testing */
export const MOCK_DECAY_RESULT: DecayResult = {
  severity: 'HEALTHY',
  multiplier: 1.0,
  reason: 'Mock mode — assuming healthy alpha (no prior positions)',
  inputs: {
    recentWinRate: 0.62,
    brierScore: 0.21,
    consecutiveLosses: 0,
  },
};

// ---------------------------------------------------------------------------
// Classification logic
// ---------------------------------------------------------------------------

/**
 * Classifies alpha decay severity from metrics.
 *
 * Rules (highest severity wins):
 *  CRITICAL: winRate < 0.35 OR brierScore > 0.35 OR consecutiveLosses >= 5
 *  WARNING:  winRate < 0.50 OR brierScore > 0.28 OR consecutiveLosses >= 3
 *  HEALTHY:  otherwise
 *
 * @param inputs - Decay metrics
 * @returns DecayResult with severity and multiplier
 */
export function classifyDecay(inputs: DecayInputs): DecayResult {
  const { recentWinRate, brierScore, consecutiveLosses } = inputs;
  const bs = brierScore ?? 0.25; // treat null as random baseline

  if (recentWinRate < 0.35 || bs > 0.35 || consecutiveLosses >= 5) {
    return {
      severity: 'CRITICAL',
      multiplier: DECAY_MULTIPLIERS.CRITICAL,
      reason: buildReason('CRITICAL', recentWinRate, bs, consecutiveLosses),
      inputs,
    };
  }

  if (recentWinRate < 0.50 || bs > 0.28 || consecutiveLosses >= 3) {
    return {
      severity: 'WARNING',
      multiplier: DECAY_MULTIPLIERS.WARNING,
      reason: buildReason('WARNING', recentWinRate, bs, consecutiveLosses),
      inputs,
    };
  }

  return {
    severity: 'HEALTHY',
    multiplier: DECAY_MULTIPLIERS.HEALTHY,
    reason: buildReason('HEALTHY', recentWinRate, bs, consecutiveLosses),
    inputs,
  };
}

/** Builds a human-readable reason string for the classification. */
function buildReason(
  severity: DecaySeverity,
  winRate: number,
  brierScore: number,
  consecutiveLosses: number,
): string {
  const parts: string[] = [];
  if (severity === 'CRITICAL') {
    if (winRate < 0.35) parts.push(`win rate ${(winRate * 100).toFixed(1)}% < 35%`);
    if (brierScore > 0.35) parts.push(`Brier ${brierScore.toFixed(3)} > 0.35`);
    if (consecutiveLosses >= 5) parts.push(`${consecutiveLosses} consecutive losses`);
  } else if (severity === 'WARNING') {
    if (winRate < 0.50) parts.push(`win rate ${(winRate * 100).toFixed(1)}% < 50%`);
    if (brierScore > 0.28) parts.push(`Brier ${brierScore.toFixed(3)} > 0.28`);
    if (consecutiveLosses >= 3) parts.push(`${consecutiveLosses} consecutive losses`);
  } else {
    parts.push(
      `win rate ${(winRate * 100).toFixed(1)}%, Brier ${brierScore.toFixed(3)}, ${consecutiveLosses} cons. losses`,
    );
  }
  return `${severity}: ${parts.join('; ')}`;
}

// ---------------------------------------------------------------------------
// Loader (reads from research state file or falls back to mock)
// ---------------------------------------------------------------------------

interface ResearchState {
  brierScore?: number | null;
  consecutiveLosses?: number;
  recentWinRate?: number;
}

/**
 * Loads alpha decay assessment from the research-loop state file,
 * or returns mock data when no file is present.
 *
 * @param mock - When true, always returns mock data
 * @returns DecayResult
 */
export function loadDecayResult(mock: boolean): DecayResult {
  if (mock) {
    return { ...MOCK_DECAY_RESULT };
  }

  const statePath = resolve(PROJECT_ROOT, 'data', 'research-state.json');

  if (!existsSync(statePath)) {
    return {
      ...MOCK_DECAY_RESULT,
      reason: 'No research-state.json found — assuming healthy alpha (no prior positions)',
    };
  }

  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf-8')) as ResearchState;

    const inputs: DecayInputs = {
      recentWinRate: raw.recentWinRate ?? 0.5,
      brierScore: raw.brierScore ?? null,
      consecutiveLosses: raw.consecutiveLosses ?? 0,
    };

    return classifyDecay(inputs);
  } catch {
    return {
      ...MOCK_DECAY_RESULT,
      reason: 'Failed to parse research-state.json — assuming healthy alpha',
    };
  }
}
