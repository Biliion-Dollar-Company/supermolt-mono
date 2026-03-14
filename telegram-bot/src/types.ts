/**
 * Core TypeScript interfaces for Supermolt Signals Telegram bot.
 * These mirror the signal/arb templates defined in the Telegram Launch Kit.
 */

/** Source reliability tag for each signal */
export type SignalSource = 'Live' | 'Estimate' | 'Live (Railway)' | 'Estimate (VPN)';

/** Direction of a Polymarket position */
export type SignalDirection = 'YES' | 'NO';

/** Outcome of a resolved market */
export type ResolvedOutcome = 'YES' | 'NO';

/** Result of a resolved call */
export type TradeResult = 'Win' | 'Loss';

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

/**
 * Full representation of a Polymarket EV signal.
 * Used by formatSignal, formatSignalCompact, and broadcastSignal.
 */
export interface SignalData {
  /** Human-readable market name, e.g. "Will the Fed cut rates in March 2026?" */
  marketName: string;

  /** YES or NO direction */
  direction: SignalDirection;

  /** Current Polymarket price in cents, e.g. 38 (= 38¢) */
  currentPriceCents: number;

  /** Expected value edge expressed as a percentage, e.g. 9.4 (= +9.4%) */
  evScorePercent: number;

  /** Kelly Criterion optimal position size as a % of bankroll, e.g. 4.2 */
  kellySizePercent: number;

  /**
   * Dollar amount on a $1,000 reference bankroll.
   * Derived from kellySizePercent × 10, but stored explicitly for display.
   */
  kellyAmountOn1kUSD: number;

  /** Bayesian posterior confidence as an integer %, e.g. 67 */
  confidencePercent: number;

  /** ISO date string when the market expires, e.g. "2026-03-19" */
  expiresAt: string;

  /** Number of days until expiry */
  daysRemaining: number;

  /** 1–2 sentence reasoning note */
  reasoning: string;

  /** Data source provenance */
  source: SignalSource;

  /** UTC posting time string, e.g. "09:14 UTC" */
  postedAt: string;

  /** Internal signal identifier */
  id?: string;

  /** ISO timestamp when this signal was created */
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Arb Alert
// ---------------------------------------------------------------------------

/**
 * Full representation of a cross-platform arbitrage opportunity.
 * Used by formatArbAlert and broadcastArb.
 */
export interface ArbData {
  /** Human-readable market/event name */
  marketName: string;

  /** Polymarket direction (YES or NO) */
  polymarketDirection: SignalDirection;

  /** Polymarket price in cents */
  polymarketPriceCents: number;

  /** External bookmaker name, e.g. "1WIN" or "DraftKings" */
  bookmakerName: string;

  /** Bookmaker outcome description, e.g. "Lakers ML" */
  bookmakerOutcome: string;

  /** Bookmaker decimal odds, e.g. 1.65 */
  bookmakerDecimalOdds: number;

  /** Bookmaker implied probability in cents, e.g. 60.6 */
  bookmakerImpliedCents: number;

  /** Total arb spread as a percentage, e.g. 6.3 */
  spreadPercent: number;

  /** Kelly stake on Polymarket side as a % of bankroll */
  kellyPolymarketPercent: number;

  /** Dollar amount on Polymarket side (per $1,000 bankroll) */
  kellyPolymarketAmountUSD: number;

  /** Kelly stake on bookmaker side as a % of bankroll */
  kellyBookmakerPercent: number;

  /** Dollar amount on bookmaker side (per $1,000 bankroll) */
  kellyBookmakerAmountUSD: number;

  /** ISO expiry datetime or human label, e.g. "Today, 23:00 UTC" */
  expiresAt: string;

  /** UTC posting time string, e.g. "11:42 UTC" */
  postedAt: string;

  /** How many minutes old this alert is at posting time */
  windowAgeMinutes: number;

  /** Internal alert identifier */
  id?: string;

  /** ISO timestamp when the alert was detected */
  detectedAt?: string;
}

// ---------------------------------------------------------------------------
// Resolved Trade
// ---------------------------------------------------------------------------

/**
 * Outcome post data when a previously signalled market resolves.
 * Used by formatResolvedOutcome.
 */
export interface ResolvedTradeData {
  marketName: string;
  calledDirection: SignalDirection;
  entryPriceCents: number;
  resolvedOutcome: ResolvedOutcome;
  exitPriceCents: number;
  result: TradeResult;
  returnPercent: number;
  entryDate: string;
  exitDate: string;
  kellySizePercent: number;
  /** Net gain/loss in USD on a $1,000 bankroll stake */
  gainLossOn1kUSD: number;
  /** Current running Brier score after this resolution, e.g. 0.1823 */
  brierScore: number;
  /** Change in Brier score (negative = improved) */
  brierDelta: number;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export type SubscriptionTier = 'free' | 'signals' | 'arb_pro' | 'alpha_concierge';

/** Mocked user subscription record */
export interface UserSubscription {
  telegramId: number;
  tier: SubscriptionTier;
  /** ISO date the subscription started */
  startDate: string;
  /** ISO date the subscription expires (undefined = never for lifetime/mock) */
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Channel config
// ---------------------------------------------------------------------------

/** Environment-sourced channel IDs */
export interface ChannelConfig {
  freeChannelId: string;
  signalsChannelId: string;
  arbChannelId: string;
  conciergeChannelId: string;
}
