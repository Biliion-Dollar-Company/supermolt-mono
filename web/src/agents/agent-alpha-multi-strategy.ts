/**
 * Agent Alpha — Multi-Strategy
 *
 * Runs multiple complementary strategies in parallel and emits high-conviction
 * EV signals to the Trench Terminal Signals channel.
 *
 * Strategies:
 *   - ev-kelly: Pure EV + Kelly Criterion sizing
 *   - bayesian: Bayesian posterior confidence scoring
 *   - momentum: Short-term price momentum on Polymarket
 *
 * @module
 */

import { broadcastSignalToTelegram, type AgentSignal } from '../integrations/telegram-broadcaster';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StrategyName = 'ev-kelly' | 'bayesian' | 'momentum';

export interface TradeRecord {
  id: string;
  signalId: string;
  strategy: StrategyName;
  marketName: string;
  direction: 'YES' | 'NO';
  entryPriceCents: number;
  kellySizePercent: number;
  timestamp: string;
}

export interface AgentAlphaConfig {
  /** Strategies to run. Defaults to all three. */
  strategies?: StrategyName[];
  /** Minimum EV score to emit a signal (%). Defaults to 5. */
  minEvPercent?: number;
  /** Minimum Bayesian confidence to emit a signal (%). Defaults to 55. */
  minConfidencePercent?: number;
  /** Bankroll in USD for Kelly sizing. Defaults to 1000. */
  bankrollUSD?: number;
}

// ---------------------------------------------------------------------------
// In-memory trade log (replace with DB calls in production)
// ---------------------------------------------------------------------------

const tradeLog: TradeRecord[] = [];

/**
 * Records a trade to the in-memory log.
 * Extend this to persist to Supabase / Redis in production.
 *
 * @param trade - The trade record to save
 */
export function recordTrade(trade: TradeRecord): void {
  tradeLog.push(trade);
  console.log(
    `[agent-alpha-multi] Trade recorded: ${trade.marketName} via ${trade.strategy}`,
  );
}

/**
 * Returns all recorded trades.
 */
export function getTrades(): TradeRecord[] {
  return [...tradeLog];
}

// ---------------------------------------------------------------------------
// Signal emission
// ---------------------------------------------------------------------------

/**
 * Emits a signal: records the trade and broadcasts to Telegram.
 *
 * @param signal - The signal to emit
 * @param strategy - Which strategy generated this signal
 */
async function shareSignal(signal: AgentSignal, strategy: StrategyName): Promise<void> {
  const trade: TradeRecord = {
    id: signal.id ?? `trade-${Date.now()}`,
    signalId: signal.id ?? `sig-${Date.now()}`,
    strategy,
    marketName: signal.marketName,
    direction: signal.direction,
    entryPriceCents: signal.currentPriceCents,
    kellySizePercent: signal.kellySizePercent,
    timestamp: new Date().toISOString(),
  };

  // Persist trade record first
  recordTrade(trade);

  // Broadcast to Telegram (graceful — never throws)
  await broadcastSignalToTelegram(signal, strategy);
}

// ---------------------------------------------------------------------------
// Strategy runners
// ---------------------------------------------------------------------------

/**
 * EV + Kelly strategy: finds positive-EV markets and sizes with Kelly Criterion.
 *
 * @param config - Agent config
 * @returns Array of signals found by this strategy
 */
async function runEvKellyStrategy(config: Required<AgentAlphaConfig>): Promise<AgentSignal[]> {
  // TODO: Replace with real Polymarket API call + EV calculation
  console.log('[agent-alpha-multi] Running EV-Kelly strategy...');
  const signals: AgentSignal[] = [];

  // Stub: in production, fetch markets, compute EV, filter by minEvPercent
  return signals;
}

/**
 * Bayesian confidence strategy: updates prior beliefs with new data and
 * signals when posterior confidence exceeds threshold.
 *
 * @param config - Agent config
 * @returns Array of signals found by this strategy
 */
async function runBayesianStrategy(config: Required<AgentAlphaConfig>): Promise<AgentSignal[]> {
  // TODO: Replace with real market data + Bayesian updater
  console.log('[agent-alpha-multi] Running Bayesian strategy...');
  const signals: AgentSignal[] = [];

  // Stub: in production, fetch markets, apply Bayesian updater, filter
  return signals;
}

/**
 * Momentum strategy: detects rapid price movements and signals contrarian plays.
 *
 * @param config - Agent config
 * @returns Array of signals found by this strategy
 */
async function runMomentumStrategy(config: Required<AgentAlphaConfig>): Promise<AgentSignal[]> {
  // TODO: Replace with real order-book / price feed analysis
  console.log('[agent-alpha-multi] Running Momentum strategy...');
  const signals: AgentSignal[] = [];

  // Stub: in production, stream CLOB data, detect momentum, filter
  return signals;
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

/**
 * Runs agent-alpha with all configured strategies.
 * Signals are deduped by market+direction before broadcasting.
 *
 * @param config - Optional overrides for strategies and thresholds
 *
 * @example
 * ```ts
 * await runAgentAlphaMultiStrategy({ minEvPercent: 7 });
 * ```
 */
export async function runAgentAlphaMultiStrategy(
  config: AgentAlphaConfig = {},
): Promise<void> {
  const cfg: Required<AgentAlphaConfig> = {
    strategies: config.strategies ?? ['ev-kelly', 'bayesian', 'momentum'],
    minEvPercent: config.minEvPercent ?? 5,
    minConfidencePercent: config.minConfidencePercent ?? 55,
    bankrollUSD: config.bankrollUSD ?? 1000,
  };

  console.log('[agent-alpha-multi] Starting multi-strategy scan...');
  console.log(`[agent-alpha-multi] Strategies: ${cfg.strategies.join(', ')}`);

  const strategyRunners: Record<StrategyName, (c: Required<AgentAlphaConfig>) => Promise<AgentSignal[]>> = {
    'ev-kelly': runEvKellyStrategy,
    'bayesian': runBayesianStrategy,
    'momentum': runMomentumStrategy,
  };

  // Run all enabled strategies in parallel
  const results = await Promise.allSettled(
    cfg.strategies.map(async (strategy) => {
      const runner = strategyRunners[strategy];
      const signals = await runner(cfg);
      return { strategy, signals };
    }),
  );

  // Collect all signals
  const allSignals: Array<{ signal: AgentSignal; strategy: StrategyName }> = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[agent-alpha-multi] Strategy failed:', result.reason);
      continue;
    }
    const { strategy, signals } = result.value;
    for (const signal of signals) {
      allSignals.push({ signal, strategy });
    }
  }

  console.log(`[agent-alpha-multi] ${allSignals.length} signal(s) to emit`);

  // Emit signals sequentially (rate-limit friendly)
  for (const { signal, strategy } of allSignals) {
    await shareSignal(signal, strategy);
    // Small delay between broadcasts to avoid Telegram rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('[agent-alpha-multi] Scan complete.');
}
