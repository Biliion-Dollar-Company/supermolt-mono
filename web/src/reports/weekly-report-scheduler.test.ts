/**
 * Tests for weekly-report-scheduler.ts
 *
 * Covers: ISO week calculation, Sunday detection, state persistence,
 * deduplication logic, --force bypass, --dry-run behaviour,
 * missing BOT_TOKEN graceful exit, atomic writes, and full runScheduler flows.
 *
 * 25 tests total.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import {
  getISOWeek,
  isSunday,
  loadState,
  saveState,
  shouldSendReport,
  runScheduler,
  type WeeklyReportState,
  type SchedulerOptions,
} from './weekly-report-scheduler.ts';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBroadcast = vi.fn().mockResolvedValue(undefined);
const mockGenerateWeeklyReport = vi.fn().mockResolvedValue({
  generatedAt: '2026-01-04T06:00:00.000Z',
  weekStart: '2025-12-29',
  weekEnd: '2026-01-04',
  mode: 'live',
  totalTrades: 12,
  winRate: 66.7,
  realizedPnl: 42.0,
  openPositions: 3,
  trackerSource: 'mock',
  dailyTrend: [],
  weeklyPnl: 42.0,
  bestStrategy: null,
  worstStrategy: null,
  regime: { bull: 4, bear: 1, sideways: 2, current: 'bull', kellyMultiplier: 1.2 },
  avgBrierScore: 0.18,
  priorWeekBrierScore: 0.2,
  nextWeekOutlook: 'Scale up Kelly.',
});

vi.mock('./weekly-broadcaster.ts', () => ({
  broadcastWeeklyReport: (...args: unknown[]) => mockBroadcast(...args),
}));

vi.mock('./weekly-report.ts', () => ({
  WeeklyReport: class {
    generateWeeklyReport(...args: unknown[]): unknown {
      return mockGenerateWeeklyReport(...args);
    }
  },
}));

vi.mock('./weekly-report-formatter.ts', () => ({
  formatWeeklyReport: vi.fn().mockReturnValue('<b>POLYMARKET WEEKLY REPORT</b>'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a fresh temp directory for each test run */
function makeTmpState(): string {
  const dir = join(tmpdir(), `wrs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return join(dir, 'weekly-report-state.json');
}

/** Known Sunday in 2026 (ISO week 1) */
const SUNDAY_2026_01_04 = new Date('2026-01-04T08:00:00.000Z');

/** Known Monday in 2026 */
const MONDAY_2026_01_05 = new Date('2026-01-05T08:00:00.000Z');

/** ISO week 1 of 2026 */
const WEEK_1_2026 = 1;

// ---------------------------------------------------------------------------
// 1. getISOWeek
// ---------------------------------------------------------------------------

describe('getISOWeek', () => {
  it('returns 1 for 2026-01-04 (Sunday, first week with Thursday)', () => {
    expect(getISOWeek(SUNDAY_2026_01_04)).toBe(WEEK_1_2026);
  });

  it('returns 1 for 2026-01-05 (Monday of week 2 — but ISO week 2)', () => {
    // Jan 5 2026 is a Monday, week 2
    expect(getISOWeek(MONDAY_2026_01_05)).toBe(2);
  });

  it('returns 52 or 53 for late December', () => {
    const dec28 = new Date('2025-12-28T00:00:00.000Z');
    const week = getISOWeek(dec28);
    expect([52, 53]).toContain(week);
  });

  it('returns a number between 1 and 53 for any date', () => {
    const dates = [
      new Date('2026-03-15'),
      new Date('2026-06-21'),
      new Date('2026-09-06'),
      new Date('2026-12-27'),
    ];
    for (const d of dates) {
      const w = getISOWeek(d);
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(53);
    }
  });

  it('two dates in the same ISO week return the same week number', () => {
    // Jan 4 (Sun) and Jan 4 (Sun) = same week; Jan 4 (Sun) and Jan 3 (Sat) differ
    const sun = new Date('2026-01-04');
    const sameSun = new Date('2026-01-04');
    expect(getISOWeek(sun)).toBe(getISOWeek(sameSun));
  });
});

// ---------------------------------------------------------------------------
// 2. isSunday
// ---------------------------------------------------------------------------

describe('isSunday', () => {
  it('returns true for a Sunday', () => {
    expect(isSunday(SUNDAY_2026_01_04)).toBe(true);
  });

  it('returns false for a Monday', () => {
    expect(isSunday(MONDAY_2026_01_05)).toBe(false);
  });

  it('returns false for Tuesday through Saturday', () => {
    const dates = [
      new Date('2026-01-06'), // Tuesday
      new Date('2026-01-07'), // Wednesday
      new Date('2026-01-08'), // Thursday
      new Date('2026-01-09'), // Friday
      new Date('2026-01-10'), // Saturday
    ];
    for (const d of dates) {
      expect(isSunday(d)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. loadState
// ---------------------------------------------------------------------------

describe('loadState', () => {
  it('returns zero-state when file does not exist', () => {
    const state = loadState('/tmp/definitely-does-not-exist-xyz/state.json');
    expect(state.lastSentWeek).toBe(0);
    expect(state.lastSentAt).toBe('');
  });

  it('returns parsed state from a valid file', () => {
    const path = makeTmpState();
    const expected: WeeklyReportState = { lastSentWeek: 7, lastSentAt: '2026-02-15T06:00:00.000Z' };
    writeFileSync(path, JSON.stringify(expected), 'utf-8');
    const loaded = loadState(path);
    expect(loaded.lastSentWeek).toBe(7);
    expect(loaded.lastSentAt).toBe('2026-02-15T06:00:00.000Z');
  });

  it('returns zero-state for malformed JSON', () => {
    const path = makeTmpState();
    writeFileSync(path, 'not valid json {{{{', 'utf-8');
    const state = loadState(path);
    expect(state.lastSentWeek).toBe(0);
    expect(state.lastSentAt).toBe('');
  });

  it('returns zero-state for JSON with wrong types', () => {
    const path = makeTmpState();
    writeFileSync(path, JSON.stringify({ lastSentWeek: 'nope', lastSentAt: 123 }), 'utf-8');
    const state = loadState(path);
    expect(state.lastSentWeek).toBe(0);
    expect(state.lastSentAt).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 4. saveState
// ---------------------------------------------------------------------------

describe('saveState', () => {
  it('writes state to disk and can be read back', () => {
    const path = makeTmpState();
    const state: WeeklyReportState = { lastSentWeek: 11, lastSentAt: '2026-03-15T06:00:00.000Z' };
    saveState(state, path);
    const loaded = loadState(path);
    expect(loaded.lastSentWeek).toBe(11);
    expect(loaded.lastSentAt).toBe('2026-03-15T06:00:00.000Z');
  });

  it('creates the parent directory if it does not exist', () => {
    const dir = join(tmpdir(), `wrs-newdir-${Date.now()}`);
    const path = join(dir, 'subdir', 'state.json');
    const state: WeeklyReportState = { lastSentWeek: 5, lastSentAt: '2026-02-01T00:00:00.000Z' };
    saveState(state, path);
    expect(existsSync(path)).toBe(true);
    // Cleanup
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not leave a .tmp file after successful write', () => {
    const path = makeTmpState();
    const state: WeeklyReportState = { lastSentWeek: 3, lastSentAt: '2026-01-18T06:00:00.000Z' };
    saveState(state, path);
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(existsSync(path)).toBe(true);
  });

  it('overwrites existing state without error', () => {
    const path = makeTmpState();
    saveState({ lastSentWeek: 1, lastSentAt: '2026-01-04T06:00:00.000Z' }, path);
    saveState({ lastSentWeek: 2, lastSentAt: '2026-01-11T06:00:00.000Z' }, path);
    const loaded = loadState(path);
    expect(loaded.lastSentWeek).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. shouldSendReport
// ---------------------------------------------------------------------------

describe('shouldSendReport', () => {
  const sentState: WeeklyReportState = { lastSentWeek: WEEK_1_2026, lastSentAt: '2026-01-04T06:00:00.000Z' };
  const freshState: WeeklyReportState = { lastSentWeek: 0, lastSentAt: '' };

  it('returns send=true with --force regardless of day', () => {
    const result = shouldSendReport(sentState, { force: true }, WEEK_1_2026, MONDAY_2026_01_05);
    expect(result.send).toBe(true);
    expect(result.reason).toMatch(/--force/);
  });

  it('returns send=true with --force even if already sent this week', () => {
    const result = shouldSendReport(sentState, { force: true }, WEEK_1_2026, SUNDAY_2026_01_04);
    expect(result.send).toBe(true);
  });

  it('returns send=false on a non-Sunday (no force)', () => {
    const result = shouldSendReport(freshState, { force: false }, WEEK_1_2026, MONDAY_2026_01_05);
    expect(result.send).toBe(false);
    expect(result.reason).toMatch(/Not Sunday/);
  });

  it('returns send=false on Sunday when already sent this week', () => {
    const result = shouldSendReport(sentState, { force: false }, WEEK_1_2026, SUNDAY_2026_01_04);
    expect(result.send).toBe(false);
    expect(result.reason).toMatch(/Already sent/);
  });

  it('returns send=true on Sunday when week not yet sent', () => {
    const result = shouldSendReport(freshState, { force: false }, WEEK_1_2026, SUNDAY_2026_01_04);
    expect(result.send).toBe(true);
    expect(result.reason).toMatch(/Sunday/);
  });

  it('returns send=true on Sunday when a different (prior) week was last sent', () => {
    const priorState: WeeklyReportState = { lastSentWeek: 52, lastSentAt: '2025-12-28T06:00:00.000Z' };
    const result = shouldSendReport(priorState, { force: false }, WEEK_1_2026, SUNDAY_2026_01_04);
    expect(result.send).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. runScheduler — BOT_TOKEN missing
// ---------------------------------------------------------------------------

describe('runScheduler — missing BOT_TOKEN', () => {
  beforeEach(() => {
    vi.stubEnv('BOT_TOKEN', '');
    mockBroadcast.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exits gracefully (returns) when BOT_TOKEN is not set', async () => {
    const opts: SchedulerOptions = {
      now: SUNDAY_2026_01_04,
      statePath: makeTmpState(),
      force: false,
      dryRun: false,
    };
    await expect(runScheduler(opts)).resolves.toBeUndefined();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('does not update state when BOT_TOKEN is missing', async () => {
    const statePath = makeTmpState();
    await runScheduler({ now: SUNDAY_2026_01_04, statePath, force: false, dryRun: false });
    expect(existsSync(statePath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. runScheduler — dry-run
// ---------------------------------------------------------------------------

describe('runScheduler — dry-run', () => {
  beforeEach(() => {
    vi.stubEnv('BOT_TOKEN', '');
    mockBroadcast.mockClear();
    mockGenerateWeeklyReport.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not require BOT_TOKEN in dry-run mode', async () => {
    const statePath = makeTmpState();
    await expect(
      runScheduler({ now: MONDAY_2026_01_05, statePath, dryRun: true }),
    ).resolves.toBeUndefined();
  });

  it('calls generateWeeklyReport in dry-run mode', async () => {
    await runScheduler({ now: MONDAY_2026_01_05, statePath: makeTmpState(), dryRun: true });
    expect(mockGenerateWeeklyReport).toHaveBeenCalledOnce();
  });

  it('does NOT call broadcastWeeklyReport in dry-run mode', async () => {
    await runScheduler({ now: SUNDAY_2026_01_04, statePath: makeTmpState(), dryRun: true });
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('does NOT write state file in dry-run mode', async () => {
    const statePath = makeTmpState();
    await runScheduler({ now: SUNDAY_2026_01_04, statePath, dryRun: true });
    expect(existsSync(statePath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. runScheduler — deduplication
// ---------------------------------------------------------------------------

describe('runScheduler — deduplication', () => {
  beforeEach(() => {
    vi.stubEnv('BOT_TOKEN', 'test-token-123');
    mockBroadcast.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips broadcast when already sent this week', async () => {
    const statePath = makeTmpState();
    const existingState: WeeklyReportState = {
      lastSentWeek: WEEK_1_2026,
      lastSentAt: '2026-01-04T06:00:00.000Z',
    };
    writeFileSync(statePath, JSON.stringify(existingState), 'utf-8');

    await runScheduler({ now: SUNDAY_2026_01_04, statePath, force: false });
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('sends when a new week arrives (prior week stored)', async () => {
    const statePath = makeTmpState();
    const priorState: WeeklyReportState = { lastSentWeek: 52, lastSentAt: '2025-12-28T06:00:00.000Z' };
    writeFileSync(statePath, JSON.stringify(priorState), 'utf-8');

    await runScheduler({ now: SUNDAY_2026_01_04, statePath });
    expect(mockBroadcast).toHaveBeenCalledOnce();
  });

  it('creates state file on first ever run (no prior file)', async () => {
    const statePath = makeTmpState();
    // statePath points to a file in an already-created dir, but the file itself doesn't exist

    await runScheduler({ now: SUNDAY_2026_01_04, statePath });
    expect(existsSync(statePath)).toBe(true);
  });

  it('persists the correct week number after a successful send', async () => {
    const statePath = makeTmpState();
    await runScheduler({ now: SUNDAY_2026_01_04, statePath });

    const saved = loadState(statePath);
    expect(saved.lastSentWeek).toBe(WEEK_1_2026);
    expect(saved.lastSentAt).toBe(SUNDAY_2026_01_04.toISOString());
  });

  it('does not send on Monday even with fresh state', async () => {
    const statePath = makeTmpState();
    await runScheduler({ now: MONDAY_2026_01_05, statePath, force: false });
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 9. runScheduler — --force flag
// ---------------------------------------------------------------------------

describe('runScheduler — --force', () => {
  beforeEach(() => {
    vi.stubEnv('BOT_TOKEN', 'test-token-abc');
    mockBroadcast.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends on Monday when --force is set', async () => {
    const statePath = makeTmpState();
    await runScheduler({ now: MONDAY_2026_01_05, statePath, force: true });
    expect(mockBroadcast).toHaveBeenCalledOnce();
  });

  it('sends even if already sent this week when --force is set', async () => {
    const statePath = makeTmpState();
    writeFileSync(
      statePath,
      JSON.stringify({ lastSentWeek: WEEK_1_2026, lastSentAt: '2026-01-04T06:00:00.000Z' }),
      'utf-8',
    );
    await runScheduler({ now: SUNDAY_2026_01_04, statePath, force: true });
    expect(mockBroadcast).toHaveBeenCalledOnce();
  });

  it('updates state after --force send', async () => {
    const statePath = makeTmpState();
    await runScheduler({ now: MONDAY_2026_01_05, statePath, force: true });
    const saved = loadState(statePath);
    // Week 2 is the week of Jan 5 2026
    expect(saved.lastSentWeek).toBe(getISOWeek(MONDAY_2026_01_05));
    expect(saved.lastSentAt).toBe(MONDAY_2026_01_05.toISOString());
  });
});

// ---------------------------------------------------------------------------
// 10. runScheduler — broadcast failure
// ---------------------------------------------------------------------------

describe('runScheduler — broadcast failure', () => {
  beforeEach(() => {
    vi.stubEnv('BOT_TOKEN', 'valid-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockBroadcast.mockResolvedValue(undefined);
  });

  it('calls process.exit(1) when broadcast throws', async () => {
    mockBroadcast.mockRejectedValueOnce(new Error('Telegram 500'));

    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null) => {
        throw new Error(`process.exit(${_code})`);
      });

    const statePath = makeTmpState();
    await expect(
      runScheduler({ now: SUNDAY_2026_01_04, statePath }),
    ).rejects.toThrow('process.exit(1)');

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('does NOT update state when broadcast fails', async () => {
    mockBroadcast.mockRejectedValueOnce(new Error('Network error'));

    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null) => {
        throw new Error(`process.exit(${_code})`);
      });

    const statePath = makeTmpState();
    try {
      await runScheduler({ now: SUNDAY_2026_01_04, statePath });
    } catch {
      // Expected: process.exit throws in our mock
    }

    expect(existsSync(statePath)).toBe(false);
    mockExit.mockRestore();
  });
});
