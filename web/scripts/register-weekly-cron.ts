/**
 * register-weekly-cron.ts
 *
 * One-run script that prints the OpenClaw cron command to register
 * the Polymarket Weekly Report scheduler.
 *
 * Schedule: Sunday 08:00 AM Europe/Sofia (UTC+2) = 06:00 UTC
 * Cron expression: 0 6 * * 0
 *
 * Usage:
 *   tsx scripts/register-weekly-cron.ts
 *
 * Copy-paste the printed command into your terminal to register it.
 *
 * @module
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the project root (parent of scripts/) */
const projectRoot = resolve(__dirname, '..');

/** The cron expression for Sunday 06:00 UTC (08:00 Sofia UTC+2) */
const CRON_SCHEDULE = '0 6 * * 0';

/** Human-readable name shown in OpenClaw cron list */
const CRON_NAME = 'Polymarket Weekly Report';

/** The npm script to invoke */
const NPM_SCRIPT = 'weekly:schedule';

const command = [
  'openclaw cron add',
  `--schedule "${CRON_SCHEDULE}"`,
  `--command "cd ${projectRoot} && npm run ${NPM_SCRIPT}"`,
  `--name "${CRON_NAME}"`,
].join(' \\\n  ');

console.log('\n📅  Polymarket Weekly Report — OpenClaw Cron Registration');
console.log('─'.repeat(60));
console.log('\nRun the following command to register the cron job:\n');
console.log(command);
console.log('\n─'.repeat(60));
console.log('\nSchedule details:');
console.log(`  Cron expression : ${CRON_SCHEDULE}`);
console.log('  Local time      : Sunday 08:00 AM Europe/Sofia (UTC+2)');
console.log('  UTC time        : Sunday 06:00 UTC');
console.log(`  Project root    : ${projectRoot}`);
console.log(`  Command         : npm run ${NPM_SCRIPT}`);
console.log('\nEnvironment variables required (set in OpenClaw secrets or .env.local):');
console.log('  BOT_TOKEN                  — Telegram bot token');
console.log('  WEEKLY_DIGEST_CHANNEL_ID   — Target Telegram channel id');
console.log('     (falls back to SIGNALS_CHANNEL_ID if not set)');
console.log('\nDry-run before registering:');
console.log(`  cd ${projectRoot} && npm run weekly:schedule:dry`);
console.log('');
