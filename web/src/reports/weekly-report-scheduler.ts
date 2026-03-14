/**
 * Weekly Report Scheduler
 *
 * Runs the weekly performance report on Sunday mornings (or on --force).
 * Deduplicates sends using ISO week number stored in data/weekly-report-state.json.
 *
 * CLI flags:
 *   --dry-run   Print report to console but don't send or update state
 *   --force     Send regardless of day/week (bypasses dedup + day check)
 *
 * Exit codes:
 *   0  Success, or graceful skip (missing BOT_TOKEN, already sent, not Sunday)
 *   1  Fatal error (Telegram API failure, unexpected exception)
 *
 * @module
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WeeklyReport } from './weekly-report.ts';
import { formatWeeklyReport } from './weekly-report-formatter.ts';
import { broadcastWeeklyReport } from './weekly-broadcaster.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Persisted state for deduplication between weekly sends */
export interface WeeklyReportState {
  /** ISO week number of the last successful send */
  lastSentWeek: number;
  /** ISO timestamp of the last successful send */
  lastSentAt: string;
}

/** Options accepted by runScheduler (also used in tests for injection) */
export interface SchedulerOptions {
  /** When true: generate and print report; do not send or update state */
  dryRun?: boolean;
  /** When true: bypass day-of-week and dedup checks */
  force?: boolean;
  /** Override state file path (used in tests to avoid polluting real state) */
  statePath?: string;
  /** Override current date (used in tests) */
  now?: Date;
}

/** Result of the shouldSendReport decision */
export interface SendDecision {
  send: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Default state file path (resolved from this module's location)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const DEFAULT_STATE_PATH = join(__dirname, '../../..', 'data', 'weekly-report-state.json');

// ---------------------------------------------------------------------------
// ISO week helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ISO 8601 week number for a given date.
 * Week 1 is the week containing the first Thursday of the year.
 *
 * @param date - The date to compute the week number for
 */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Shift to nearest Thursday (Mon=1 … Sun=7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Returns true if the given date falls on a Sunday (day 0).
 *
 * @param date - The date to check
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

/**
 * Loads the weekly report state from the given path.
 * Returns a zero-state if the file is missing, empty, or malformed.
 *
 * @param statePath - Absolute path to the state JSON file
 */
export function loadState(statePath: string): WeeklyReportState {
  if (!existsSync(statePath)) {
    return { lastSentWeek: 0, lastSentAt: '' };
  }
  try {
    const raw = readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WeeklyReportState>;
    return {
      lastSentWeek: typeof parsed.lastSentWeek === 'number' ? parsed.lastSentWeek : 0,
      lastSentAt: typeof parsed.lastSentAt === 'string' ? parsed.lastSentAt : '',
    };
  } catch {
    return { lastSentWeek: 0, lastSentAt: '' };
  }
}

/**
 * Atomically writes the state file.
 * Writes to a `.tmp` file first, then renames — safe against partial writes.
 *
 * @param state - The state to persist
 * @param statePath - Absolute path to the state JSON file
 */
export function saveState(state: WeeklyReportState, statePath: string): void {
  const dir = dirname(statePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${statePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  renameSync(tmpPath, statePath);
}

// ---------------------------------------------------------------------------
// Send decision
// ---------------------------------------------------------------------------

/**
 * Decides whether the report should be sent based on state, flags, and calendar.
 *
 * Rules (evaluated in order):
 *   1. --force → always send
 *   2. Not Sunday → skip
 *   3. Already sent this ISO week → skip
 *   4. Otherwise → send
 *
 * @param state       - Current persisted state
 * @param options     - Scheduler options (force flag)
 * @param currentWeek - Current ISO week number
 * @param now         - Current date/time
 */
export function shouldSendReport(
  state: WeeklyReportState,
  options: Pick<SchedulerOptions, 'force'>,
  currentWeek: number,
  now: Date,
): SendDecision {
  if (options.force) {
    return { send: true, reason: '--force flag: bypassing day-of-week check and dedup' };
  }

  if (!isSunday(now)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      send: false,
      reason: `Not Sunday — today is ${dayNames[now.getDay()]}`,
    };
  }

  if (state.lastSentWeek === currentWeek) {
    return {
      send: false,
      reason: `Already sent this week (ISO week ${currentWeek}, last sent ${state.lastSentAt})`,
    };
  }

  return { send: true, reason: `Sunday and ISO week ${currentWeek} not yet sent` };
}

// ---------------------------------------------------------------------------
// Main runner — exported for testing
// ---------------------------------------------------------------------------

/**
 * Runs the weekly report scheduler.
 *
 * - dry-run:  generate + print report; no BOT_TOKEN required; state unchanged
 * - normal:   check BOT_TOKEN → check day/week → broadcast → persist state
 * - force:    same as normal but bypasses day-of-week and dedup checks
 *
 * Never throws. Calls process.exit(1) on fatal Telegram broadcast failure.
 *
 * @param options - Scheduler options
 */
export async function runScheduler(options: SchedulerOptions = {}): Promise<void> {
  const {
    dryRun = false,
    force = false,
    statePath = DEFAULT_STATE_PATH,
    now = new Date(),
  } = options;

  // ── Dry-run path ──────────────────────────────────────────────────────────
  if (dryRun) {
    console.log('[weekly-scheduler] DRY RUN — generating report (no send, no state update)…');
    const reporter = new WeeklyReport();
    const data = await reporter.generateWeeklyReport(false);
    const output = formatWeeklyReport(data);
    console.log('\n' + output + '\n');
    console.log('[weekly-scheduler] DRY RUN complete — state NOT updated');
    return;
  }

  // ── BOT_TOKEN guard ───────────────────────────────────────────────────────
  if (!process.env['BOT_TOKEN']) {
    console.log('[weekly-scheduler] BOT_TOKEN not set — skipping broadcast (exit 0)');
    return;
  }

  // ── Dedup / day-of-week guard ─────────────────────────────────────────────
  const currentWeek = getISOWeek(now);
  const state = loadState(statePath);
  const { send, reason } = shouldSendReport(state, { force }, currentWeek, now);

  if (!send) {
    console.log(`[weekly-scheduler] Skipping: ${reason}`);
    return;
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────
  console.log(`[weekly-scheduler] Sending weekly report (ISO week ${currentWeek})…`);

  try {
    await broadcastWeeklyReport({ mock: false });
  } catch (err) {
    console.error('[weekly-scheduler] Failed to broadcast weekly report:', err);
    process.exit(1);
  }

  // ── Persist state (atomic) ────────────────────────────────────────────────
  const newState: WeeklyReportState = {
    lastSentWeek: currentWeek,
    lastSentAt: now.toISOString(),
  };
  saveState(newState, statePath);

  console.log(
    `[weekly-scheduler] Done. State saved: week=${currentWeek}, sentAt=${now.toISOString()}`,
  );
}

// ---------------------------------------------------------------------------
// CLI entry point — only executes when run directly, not when imported
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('weekly-report-scheduler.ts') ||
    process.argv[1].endsWith('weekly-report-scheduler.js'));

if (isMain) {
  const cliArgs = process.argv.slice(2);
  runScheduler({
    dryRun: cliArgs.includes('--dry-run'),
    force: cliArgs.includes('--force'),
  }).catch((err: unknown) => {
    console.error('[weekly-scheduler] Unexpected error:', err);
    process.exit(1);
  });
}
