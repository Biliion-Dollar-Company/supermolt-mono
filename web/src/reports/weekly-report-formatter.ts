/**
 * Weekly Report Formatter — HTML formatter for Telegram.
 *
 * Produces a Telegram-compatible HTML message with 6 sections:
 *   1. 📅 Week Summary
 *   2. 📊 7-Day P&L Trend (emoji bar chart)
 *   3. 🏆 Best Strategy
 *   4. 🌍 Market Regime
 *   5. 🎯 Brier Score Trend
 *   6. 🔮 Next Week Outlook
 *
 * Auto-truncates to 4096 characters (Telegram HTML limit).
 *
 * @module
 */

import { type WeeklyReportData } from './weekly-report.ts';

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

/** Escapes special HTML characters for Telegram HTML parse mode */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Formats a number as USD with sign prefix */
function fmtUsd(n: number): string {
  const abs = Math.abs(n).toFixed(2);
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
}

/** Formats a percentage with configurable decimal places */
function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

/** Returns a P&L trend emoji for a single day */
function trendEmoji(pnl: number): string {
  if (pnl > 5) return '📈';
  if (pnl < -5) return '📉';
  return '➡️';
}

/** Formats a date string like "Mon Mar 11" */
function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Section 1 — 📅 Week Summary
 */
function buildSummarySection(data: WeeklyReportData): string {
  const lines: string[] = [
    `<b>📅 Week Summary</b>`,
    `<code>${esc(fmtDate(data.weekStart))} → ${esc(fmtDate(data.weekEnd))}</code>`,
    ``,
    `• Total Trades: <b>${data.totalTrades}</b>`,
    `• Win Rate: <b>${fmtPct(data.winRate)}</b>`,
    `• Realized P&amp;L: <b>${esc(fmtUsd(data.realizedPnl))}</b>`,
    `• Open Positions: <b>${data.openPositions}</b>`,
    `• Weekly P&amp;L: <b>${esc(fmtUsd(data.weeklyPnl))}</b>`,
  ];
  return lines.join('\n');
}

/**
 * Section 2 — 📊 7-Day P&L Trend (emoji bar chart)
 */
function buildTrendSection(data: WeeklyReportData): string {
  if (data.dailyTrend.length === 0) {
    return `<b>📊 7-Day P&amp;L Trend</b>\n<i>No data available</i>`;
  }

  const bars = data.dailyTrend
    .map((d) => `${trendEmoji(d.pnl)} <code>${esc(fmtDate(d.date))}</code> <b>${esc(fmtUsd(d.pnl))}</b> (${d.tradeCount} trade${d.tradeCount !== 1 ? 's' : ''})`)
    .join('\n');

  return [`<b>📊 7-Day P&amp;L Trend</b>`, ``, bars].join('\n');
}

/**
 * Section 3 — 🏆 Best Strategy
 */
function buildStrategySection(data: WeeklyReportData): string {
  const lines: string[] = [`<b>🏆 Strategy Highlights</b>`];

  if (data.bestStrategy) {
    lines.push(
      ``,
      `🥇 <b>Best: ${esc(data.bestStrategy.name)}</b>`,
      `  Win Rate: ${fmtPct(data.bestStrategy.winRate)}  |  P&amp;L: <b>${esc(fmtUsd(data.bestStrategy.realizedPnl))}</b>`,
    );
  } else {
    lines.push(``, `<i>No resolved strategies this week</i>`);
  }

  if (data.worstStrategy) {
    lines.push(
      ``,
      `📉 <b>Worst: ${esc(data.worstStrategy.name)}</b>`,
      `  Win Rate: ${fmtPct(data.worstStrategy.winRate)}  |  P&amp;L: <b>${esc(fmtUsd(data.worstStrategy.realizedPnl))}</b>`,
    );
  }

  return lines.join('\n');
}

/**
 * Section 4 — 🌍 Market Regime
 */
function buildRegimeSection(data: WeeklyReportData): string {
  const r = data.regime;
  const total = r.bull + r.bear + r.sideways;

  const regimeBar = (count: number, emoji: string, label: string): string => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const bars = Math.round(pct / 10);
    return `${emoji} ${label}: ${'█'.repeat(bars)}${'░'.repeat(10 - bars)} ${pct}% (${count}d)`;
  };

  const currentEmoji =
    r.current === 'bull' ? '🟢' : r.current === 'bear' ? '🔴' : '🟡';
  const kellyLabel =
    r.kellyMultiplier === 1.2 ? '×1.2 (aggressive)' : r.kellyMultiplier === 0.8 ? '×0.8 (conservative)' : '×1.0 (baseline)';

  return [
    `<b>🌍 Market Regime</b>`,
    ``,
    `<code>${regimeBar(r.bull, '🟢', 'Bull    ')}</code>`,
    `<code>${regimeBar(r.bear, '🔴', 'Bear    ')}</code>`,
    `<code>${regimeBar(r.sideways, '🟡', 'Sideways')}</code>`,
    ``,
    `Current: ${currentEmoji} <b>${r.current.toUpperCase()}</b>  |  Kelly: <b>${kellyLabel}</b>`,
  ].join('\n');
}

/**
 * Section 5 — 🎯 Brier Score Trend
 */
function buildBrierSection(data: WeeklyReportData): string {
  const lines: string[] = [`<b>🎯 Brier Score Trend</b>`];

  if (data.avgBrierScore === null) {
    lines.push(``, `<i>Insufficient data for Brier score this week</i>`);
    return lines.join('\n');
  }

  const thisWeek = data.avgBrierScore;
  const prior = data.priorWeekBrierScore;

  const quality =
    thisWeek < 0.15
      ? '🟢 Excellent calibration'
      : thisWeek < 0.25
        ? '🟡 Good calibration'
        : '🔴 Needs improvement';

  lines.push(``, `This week: <b>${thisWeek.toFixed(4)}</b> ${quality}`);

  if (prior !== null) {
    const delta = thisWeek - prior;
    const arrow = delta < 0 ? '📈 Improved' : delta > 0 ? '📉 Worsened' : '➡️ Unchanged';
    lines.push(`Prior week: <b>${prior.toFixed(4)}</b>  |  ${arrow} by ${Math.abs(delta).toFixed(4)}`);
  } else {
    lines.push(`Prior week: <i>No data</i>`);
  }

  return lines.join('\n');
}

/**
 * Section 6 — 🔮 Next Week Outlook
 */
function buildOutlookSection(data: WeeklyReportData): string {
  return [
    `<b>🔮 Next Week Outlook</b>`,
    ``,
    esc(data.nextWeekOutlook),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

/** Maximum Telegram HTML message length */
const TELEGRAM_MAX_CHARS = 4096;

/** Separator line between sections */
const SEPARATOR = '\n\n───────────────\n\n';

/**
 * Formats a WeeklyReportData into a Telegram-compatible HTML string.
 *
 * Auto-truncates at 4096 characters with a truncation notice appended.
 *
 * @param data - The weekly report payload
 * @returns HTML string ready for Telegram parse_mode=HTML
 */
export function formatWeeklyReport(data: WeeklyReportData): string {
  const modeTag = data.mode === 'mock' ? ' <i>[MOCK]</i>' : '';
  const header = `🗓 <b>POLYMARKET WEEKLY REPORT</b>${modeTag}`;

  const sections = [
    header,
    buildSummarySection(data),
    buildTrendSection(data),
    buildStrategySection(data),
    buildRegimeSection(data),
    buildBrierSection(data),
    buildOutlookSection(data),
  ];

  const full = sections.join(SEPARATOR);

  if (full.length <= TELEGRAM_MAX_CHARS) {
    return full;
  }

  // Truncate and append notice
  const truncateNotice = '\n\n<i>... [truncated — message too long]</i>';
  const limit = TELEGRAM_MAX_CHARS - truncateNotice.length;
  return full.slice(0, limit) + truncateNotice;
}

/**
 * Returns the character length of the formatted report (useful for tests).
 *
 * @param data - The weekly report payload
 */
export function formatWeeklyReportLength(data: WeeklyReportData): number {
  return formatWeeklyReport(data).length;
}
