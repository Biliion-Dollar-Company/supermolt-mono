/**
 * Telegram broadcaster integration for agent-alpha.
 *
 * Sends formatted EV signals to the Supermolt Telegram channels.
 * Uses the Telegram Bot API directly via fetch — no telegraf dependency needed.
 *
 * @remarks
 * Graceful degradation: if BOT_TOKEN or SIGNALS_CHANNEL_ID is not set,
 * a warning is logged and the function returns without throwing.
 *
 * Enable by setting env vars:
 *   BOT_TOKEN=<your bot token>
 *   SIGNALS_CHANNEL_ID=<channel id or @handle>
 *
 * @module
 */

/** Subset of the Telegram SignalData shape used by agent-alpha */
export interface AgentSignal {
  /** Human-readable market name */
  marketName: string;
  /** YES or NO */
  direction: 'YES' | 'NO';
  /** Current price in cents, e.g. 38 */
  currentPriceCents: number;
  /** EV edge percentage, e.g. 9.4 */
  evScorePercent: number;
  /** Kelly size as % of bankroll */
  kellySizePercent: number;
  /** Kelly amount on $1,000 bankroll */
  kellyAmountOn1kUSD: number;
  /** Bayesian confidence %, e.g. 67 */
  confidencePercent: number;
  /** Expiry date string, e.g. "Mar 19, 2026" */
  expiresAt: string;
  /** Days remaining until expiry */
  daysRemaining: number;
  /** 1–2 sentence reasoning note */
  reasoning: string;
  /** Data source label */
  source: string;
  /** UTC posting time string */
  postedAt: string;
  /** Optional internal signal ID */
  id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function signed(value: number, decimals = 1): string {
  const formatted = value.toFixed(decimals);
  return value >= 0 ? `+${formatted}` : formatted;
}

/**
 * Formats a signal into the Supermolt HTML template for Telegram.
 *
 * @param signal - The signal to format
 * @param strategy - Strategy name label, e.g. "EV-Kelly" or "Momentum"
 * @returns HTML string ready for Telegram's parse_mode=HTML
 */
function formatSignalMessage(signal: AgentSignal, strategy: string): string {
  return [
    `🎯 <b>SIGNAL [${esc(strategy)}]: ${esc(signal.marketName)}</b>`,
    ``,
    `Direction: <b>${signal.direction} @ ${signal.currentPriceCents}¢</b>`,
    `EV Score: <b>${signed(signal.evScorePercent)}% edge</b>`,
    `Kelly Size: ${signal.kellySizePercent.toFixed(1)}% of bankroll ($${signal.kellyAmountOn1kUSD.toFixed(0)} on $1,000)`,
    `Confidence: ${signal.confidencePercent}%`,
    `Expires: ${esc(signal.expiresAt)} | ${signal.daysRemaining} days`,
    ``,
    `Reasoning: ${esc(signal.reasoning)}`,
    ``,
    `Source: ${esc(signal.source)} | Posted ${esc(signal.postedAt)}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// broadcastSignalToTelegram
// ---------------------------------------------------------------------------

/**
 * Broadcasts an agent signal to the configured Telegram signals channel.
 *
 * Reads BOT_TOKEN and SIGNALS_CHANNEL_ID from the environment.
 * If either is missing, logs a warning and returns without throwing.
 *
 * @param signal - The signal to broadcast
 * @param strategy - Strategy identifier (used as label in the message)
 *
 * @example
 * ```ts
 * await broadcastSignalToTelegram(signal, 'EV-Kelly');
 * ```
 */
export async function broadcastSignalToTelegram(
  signal: AgentSignal,
  strategy: string,
): Promise<void> {
  const botToken = process.env.BOT_TOKEN;
  const channelId = process.env.SIGNALS_CHANNEL_ID;

  if (!botToken) {
    console.warn('[telegram-broadcaster] BOT_TOKEN not set — skipping Telegram broadcast');
    return;
  }

  if (!channelId) {
    console.warn('[telegram-broadcaster] SIGNALS_CHANNEL_ID not set — skipping Telegram broadcast');
    return;
  }

  const text = formatSignalMessage(signal, strategy);
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[telegram-broadcaster] Telegram API error ${response.status}: ${body}`,
      );
      return;
    }

    console.log(
      `[telegram-broadcaster] Signal broadcast — ${signal.marketName} (${strategy})`,
    );
  } catch (err) {
    // Never throw — log and continue
    console.error('[telegram-broadcaster] Failed to send Telegram message:', err);
  }
}
