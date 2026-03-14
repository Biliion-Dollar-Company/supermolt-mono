/**
 * Weekly Report CLI entry point.
 *
 * Usage:
 *   npm run weekly:report             # Print report to terminal (live data)
 *   npm run weekly:report:mock        # Print report with mock data (no API calls)
 *   npm run weekly:broadcast          # Generate and send to Telegram (live data)
 *   npm run weekly:broadcast:mock     # Generate and send to Telegram (mock data)
 *
 * Flags:
 *   --mock        Use synthetic data (no live API calls)
 *   --broadcast   Send to Telegram instead of printing to terminal
 *
 * Exit codes:
 *   0  — success or graceful skip (missing BOT_TOKEN)
 *   1  — fatal error (Telegram API failure, unexpected exception)
 *
 * @module
 */

import { WeeklyReport } from '../src/reports/weekly-report.ts';
import { formatWeeklyReport } from '../src/reports/weekly-report-formatter.ts';
import { broadcastWeeklyReport } from '../src/reports/weekly-broadcaster.ts';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isMock = args.includes('--mock');
const isBroadcast = args.includes('--broadcast');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (isMock) {
    console.log('\n[weekly-report] Running in MOCK mode — no live API calls\n');
  }

  if (isBroadcast) {
    // Broadcast mode: generate + send to Telegram
    try {
      await broadcastWeeklyReport({ mock: isMock });
    } catch (err) {
      console.error('[weekly-report] Failed to broadcast weekly report:', err);
      process.exit(1);
    }
    return;
  }

  // Print mode: generate + print to terminal
  try {
    const reporter = new WeeklyReport();
    const data = await reporter.generateWeeklyReport(isMock);
    const output = formatWeeklyReport(data);

    console.log('\n' + output + '\n');
    console.log(`[weekly-report] Report generated at ${data.generatedAt}`);
    console.log(`[weekly-report] Mode: ${data.mode} | Chars: ${output.length}`);
  } catch (err) {
    console.error('[weekly-report] Fatal error generating report:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
