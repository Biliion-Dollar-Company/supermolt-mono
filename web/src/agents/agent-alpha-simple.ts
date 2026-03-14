/**
 * Agent Alpha — Simple
 *
 * Single-strategy EV scanner. Finds positive-EV Polymarket opportunities,
 * applies Kelly Criterion sizing, and emits signals to Telegram.
 *
 * Lighter-weight alternative to the multi-strategy agent.
 * Ideal for quick scans or when running on limited resources.
 *
 * @module
 */

import { broadcastSignalToTelegram, type AgentSignal } from '../integrations/telegram-broadcaster';
import { AgentIdentity } from '../ens/index.ts';

// ---------------------------------------------------------------------------
// ENS identity (loaded once on first run)
// ---------------------------------------------------------------------------

/** Shared ENS identity for the surgecast.eth agent. */
const agentIdentity = new AgentIdentity('surgecast.eth');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimpleTradeRecord {
  id: string;
  signalId: string;
  marketName: string;
  direction: 'YES' | 'NO';
  entryPriceCents: number;
  kellySizePercent: number;
  timestamp: string;
}

export interface SimpleAgentConfig {
  /** Minimum EV score (%) to emit a signal. Defaults to 5. */
  minEvPercent?: number;
  /** Minimum confidence (%) to emit a signal. Defaults to 55. */
  minConfidencePercent?: number;
  /** Bankroll in USD for Kelly sizing. Defaults to 1000. */
  bankrollUSD?: number;
  /** Maximum number of signals to emit per run. Defaults to 5. */
  maxSignals?: number;
}

// ---------------------------------------------------------------------------
// In-memory trade log
// ---------------------------------------------------------------------------

const tradeLog: SimpleTradeRecord[] = [];

/**
 * Records a trade to the in-memory log.
 *
 * @param trade - The trade record to save
 */
export function recordTrade(trade: SimpleTradeRecord): void {
  tradeLog.push(trade);
  console.log(`[agent-alpha-simple] Trade recorded: ${trade.marketName}`);
}

/**
 * Returns all recorded trades.
 */
export function getTrades(): SimpleTradeRecord[] {
  return [...tradeLog];
}

// ---------------------------------------------------------------------------
// Signal emission
// ---------------------------------------------------------------------------

/**
 * Records the trade then broadcasts the signal to Telegram.
 *
 * @param signal - The signal to emit
 */
async function shareSignal(signal: AgentSignal): Promise<void> {
  const trade: SimpleTradeRecord = {
    id: signal.id ?? `trade-${Date.now()}`,
    signalId: signal.id ?? `sig-${Date.now()}`,
    marketName: signal.marketName,
    direction: signal.direction,
    entryPriceCents: signal.currentPriceCents,
    kellySizePercent: signal.kellySizePercent,
    timestamp: new Date().toISOString(),
  };

  // Persist trade record first
  recordTrade(trade);

  // Broadcast to Telegram (graceful — never throws)
  await broadcastSignalToTelegram(signal, 'EV-Simple');
}

// ---------------------------------------------------------------------------
// Market scanner
// ---------------------------------------------------------------------------

/**
 * Scans Polymarket for positive-EV opportunities.
 *
 * @param config - Agent config
 * @returns Filtered list of qualifying signals
 */
async function scanMarkets(config: Required<SimpleAgentConfig>): Promise<AgentSignal[]> {
  // TODO: Replace with real Polymarket CLOB API call
  console.log('[agent-alpha-simple] Scanning markets...');
  const signals: AgentSignal[] = [];

  // Stub: in production, fetch open markets, score EV, apply Kelly sizing,
  // filter by minEvPercent and minConfidencePercent, cap at maxSignals
  return signals.slice(0, config.maxSignals);
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

/**
 * Runs agent-alpha in simple (single-strategy) mode.
 *
 * @param config - Optional overrides for thresholds and limits
 *
 * @example
 * ```ts
 * await runAgentAlphaSimple({ minEvPercent: 7, maxSignals: 3 });
 * ```
 */
export async function runAgentAlphaSimple(config: SimpleAgentConfig = {}): Promise<void> {
  const cfg: Required<SimpleAgentConfig> = {
    minEvPercent: config.minEvPercent ?? 5,
    minConfidencePercent: config.minConfidencePercent ?? 55,
    bankrollUSD: config.bankrollUSD ?? 1000,
    maxSignals: config.maxSignals ?? 5,
  };

  // Load ENS identity once and display identity card on startup
  try {
    await agentIdentity.load();
    console.log(`[agent-alpha-simple] ENS identity: ${agentIdentity.getIdentityCard()}`);
  } catch {
    console.warn('[agent-alpha-simple] ENS identity load failed (continuing in demo mode)');
  }

  console.log('[agent-alpha-simple] Starting EV scan...');
  console.log(
    `[agent-alpha-simple] Thresholds: EV ≥ ${cfg.minEvPercent}%, Conf ≥ ${cfg.minConfidencePercent}%`,
  );

  let signals: AgentSignal[];

  try {
    signals = await scanMarkets(cfg);
  } catch (err) {
    console.error('[agent-alpha-simple] Market scan failed:', err);
    return;
  }

  console.log(`[agent-alpha-simple] ${signals.length} qualifying signal(s) found`);

  // Emit signals sequentially (rate-limit friendly)
  for (const signal of signals) {
    await shareSignal(signal);
    // Small delay between broadcasts to avoid Telegram rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('[agent-alpha-simple] Scan complete.');
}
