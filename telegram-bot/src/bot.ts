/**
 * Supermolt Signals — Telegram Bot Entry Point
 *
 * Commands:
 *   /start     — welcome message + channel links
 *   /status    — current subscription tier (mock)
 *   /signals   — last 3 EV signals (mock)
 *   /arb       — latest arb opportunity (mock)
 *   /subscribe — payment instructions
 *
 * Run: npm run dev
 */

import 'dotenv/config';
import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { loadConfig } from './config.js';
import { getMockArbAlerts, getMockSignals } from './mock-data.js';
import { formatArbAlert, formatSignal } from './templates.js';
import type { SubscriptionTier } from './types.js';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const { botToken, channels } = loadConfig();
const bot = new Telegraf(botToken);

// ---------------------------------------------------------------------------
// /start — Welcome + channel directory
// ---------------------------------------------------------------------------

bot.start(async (ctx: Context) => {
  const name = ctx.from?.first_name ?? 'there';

  await ctx.replyWithHTML(
    [
      `👋 <b>Welcome to Supermolt Signals, ${name}.</b>`,
      ``,
      `AI quant engine for Polymarket prediction markets.`,
      `EV-based signals, Kelly sizing, real-time arb alerts.`,
      ``,
      `<b>Channels:</b>`,
      `📢 Free Preview → @SupermoltSignals`,
      `📊 Signals ($49/mo) → @SupermoltSignalsPro`,
      `⚡ Arb Scanner Pro ($79/mo) → @ArbScannerPro`,
      `🎯 Alpha Concierge ($299/mo) → invite-only`,
      ``,
      `<b>Commands:</b>`,
      `/signals — preview latest signals`,
      `/arb — latest arb opportunity`,
      `/status — your subscription tier`,
      `/subscribe — join a paid tier`,
      ``,
      `<a href="https://supermolt.io/subscribe">supermolt.io/subscribe</a>`,
    ].join('\n'),
    { link_preview_options: { is_disabled: true } },
  );
});

// ---------------------------------------------------------------------------
// /status — Subscription tier (mock)
// ---------------------------------------------------------------------------

/**
 * Returns a mock subscription tier for the given Telegram user ID.
 * Replace with a real DB lookup when payment gating is live.
 */
function getMockTier(_telegramId: number): SubscriptionTier {
  // Mock: everyone is on free tier until a real DB is wired in
  return 'free';
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: '📢 Free Preview',
  signals: '📊 Supermolt Signals ($49/mo)',
  arb_pro: '⚡ Arb Scanner Pro ($79/mo)',
  alpha_concierge: '🎯 Alpha Concierge ($299/mo)',
};

bot.command('status', async (ctx: Context) => {
  const userId = ctx.from?.id ?? 0;
  const tier = getMockTier(userId);
  const label = TIER_LABELS[tier];

  await ctx.replyWithHTML(
    [
      `<b>Your subscription:</b> ${label}`,
      ``,
      tier === 'free'
        ? `Upgrade to get 2–3 EV signals/day + real-time arb alerts.\n→ /subscribe`
        : `✅ Access active. Use /signals and /arb to see the latest.`,
    ].join('\n'),
  );
});

// ---------------------------------------------------------------------------
// /signals — Last 3 signals (mock)
// ---------------------------------------------------------------------------

bot.command('signals', async (ctx: Context) => {
  const signals = getMockSignals();

  await ctx.replyWithHTML(
    `<b>📊 Latest Signals (demo — 3 most recent)</b>\n<i>Live feed available in the Signals channel.</i>`,
  );

  for (const signal of signals) {
    await ctx.replyWithHTML(formatSignal(signal));
  }
});

// ---------------------------------------------------------------------------
// /arb — Latest arb opportunity (mock)
// ---------------------------------------------------------------------------

bot.command('arb', async (ctx: Context) => {
  const arbs = getMockArbAlerts();
  const latest = arbs[0];

  if (!latest) {
    await ctx.reply('No arb alerts in the mock dataset. Check back soon.');
    return;
  }

  await ctx.replyWithHTML(
    [
      `<b>⚡ Latest Arb Alert (demo)</b>`,
      `<i>Real-time alerts with Kelly sizing in @ArbScannerPro.</i>`,
      ``,
      formatArbAlert(latest),
    ].join('\n'),
  );
});

// ---------------------------------------------------------------------------
// /subscribe — Payment instructions
// ---------------------------------------------------------------------------

bot.command('subscribe', async (ctx: Context) => {
  await ctx.replyWithHTML(
    [
      `<b>🔐 Join Supermolt Signals</b>`,
      ``,
      `<b>Tier 1 — Supermolt Signals ($49/mo)</b>`,
      `2–3 EV signals/day, Kelly sizing, weekly P&amp;L report`,
      `→ <a href="https://supermolt.io/subscribe/signals">supermolt.io/subscribe/signals</a>`,
      ``,
      `<b>Tier 2 — Arb Scanner Pro ($79/mo)</b>`,
      `Real-time arb alerts (Polymarket × bookmakers) + Tier 1 included`,
      `→ <a href="https://supermolt.io/subscribe/arb">supermolt.io/subscribe/arb</a>`,
      ``,
      `<b>Tier 3 — Alpha Concierge ($299/mo)</b>`,
      `Monthly 1:1 with Henry, custom EV analysis, dashboard access. 5 spots.`,
      `→ <a href="https://supermolt.io/concierge">supermolt.io/concierge</a>`,
      ``,
      `<i>Payment via Stripe. No lock-in — cancel any time.</i>`,
      `<i>After payment, DM @[handle] with your receipt for manual invite (within 2h).</i>`,
    ].join('\n'),
    { link_preview_options: { is_disabled: true } },
  );
});

// ---------------------------------------------------------------------------
// Launch bot
// ---------------------------------------------------------------------------

bot.launch({
  dropPendingUpdates: true,
}).then(() => {
  console.log('[bot] Supermolt Signals bot is running. Ctrl+C to stop.');
  console.log(`[bot] Channels → free:${channels.freeChannelId} signals:${channels.signalsChannelId} arb:${channels.arbChannelId}`);
}).catch((err: unknown) => {
  console.error('[bot] Failed to launch:', err);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export { bot, channels };
