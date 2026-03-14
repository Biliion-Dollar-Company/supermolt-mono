/**
 * Standalone script: broadcast a signal to the Signals channel.
 *
 * Usage:
 *   npm run broadcast:signal
 *
 * In production, replace getMockSignals()[0] with a real signal
 * fetched from agent-alpha's output queue or the Polymarket scanner.
 */

import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { loadConfig } from '../config.js';
import { getMockSignals } from '../mock-data.js';
import { broadcastSignal } from '../broadcaster.js';

async function main(): Promise<void> {
  const { botToken, channels } = loadConfig();
  const bot = new Telegraf(botToken);

  const signals = getMockSignals();
  const signal = signals[0];

  if (!signal) {
    console.error('[broadcast:signal] No signal available.');
    process.exit(1);
  }

  console.log(`[broadcast:signal] Sending signal: ${signal.marketName}`);
  await broadcastSignal(bot, channels, signal);
  console.log('[broadcast:signal] Done.');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[broadcast:signal] Error:', err);
  process.exit(1);
});
