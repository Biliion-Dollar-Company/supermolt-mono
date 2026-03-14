/**
 * Configuration loader — reads env vars and validates required ones at startup.
 */

import 'dotenv/config';
import type { ChannelConfig } from './types.js';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

/**
 * Loads and validates all required environment variables.
 * Throws on missing values so the bot fails fast rather than silently.
 */
export function loadConfig(): { botToken: string; channels: ChannelConfig } {
  const botToken = requireEnv('BOT_TOKEN');

  const channels: ChannelConfig = {
    freeChannelId: requireEnv('FREE_CHANNEL_ID'),
    signalsChannelId: requireEnv('SIGNALS_CHANNEL_ID'),
    arbChannelId: requireEnv('ARB_CHANNEL_ID'),
    conciergeChannelId: requireEnv('CONCIERGE_CHANNEL_ID'),
  };

  return { botToken, channels };
}
