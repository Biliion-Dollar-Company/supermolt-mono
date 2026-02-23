/**
 * Scanner Scheduler
 *
 * Runs all five scanners on their respective schedules:
 *   Alpha   — God-wallet tracking       — every 60 min
 *   Beta    — AI sentiment              — every 30 min
 *   Gamma   — Liquidity monitoring      — every 15 min
 *   Delta   — Technical analysis        — every 60 min
 *   Epsilon — Contrarian / mean-revert  — every 120 min
 */

import { runAlphaScanner } from './alpha-scanner';
import { runBetaScanner } from './beta-scanner';
import { runGammaScanner } from './gamma-scanner';
import { runDeltaScanner } from './delta-scanner';
import { runEpsilonScanner } from './epsilon-scanner';

const ALPHA_INTERVAL_MS = 60 * 60 * 1000;    // 1 hour
const BETA_INTERVAL_MS = 30 * 60 * 1000;     // 30 minutes
const GAMMA_INTERVAL_MS = 15 * 60 * 1000;    // 15 minutes
const DELTA_INTERVAL_MS = 60 * 60 * 1000;    // 1 hour
const EPSILON_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

export class ScannerScheduler {
  private intervals: NodeJS.Timeout[] = [];

  /**
   * Start all scanners
   */
  start() {
    console.log('[Scanner Scheduler] Starting scanner scheduler...\n');

    // ── Alpha Scanner (god-wallet tracking, every 1 hour) ──────────────────
    this.intervals.push(
      setInterval(async () => {
        this.logRun('Alpha');
        try { await runAlphaScanner(); }
        catch (error) { console.error('[Scheduler] Alpha Scanner failed:', error); }
      }, ALPHA_INTERVAL_MS),
    );

    // ── Beta Scanner (AI sentiment, every 30 min) ──────────────────────────
    this.intervals.push(
      setInterval(async () => {
        this.logRun('Beta');
        try { await runBetaScanner(); }
        catch (error) { console.error('[Scheduler] Beta Scanner failed:', error); }
      }, BETA_INTERVAL_MS),
    );

    // ── Gamma Scanner (liquidity, every 15 min) ────────────────────────────
    this.intervals.push(
      setInterval(async () => {
        this.logRun('Gamma');
        try { await runGammaScanner(); }
        catch (error) { console.error('[Scheduler] Gamma Scanner failed:', error); }
      }, GAMMA_INTERVAL_MS),
    );

    // ── Delta Scanner (technical analysis, every 1 hour) ──────────────────
    this.intervals.push(
      setInterval(async () => {
        this.logRun('Delta');
        try { await runDeltaScanner(); }
        catch (error) { console.error('[Scheduler] Delta Scanner failed:', error); }
      }, DELTA_INTERVAL_MS),
    );

    // ── Epsilon Scanner (contrarian, every 2 hours) ────────────────────────
    this.intervals.push(
      setInterval(async () => {
        this.logRun('Epsilon');
        try { await runEpsilonScanner(); }
        catch (error) { console.error('[Scheduler] Epsilon Scanner failed:', error); }
      }, EPSILON_INTERVAL_MS),
    );

    // Run all scanners once on startup (staggered to avoid stampede)
    const initialRuns: Array<{ name: string; fn: () => Promise<unknown>; delayMs: number }> = [
      { name: 'Alpha',   fn: runAlphaScanner,   delayMs: 5_000  },
      { name: 'Beta',    fn: runBetaScanner,    delayMs: 15_000 },
      { name: 'Gamma',   fn: runGammaScanner,   delayMs: 25_000 },
      { name: 'Delta',   fn: runDeltaScanner,   delayMs: 35_000 },
      { name: 'Epsilon', fn: runEpsilonScanner, delayMs: 45_000 },
    ];

    for (const { name, fn, delayMs } of initialRuns) {
      setTimeout(async () => {
        console.log(`[Scheduler] Running initial ${name} scan...\n`);
        try { await fn(); }
        catch (error) { console.error(`[Scheduler] Initial ${name} scan failed:`, error); }
      }, delayMs);
    }

    console.log('[Scanner Scheduler] Scheduler started');
    console.log('  - Alpha Scanner:   Every 60 min  (god-wallet tracking)');
    console.log('  - Beta Scanner:    Every 30 min  (AI sentiment)');
    console.log('  - Gamma Scanner:   Every 15 min  (liquidity monitoring)');
    console.log('  - Delta Scanner:   Every 60 min  (technical analysis)');
    console.log('  - Epsilon Scanner: Every 120 min (contrarian)\n');
  }

  /**
   * Stop all scanners
   */
  stop() {
    console.log('[Scanner Scheduler] Stopping scheduler...');
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    console.log('[Scanner Scheduler] Stopped');
  }

  private logRun(name: string) {
    console.log('\n' + '='.repeat(70));
    console.log(`[${new Date().toISOString()}] Running ${name} Scanner`);
    console.log('='.repeat(70) + '\n');
  }
}

// Singleton instance
let schedulerInstance: ScannerScheduler | null = null;

export function getScannerScheduler(): ScannerScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ScannerScheduler();
  }
  return schedulerInstance;
}
