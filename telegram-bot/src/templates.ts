/**
 * Message formatters for Supermolt Signals.
 *
 * All output uses Telegram HTML parse mode.
 * Templates mirror the copy in the Telegram Launch Kit exactly.
 */

import type { ArbData, ResolvedTradeData, SignalData } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a number with a forced + sign when positive.
 */
function signed(value: number, decimals = 1): string {
  const formatted = value.toFixed(decimals);
  return value >= 0 ? `+${formatted}` : formatted;
}

/**
 * Escape HTML special characters for Telegram HTML mode.
 */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// formatSignal — Full signal post
// ---------------------------------------------------------------------------

/**
 * Formats a SignalData object into the full Telegram signal template.
 *
 * @param data - The signal to format
 * @returns Telegram HTML string ready to send
 *
 * @example
 * ```ts
 * const msg = formatSignal(signal);
 * await ctx.telegram.sendMessage(SIGNALS_CHANNEL_ID, msg, { parse_mode: 'HTML' });
 * ```
 */
export function formatSignal(data: SignalData): string {
  return [
    `🎯 <b>SIGNAL: ${esc(data.marketName)}</b>`,
    ``,
    `Direction: <b>${data.direction} @ ${data.currentPriceCents}¢</b>`,
    `EV Score: <b>${signed(data.evScorePercent)}% edge</b>`,
    `Kelly Size: ${data.kellySizePercent.toFixed(1)}% of bankroll ($${data.kellyAmountOn1kUSD.toFixed(0)} on $1,000)`,
    `Confidence: ${data.confidencePercent}%`,
    `Expires: ${esc(data.expiresAt)} | ${data.daysRemaining} days`,
    ``,
    `Reasoning: ${esc(data.reasoning)}`,
    ``,
    `Source: ${esc(data.source)} | Posted ${esc(data.postedAt)}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// formatSignalCompact — Compact signal (high-volume days)
// ---------------------------------------------------------------------------

/**
 * Formats a SignalData object into the compact single-line template.
 * Used on days with 3+ signals to keep channel clean.
 */
export function formatSignalCompact(data: SignalData): string {
  const oneLiner = esc(data.reasoning.split('.')[0] ?? data.reasoning);
  return [
    `📊 <b>${esc(data.marketName)}</b>`,
    `${data.direction} @ ${data.currentPriceCents}¢ | EV: ${signed(data.evScorePercent)}% | Kelly: ${data.kellySizePercent.toFixed(1)}% ($${data.kellyAmountOn1kUSD.toFixed(0)}/$1K) | Conf: ${data.confidencePercent}%`,
    `${oneLiner}`,
    `Expires: ${esc(data.expiresAt)} | ${esc(data.source)} ${esc(data.postedAt)}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// formatArbAlert — Full arb alert post
// ---------------------------------------------------------------------------

/**
 * Formats an ArbData object into the standard arb alert template.
 * Includes the stale-data warning footer.
 */
export function formatArbAlert(data: ArbData): string {
  const staleLine =
    data.windowAgeMinutes > 15
      ? `⚠️ <b>Alert is ${data.windowAgeMinutes} min old — verify spread is still live before executing.</b>`
      : `⚠️ If &gt;15 min old — verify spread is still live before executing.`;

  return [
    `⚡ <b>ARB ALERT</b>`,
    ``,
    `Market: ${esc(data.marketName)}`,
    `Platform A: Polymarket ${data.polymarketDirection} @ ${data.polymarketPriceCents}¢`,
    `Platform B: ${esc(data.bookmakerName)} — ${esc(data.bookmakerOutcome)} @ ${data.bookmakerDecimalOdds.toFixed(2)} (${data.bookmakerImpliedCents.toFixed(1)}¢ implied)`,
    ``,
    `Spread: <b>${data.spreadPercent.toFixed(1)}%</b>`,
    `Expected edge: <b>${signed(data.spreadPercent)}% guaranteed (both sides)</b>`,
    ``,
    `Kelly stake (Platform A): ${data.kellyPolymarketPercent.toFixed(1)}% of bankroll ($${data.kellyPolymarketAmountUSD.toFixed(0)} on $1,000)`,
    `Kelly stake (Platform B): ${data.kellyBookmakerPercent.toFixed(1)}% of bankroll ($${data.kellyBookmakerAmountUSD.toFixed(0)} on $1,000)`,
    ``,
    `Expires: ${esc(data.expiresAt)}`,
    `Posted: ${esc(data.postedAt)} | Window age: ${data.windowAgeMinutes} min`,
    staleLine,
    ``,
    `Source: Live scanner`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// formatResolvedOutcome — Resolved trade post
// ---------------------------------------------------------------------------

/**
 * Formats a ResolvedTradeData object into the resolved signal outcome template.
 * Posted when a market resolves and a previous signal can be closed.
 */
export function formatResolvedOutcome(data: ResolvedTradeData): string {
  const brierDirection = data.brierDelta <= 0 ? '↑ improved' : '↓ slipped';
  const brierAbsDelta = Math.abs(data.brierDelta).toFixed(4);
  const resultEmoji = data.result === 'Win' ? '✅' : '❌';
  const gainLossSign = data.gainLossOn1kUSD >= 0 ? '+' : '';

  return [
    `${resultEmoji} <b>RESOLVED: ${esc(data.marketName)}</b>`,
    ``,
    `Called: ${data.calledDirection} @ ${data.entryPriceCents}¢`,
    `Resolved: ${data.resolvedOutcome} @ ${data.exitPriceCents}¢`,
    `Result: <b>${data.result} | ${signed(data.returnPercent)}% return</b>`,
    ``,
    `Entry date: ${esc(data.entryDate)} | Exit date: ${esc(data.exitDate)}`,
    `Kelly-sized: ${data.kellySizePercent.toFixed(1)}% bankroll — ${gainLossSign}$${Math.abs(data.gainLossOn1kUSD).toFixed(2)} on $1,000 stake`,
    ``,
    `Running Brier score: ${data.brierScore.toFixed(4)} (${brierDirection} by ${brierAbsDelta})`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// formatFreePreviewTeaser — Teaser for the free channel
// ---------------------------------------------------------------------------

/**
 * Wraps a raw teaser string into a styled free-channel post.
 */
export function formatFreePreviewTeaser(preview: string): string {
  return [
    `👀 <b>Free Preview</b>`,
    ``,
    esc(preview),
    ``,
    `<i>Full signals (2–3/day) + real-time arb alerts:</i>`,
    `→ Supermolt Signals: $49/mo`,
    `→ Arb Scanner Pro: $79/mo`,
    `→ <a href="https://supermolt.io/subscribe">supermolt.io/subscribe</a>`,
  ].join('\n');
}
