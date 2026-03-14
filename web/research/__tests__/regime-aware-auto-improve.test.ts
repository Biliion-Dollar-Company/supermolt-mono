/**
 * Tests for regime-aware-auto-improve.ts
 *
 * All external dependencies are mocked:
 * - detectMarketRegime  → never makes real HTTP calls
 * - runIteration        → deterministic Brier scores
 * - fs/promises         → no actual file writes
 * - resetIterationState → no-op mock
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Module mocks (hoisted before imports) ──────────────────────────────────

vi.mock('../../src/regime/market-regime.js', () => ({
  detectMarketRegime: vi.fn(),
}));

vi.mock('../iterate.js', () => ({
  runIteration: vi.fn(),
  resetIterationState: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import {
  runRegimeAwareAutoImprove,
  getRunConfig,
  BEAR_EARLY_STOP_THRESHOLD,
  type LastRegimeData,
} from '../regime-aware-auto-improve.js';

import { detectMarketRegime } from '../../src/regime/market-regime.js';
import { runIteration, resetIterationState } from '../iterate.js';
import { writeFile, mkdir } from 'fs/promises';
import type { Regime } from '../../src/regime/market-regime.js';

// ── Typed mocks ────────────────────────────────────────────────────────────

const mockDetectRegime = vi.mocked(detectMarketRegime);
const mockRunIteration = vi.mocked(runIteration);
const mockResetIteration = vi.mocked(resetIterationState);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Creates a sequence of mock iteration results with incrementally lower
 * Brier scores (simulating steady improvement).
 */
function makeIterationResults(count: number, startScore = 0.25, delta = -0.001) {
  return Array.from({ length: count }, (_, i) => ({
    round: i + 1,
    brierScore: startScore + delta * i,
    strategyVersion: i + 1,
    improved: true,
  }));
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// getRunConfig unit tests
// ============================================================================

describe('getRunConfig', () => {
  it('bull → 10 rounds, kellyMultiplier 1.2', () => {
    const config = getRunConfig('bull');
    expect(config.rounds).toBe(10);
    expect(config.kellyMultiplier).toBe(1.2);
  });

  it('bear → 6 rounds, kellyMultiplier 0.8', () => {
    const config = getRunConfig('bear');
    expect(config.rounds).toBe(6);
    expect(config.kellyMultiplier).toBe(0.8);
  });

  it('sideways → 8 rounds, kellyMultiplier 1.0', () => {
    const config = getRunConfig('sideways');
    expect(config.rounds).toBe(8);
    expect(config.kellyMultiplier).toBe(1.0);
  });
});

// ============================================================================
// BEAR_EARLY_STOP_THRESHOLD constant
// ============================================================================

describe('BEAR_EARLY_STOP_THRESHOLD', () => {
  it('is 0.02', () => {
    expect(BEAR_EARLY_STOP_THRESHOLD).toBe(0.02);
  });
});

// ============================================================================
// runRegimeAwareAutoImprove — regime routing
// ============================================================================

describe('runRegimeAwareAutoImprove — bull regime', () => {
  beforeEach(() => {
    mockDetectRegime.mockResolvedValue({ regime: 'bull', kellyMultiplier: 1.2 });
    const results = makeIterationResults(10);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);
  });

  it('runs exactly 10 rounds', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.roundsCompleted).toBe(10);
    expect(summary.roundsPlanned).toBe(10);
    expect(mockRunIteration).toHaveBeenCalledTimes(10);
  });

  it('passes kellyMultiplier 1.2 to each iteration', async () => {
    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    for (const call of mockRunIteration.mock.calls) {
      expect(call[1].kellyMultiplier).toBe(1.2);
    }
  });

  it('reports regime as "bull" in summary', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.regime).toBe('bull');
    expect(summary.kellyMultiplier).toBe(1.2);
  });

  it('does NOT early-stop even if Brier rises', async () => {
    // Make Brier rise significantly after round 1
    mockRunIteration.mockImplementation(async (round) => ({
      round,
      brierScore: round === 1 ? 0.2 : 0.5, // big rise
      strategyVersion: round,
      improved: false,
    }));
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.earlyStopped).toBe(false);
    expect(summary.roundsCompleted).toBe(10);
  });
});

describe('runRegimeAwareAutoImprove — bear regime', () => {
  beforeEach(() => {
    mockDetectRegime.mockResolvedValue({ regime: 'bear', kellyMultiplier: 0.8 });
    const results = makeIterationResults(6);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);
  });

  it('runs exactly 6 rounds when Brier improves', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.roundsCompleted).toBe(6);
    expect(summary.roundsPlanned).toBe(6);
  });

  it('passes kellyMultiplier 0.8 to each iteration', async () => {
    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    for (const call of mockRunIteration.mock.calls) {
      expect(call[1].kellyMultiplier).toBe(0.8);
    }
  });

  it('reports regime as "bear" in summary', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.regime).toBe('bear');
    expect(summary.kellyMultiplier).toBe(0.8);
  });

  it('early-stops when Brier rises > 0.02 from round 1', async () => {
    const round1Score = 0.30;
    // Round 2 Brier is 0.33 → 0.30 + 0.03 > threshold
    mockRunIteration.mockImplementation(async (round) => ({
      round,
      brierScore: round === 1 ? round1Score : round1Score + 0.03,
      strategyVersion: round,
      improved: round === 1,
    }));

    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.earlyStopped).toBe(true);
    expect(summary.roundsCompleted).toBe(2); // stopped after round 2
  });

  it('does NOT early-stop when Brier rise is exactly 0.02 (threshold is exclusive)', async () => {
    const round1Score = 0.30;
    // Rise is exactly 0.02 — should NOT trigger early stop
    mockRunIteration.mockImplementation(async (round) => ({
      round,
      brierScore: round === 1 ? round1Score : round1Score + 0.02,
      strategyVersion: round,
      improved: round === 1,
    }));

    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.earlyStopped).toBe(false);
  });

  it('does NOT early-stop when Brier stays flat', async () => {
    mockRunIteration.mockImplementation(async (round) => ({
      round,
      brierScore: 0.25, // constant
      strategyVersion: round,
      improved: false,
    }));

    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.earlyStopped).toBe(false);
    expect(summary.roundsCompleted).toBe(6);
  });
});

describe('runRegimeAwareAutoImprove — sideways regime', () => {
  beforeEach(() => {
    mockDetectRegime.mockResolvedValue({ regime: 'sideways', kellyMultiplier: 1.0 });
    const results = makeIterationResults(8);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);
  });

  it('runs exactly 8 rounds', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.roundsCompleted).toBe(8);
    expect(summary.roundsPlanned).toBe(8);
    expect(mockRunIteration).toHaveBeenCalledTimes(8);
  });

  it('passes kellyMultiplier 1.0 to each iteration', async () => {
    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    for (const call of mockRunIteration.mock.calls) {
      expect(call[1].kellyMultiplier).toBe(1.0);
    }
  });

  it('reports regime as "sideways"', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.regime).toBe('sideways');
  });
});

// ============================================================================
// Graceful degradation — regime detection failure
// ============================================================================

describe('runRegimeAwareAutoImprove — regime detection failure', () => {
  beforeEach(() => {
    mockDetectRegime.mockRejectedValue(new Error('Network timeout'));
    const results = makeIterationResults(8);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);
  });

  it('falls back to 8 rounds', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.roundsCompleted).toBe(8);
    expect(summary.roundsPlanned).toBe(8);
  });

  it('uses kellyMultiplier 1.0 (baseline) as fallback', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.kellyMultiplier).toBe(1.0);
    for (const call of mockRunIteration.mock.calls) {
      expect(call[1].kellyMultiplier).toBe(1.0);
    }
  });

  it('reports regime as "fallback" in summary', async () => {
    const summary = await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });
    expect(summary.regime).toBe('fallback');
  });
});

// ============================================================================
// Persisting last-regime.json
// ============================================================================

describe('runRegimeAwareAutoImprove — saves last-regime.json', () => {
  it('calls writeFile with correct JSON structure', async () => {
    mockDetectRegime.mockResolvedValue({ regime: 'bull', kellyMultiplier: 1.2 });
    const results = makeIterationResults(10);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);

    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const [filePath, content] = mockWriteFile.mock.calls[0];

    // Path ends with last-regime.json
    expect(String(filePath)).toMatch(/last-regime\.json$/);

    // Content is valid JSON with required fields
    const parsed: LastRegimeData = JSON.parse(String(content));
    expect(parsed.regime).toBe('bull');
    expect(parsed.kellyMultiplier).toBe(1.2);
    expect(parsed.roundsUsed).toBe(10);
    expect(typeof parsed.timestamp).toBe('string');
    // Timestamp is ISO 8601
    expect(() => new Date(parsed.timestamp)).not.toThrow();
  });

  it('saves correct roundsUsed when early-stopped in bear market', async () => {
    mockDetectRegime.mockResolvedValue({ regime: 'bear', kellyMultiplier: 0.8 });
    mockRunIteration.mockImplementation(async (round) => ({
      round,
      brierScore: round === 1 ? 0.25 : 0.30, // 0.30 > 0.25 + 0.02 → early stop
      strategyVersion: round,
      improved: round === 1,
    }));

    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });

    const [, content] = mockWriteFile.mock.calls[0];
    const parsed: LastRegimeData = JSON.parse(String(content));
    expect(parsed.roundsUsed).toBe(2); // stopped after round 2
    expect(parsed.regime).toBe('bear');
  });

  it('calls mkdir before writeFile to ensure data dir exists', async () => {
    mockDetectRegime.mockResolvedValue({ regime: 'sideways', kellyMultiplier: 1.0 });
    const results = makeIterationResults(8);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);

    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });

    expect(mockMkdir).toHaveBeenCalledWith('/tmp/test-data', { recursive: true });
    expect(mockMkdir).toHaveBeenCalledBefore(mockWriteFile);
  });

  it('saves fallback regime correctly to last-regime.json', async () => {
    mockDetectRegime.mockRejectedValue(new Error('API down'));
    const results = makeIterationResults(8);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);

    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });

    const [, content] = mockWriteFile.mock.calls[0];
    const parsed: LastRegimeData = JSON.parse(String(content));
    expect(parsed.regime).toBe('fallback');
    expect(parsed.kellyMultiplier).toBe(1.0);
    expect(parsed.roundsUsed).toBe(8);
  });
});

// ============================================================================
// resetIterationState is called on each run
// ============================================================================

describe('runRegimeAwareAutoImprove — resets iteration state', () => {
  it('calls resetIterationState before running iterations', async () => {
    mockDetectRegime.mockResolvedValue({ regime: 'sideways', kellyMultiplier: 1.0 });
    const results = makeIterationResults(8);
    mockRunIteration.mockImplementation(async (round) => results[round - 1]);

    await runRegimeAwareAutoImprove({ dataDir: '/tmp/test-data' });

    expect(mockResetIteration).toHaveBeenCalledOnce();
  });
});
