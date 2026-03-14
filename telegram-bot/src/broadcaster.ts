/**
 * Broadcaster — sends formatted messages to the correct Supermolt Telegram channels.
 *
 * All functions accept a Telegraf bot instance + channel IDs from env,
 * so they can be called from both the interactive bot and the agent-alpha pipeline.
 *
 * @remarks
 * Channel IDs must start with '-100' for public channels or be '@handle' strings.
 * Pass them in via the ChannelConfig object sourced from config.ts.
 */

import { Telegraf } from 'telegraf';
import type { ArbData, ChannelConfig, SignalData } from './types.js';
import {
  formatArbAlert,
  formatFreePreviewTeaser,
  formatSignal,
} from './templates.js';

/** Telegram parse_mode used for all broadcasts */
const PARSE_MODE = 'HTML' as const;

// ---------------------------------------------------------------------------
// broadcastSignal
// ---------------------------------------------------------------------------

/**
 * Posts a formatted EV signal to the paid Signals channel.
 *
 * @param bot - Telegraf bot instance
 * @param channels - Channel IDs config
 * @param signal - The signal data to format and send
 * @returns The sent message object
 *
 * @example
 * ```ts
 * await broadcastSignal(bot, channels, mockSignals[0]);
 * ```
 */
export async function broadcastSignal(
  bot: Telegraf,
  channels: ChannelConfig,
  signal: SignalData,
): Promise<void> {
  const text = formatSignal(signal);
  await bot.telegram.sendMessage(channels.signalsChannelId, text, {
    parse_mode: PARSE_MODE,
  });
  console.log(`[broadcaster] Signal broadcast to Signals channel: ${signal.marketName}`);
}

// ---------------------------------------------------------------------------
// broadcastArb
// ---------------------------------------------------------------------------

/**
 * Posts a formatted arb alert to the Arb Scanner Pro channel.
 *
 * @param bot - Telegraf bot instance
 * @param channels - Channel IDs config
 * @param arb - The arb data to format and send
 */
export async function broadcastArb(
  bot: Telegraf,
  channels: ChannelConfig,
  arb: ArbData,
): Promise<void> {
  const text = formatArbAlert(arb);
  await bot.telegram.sendMessage(channels.arbChannelId, text, {
    parse_mode: PARSE_MODE,
  });
  console.log(`[broadcaster] Arb alert broadcast to Arb Pro channel: ${arb.marketName}`);
}

// ---------------------------------------------------------------------------
// broadcastFreePreview
// ---------------------------------------------------------------------------

/**
 * Posts a teaser/preview message to the free public channel.
 * The preview string is wrapped in the standard free-channel template.
 *
 * @param bot - Telegraf bot instance
 * @param channels - Channel IDs config
 * @param preview - Raw teaser text (no HTML needed — will be escaped internally)
 */
export async function broadcastFreePreview(
  bot: Telegraf,
  channels: ChannelConfig,
  preview: string,
): Promise<void> {
  const text = formatFreePreviewTeaser(preview);
  await bot.telegram.sendMessage(channels.freeChannelId, text, {
    parse_mode: PARSE_MODE,
  });
  console.log(`[broadcaster] Free preview broadcast to public channel.`);
}

// ---------------------------------------------------------------------------
// broadcastToConcierge
// ---------------------------------------------------------------------------

/**
 * Posts a raw HTML message directly to the Alpha Concierge group.
 * For custom 1:1 content that doesn't need a standard template.
 *
 * @param bot - Telegraf bot instance
 * @param channels - Channel IDs config
 * @param htmlMessage - Pre-formatted HTML message string
 */
export async function broadcastToConcierge(
  bot: Telegraf,
  channels: ChannelConfig,
  htmlMessage: string,
): Promise<void> {
  await bot.telegram.sendMessage(channels.conciergeChannelId, htmlMessage, {
    parse_mode: PARSE_MODE,
  });
  console.log(`[broadcaster] Message sent to Alpha Concierge.`);
}
