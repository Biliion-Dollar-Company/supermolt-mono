/**
 * Bankroll Manager
 *
 * Tracks total capital, per-strategy allocations, drawdown, and enforces
 * Kelly criterion caps across all trading strategies.
 *
 * Features:
 * - Kelly cap enforcement (default 10% per bet)
 * - Per-strategy drawdown tracking
 * - Portfolio-level circuit breaker
 * - JSON persistence to data/bankroll.json
 *
 * Circuit-breaker integration: if /src/strategies/circuit-breaker.ts exists,
 * import BankrollManager there and call checkCircuitBreaker() in the evaluation flow.
 *
 * @module
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the bankroll manager */
export interface BankrollConfig {
  /** Total USD capital available */
  totalCapital: number;
  /** Maximum fraction of total capital per bet (default 0.10 = 10%) */
  kellyCapPct: number;
  /** Drawdown fraction that triggers a halt (default 0.25 = 25%) */
  maxDrawdownPct: number;
  /** Per-strategy allocation state */
  strategies: Record<string, StrategyAllocation>;
}

/** Allocation and performance state for a single strategy */
export interface StrategyAllocation {
  strategyId: string;
  /** Capital assigned to this strategy */
  allocatedCapital: number;
  /** Capital currently deployed in open positions */
  usedCapital: number;
  /** Running P&L for the current day */
  dailyPnL: number;
  /** Cumulative P&L since inception */
  totalPnL: number;
  /** Worst drawdown recorded for this strategy */
  maxDrawdown: number;
  /** Current drawdown (negative = in drawdown) */
  currentDrawdown: number;
  /** Operational status */
  status: 'ACTIVE' | 'PAUSED' | 'HALTED';
}

/** Full snapshot of bankroll health */
export interface BankrollStatus {
  totalCapital: number;
  availableCapital: number;
  usedCapital: number;
  dailyPnL: number;
  totalPnL: number;
  /** Current drawdown as a fraction of total capital (0–1) */
  drawdownPct: number;
  maxDrawdownPct: number;
  status: 'HEALTHY' | 'DEGRADED' | 'HALTED';
  strategies: StrategyAllocation[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_KELLY_CAP_PCT = 0.10;
const DEFAULT_MAX_DRAWDOWN_PCT = 0.25;

// Resolve data directory relative to this file (works in both ESM and CJS)
const DATA_DIR = (() => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    return path.resolve(path.dirname(__filename), '..', '..', 'data');
  } catch {
    return path.resolve('data');
  }
})();

const BANKROLL_FILE = path.join(DATA_DIR, 'bankroll.json');

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/** Load persisted config from disk; returns null if file is missing or corrupt */
function loadFromDisk(): BankrollConfig | null {
  try {
    if (!fs.existsSync(BANKROLL_FILE)) return null;
    const raw = fs.readFileSync(BANKROLL_FILE, 'utf-8');
    return JSON.parse(raw) as BankrollConfig;
  } catch {
    return null;
  }
}

/** Persist config to disk; silently ignores write errors */
function saveToDisk(config: BankrollConfig): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BANKROLL_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Non-fatal: log and continue
    console.error('[BankrollManager] Failed to persist state to disk');
  }
}

// ---------------------------------------------------------------------------
// BankrollManager class
// ---------------------------------------------------------------------------

/**
 * Manages capital allocation, Kelly-criterion caps, and drawdown tracking
 * across multiple trading strategies.
 *
 * @example
 * ```typescript
 * const bm = new BankrollManager({ totalCapital: 10_000 });
 * const ok = bm.allocateCapital('MOMENTUM', 800); // true — within 10% cap
 * bm.recordPnL('MOMENTUM', -200);
 * const status = bm.getStatus();
 * ```
 */
export class BankrollManager {
  private config: BankrollConfig;

  /**
   * Create a new BankrollManager.
   *
   * If a persisted `data/bankroll.json` exists, it is loaded first.
   * Explicit constructor overrides take precedence over persisted values.
   *
   * @param overrides - Partial config to override defaults / persisted state
   */
  constructor(overrides: Partial<BankrollConfig> = {}) {
    const persisted = loadFromDisk();

    this.config = {
      totalCapital: overrides.totalCapital ?? persisted?.totalCapital ?? 10_000,
      kellyCapPct: overrides.kellyCapPct ?? persisted?.kellyCapPct ?? DEFAULT_KELLY_CAP_PCT,
      maxDrawdownPct: overrides.maxDrawdownPct ?? persisted?.maxDrawdownPct ?? DEFAULT_MAX_DRAWDOWN_PCT,
      strategies: overrides.strategies ?? persisted?.strategies ?? {},
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Returns a full snapshot of the current bankroll state.
   */
  getStatus(): BankrollStatus {
    const strategies = Object.values(this.config.strategies);
    const usedCapital = strategies.reduce((sum, s) => sum + s.usedCapital, 0);
    const dailyPnL = strategies.reduce((sum, s) => sum + s.dailyPnL, 0);
    const totalPnL = strategies.reduce((sum, s) => sum + s.totalPnL, 0);
    const availableCapital = this.config.totalCapital - usedCapital;

    // Drawdown = how far capital has fallen from its peak
    const peak = this.config.totalCapital;
    const current = this.config.totalCapital + totalPnL;
    const drawdownPct = peak > 0 ? Math.max(0, (peak - current) / peak) : 0;

    let status: BankrollStatus['status'] = 'HEALTHY';
    if (drawdownPct >= this.config.maxDrawdownPct) {
      status = 'HALTED';
    } else if (drawdownPct >= this.config.maxDrawdownPct * 0.5) {
      status = 'DEGRADED';
    }

    return {
      totalCapital: this.config.totalCapital,
      availableCapital,
      usedCapital,
      dailyPnL,
      totalPnL,
      drawdownPct,
      maxDrawdownPct: this.config.maxDrawdownPct,
      status,
      strategies,
    };
  }

  /**
   * Attempt to allocate capital to a strategy.
   *
   * Returns `false` (and does NOT allocate) if the amount would exceed
   * `totalCapital * kellyCapPct`, or if the overall circuit breaker is OPEN.
   *
   * @param strategyId - Unique identifier for the strategy
   * @param amount - USD amount to allocate
   */
  allocateCapital(strategyId: string, amount: number): boolean {
    const cap = this.getKellyCap(strategyId);
    if (amount > cap) return false;
    if (this.checkCircuitBreaker() === 'OPEN') return false;

    this._ensureStrategy(strategyId);
    const strategy = this.config.strategies[strategyId]!;

    if (strategy.status === 'HALTED') return false;

    strategy.allocatedCapital += amount;
    strategy.usedCapital += amount;

    this._save();
    return true;
  }

  /**
   * Record a P&L event for a strategy (positive = profit, negative = loss).
   *
   * Updates dailyPnL, totalPnL, and recalculates drawdown.
   * Halts the strategy if its drawdown exceeds maxDrawdownPct.
   *
   * @param strategyId - Strategy to record P&L for
   * @param pnl - Dollar amount (positive or negative)
   */
  recordPnL(strategyId: string, pnl: number): void {
    this._ensureStrategy(strategyId);
    const strategy = this.config.strategies[strategyId]!;

    strategy.dailyPnL += pnl;
    strategy.totalPnL += pnl;

    // Update used capital (reduce when we get returns)
    if (pnl < 0) {
      strategy.usedCapital = Math.max(0, strategy.usedCapital + pnl);
    }

    // Recalculate strategy-level drawdown
    const strategyPeak = strategy.allocatedCapital;
    const strategyCurrent = strategy.allocatedCapital + strategy.totalPnL;
    strategy.currentDrawdown = strategyPeak > 0
      ? Math.max(0, (strategyPeak - strategyCurrent) / strategyPeak)
      : 0;

    if (strategy.currentDrawdown > strategy.maxDrawdown) {
      strategy.maxDrawdown = strategy.currentDrawdown;
    }

    // Halt strategy if its own drawdown is catastrophic
    if (strategy.currentDrawdown >= this.config.maxDrawdownPct) {
      strategy.status = 'HALTED';
    }

    this._save();
  }

  /**
   * Reset daily P&L for all strategies (call at each day rollover).
   */
  resetDailyPnL(): void {
    for (const strategy of Object.values(this.config.strategies)) {
      strategy.dailyPnL = 0;
      // Re-activate PAUSED strategies; leave HALTED ones alone
      if (strategy.status === 'PAUSED') {
        strategy.status = 'ACTIVE';
      }
    }
    this._save();
  }

  /**
   * Check whether the portfolio-level circuit breaker should fire.
   *
   * @returns `'OPEN'` if the drawdown threshold is exceeded, `'CLOSED'` otherwise
   */
  checkCircuitBreaker(): 'OPEN' | 'CLOSED' {
    const { drawdownPct, maxDrawdownPct } = this.getStatus();
    return drawdownPct >= maxDrawdownPct ? 'OPEN' : 'CLOSED';
  }

  /**
   * Returns the maximum USD amount that can be allocated to a strategy
   * given the Kelly cap.
   *
   * @param strategyId - Strategy identifier (not currently used in cap calculation,
   *   included for future per-strategy caps)
   */
  getKellyCap(_strategyId: string): number {
    return this.config.totalCapital * this.config.kellyCapPct;
  }

  /**
   * Return a reference to the underlying config (useful for testing / persistence).
   */
  getConfig(): Readonly<BankrollConfig> {
    return this.config;
  }

  /**
   * Update total capital (e.g. after a deposit or withdrawal).
   * Persists the change.
   *
   * @param amount - New total capital in USD
   */
  setTotalCapital(amount: number): void {
    this.config.totalCapital = amount;
    this._save();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Ensure a strategy entry exists, creating a default one if not */
  private _ensureStrategy(strategyId: string): void {
    if (!this.config.strategies[strategyId]) {
      this.config.strategies[strategyId] = {
        strategyId,
        allocatedCapital: 0,
        usedCapital: 0,
        dailyPnL: 0,
        totalPnL: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        status: 'ACTIVE',
      };
    }
  }

  /** Persist current state to disk */
  private _save(): void {
    saveToDisk(this.config);
  }
}

// ---------------------------------------------------------------------------
// Singleton factory (optional convenience)
// ---------------------------------------------------------------------------

let _instance: BankrollManager | null = null;

/**
 * Get or create a singleton BankrollManager instance.
 *
 * @param overrides - Only applied on first creation
 */
export function getBankrollManager(overrides?: Partial<BankrollConfig>): BankrollManager {
  if (!_instance) {
    _instance = new BankrollManager(overrides);
  }
  return _instance;
}

/** Reset the singleton (primarily for testing) */
export function resetBankrollManagerSingleton(): void {
  _instance = null;
}
