/**
 * Weekly Broadcaster — sends the weekly performance report to Telegram.
 *
 * Reads WEEKLY_DIGEST_CHANNEL_ID env var; falls back to SIGNALS_CHANNEL_ID.
 * Graceful degradation:
 *   - Missing BOT_TOKEN → log warning + exit(0)
 *   - Telegram API error → log error + exit(1)
 *
 * @module
 */

import { WeeklyReport } from './weekly-report.ts';
import { formatWeeklyReport } from './weekly-report-formatter.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for broadcastWeeklyReport */
export interface BroadcastOptions {
  /** When true, uses synthetic data — no live API calls except Telegram */
  mock?: boolean;
  /** Override channel id (used in tests) */
  channelIdOverride?: string;
}

// ---------------------------------------------------------------------------
// Telegram send helper
// ---------------------------------------------------------------------------

/**
 * Sends an HTML message to a Telegram channel via the Bot API.
 *
 * @param botToken - Telegram bot token
 * @param channelId - Target channel id or @handle
 * @param html - HTML message body
 * @throws On non-ok Telegram API response
 */
async function sendTelegramMessage(
  botToken: string,
  channelId: string,
  html: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: html,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generates and broadcasts the weekly performance report to Telegram.
 *
 * Reads channel from WEEKLY_DIGEST_CHANNEL_ID or falls back to SIGNALS_CHANNEL_ID.
 * - Missing BOT_TOKEN → logs warning + returns (caller should exit(0))
 * - API error → rethrows (caller should exit(1))
 *
 * @param options - Broadcast options
 */
export async function broadcastWeeklyReport(options: BroadcastOptions = {}): Promise<void> {
  const { mock = false, channelIdOverride } = options;

  const botToken = process.env['BOT_TOKEN'];

  if (!botToken) {
    console.warn(
      '[weekly-broadcaster] BOT_TOKEN not set — skipping Telegram broadcast',
    );
    return;
  }

  const channelId =
    channelIdOverride ??
    process.env['WEEKLY_DIGEST_CHANNEL_ID'] ??
    process.env['SIGNALS_CHANNEL_ID'];

  if (!channelId) {
    console.warn(
      '[weekly-broadcaster] Neither WEEKLY_DIGEST_CHANNEL_ID nor SIGNALS_CHANNEL_ID is set — skipping broadcast',
    );
    return;
  }

  // Generate report
  const reporter = new WeeklyReport();
  const reportData = await reporter.generateWeeklyReport(mock);
  const html = formatWeeklyReport(reportData);

  console.log(
    `[weekly-broadcaster] Broadcasting weekly report to channel ${channelId} (${html.length} chars)…`,
  );

  // This may throw — caller handles exit(1)
  await sendTelegramMessage(botToken, channelId, html);

  console.log('[weekly-broadcaster] Weekly report broadcast successful.');
}
