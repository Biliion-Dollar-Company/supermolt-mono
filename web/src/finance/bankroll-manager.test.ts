/**
 * Tests for BankrollManager
 *
 * Covers: Kelly cap enforcement, PnL recording, drawdown calculation,
 * circuit breaker trigger, daily PnL reset, JSON persistence (mocked),
 * HALTED status, singleton, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import {
  BankrollManager,
  getBankrollManager,
  resetBankrollManagerSingleton,
  type BankrollConfig,
} from './bankroll-manager.ts';

// ---------------------------------------------------------------------------
// Spy on fs so no files are written during tests
// ---------------------------------------------------------------------------

const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('{}'));
const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

beforeEach(() => {
  existsSyncSpy.mockReturnValue(false);
  readFileSyncSpy.mockReturnValue(Buffer.from('{}'));
  writeFileSyncSpy.mockClear();
  mkdirSyncSpy.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBM(overrides: Partial<BankrollConfig> = {}): BankrollManager {
  return new BankrollManager({
    totalCapital: 10_000,
    kellyCapPct: 0.10,
    maxDrawdownPct: 0.25,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. Constructor & defaults
// ---------------------------------------------------------------------------

describe('BankrollManager — constructor', () => {
  it('uses provided totalCapital', () => {
    const bm = makeBM({ totalCapital: 50_000 });
    expect(bm.getConfig().totalCapital).toBe(50_000);
  });

  it('defaults to 10% Kelly cap', () => {
    const bm = makeBM();
    expect(bm.getConfig().kellyCapPct).toBe(0.10);
  });

  it('defaults to 25% max drawdown', () => {
    const bm = makeBM();
    expect(bm.getConfig().maxDrawdownPct).toBe(0.25);
  });

  it('starts with empty strategies', () => {
    const bm = makeBM();
    expect(Object.keys(bm.getConfig().strategies)).toHaveLength(0);
  });

  it('loads persisted config when file exists', () => {
    const persisted: BankrollConfig = {
      totalCapital: 99_000,
      kellyCapPct: 0.05,
      maxDrawdownPct: 0.20,
      strategies: {},
    };
    existsSyncSpy.mockReturnValueOnce(true);
    readFileSyncSpy.mockReturnValueOnce(Buffer.from(JSON.stringify(persisted)));

    const bm = new BankrollManager();
    expect(bm.getConfig().totalCapital).toBe(99_000);
  });
});

// ---------------------------------------------------------------------------
// 2. getStatus()
// ---------------------------------------------------------------------------

describe('BankrollManager — getStatus()', () => {
  it('returns HEALTHY status with no allocations', () => {
    const status = makeBM().getStatus();
    expect(status.status).toBe('HEALTHY');
    expect(status.drawdownPct).toBe(0);
    expect(status.availableCapital).toBe(10_000);
    expect(status.usedCapital).toBe(0);
  });

  it('reflects correct totalCapital', () => {
    const status = makeBM({ totalCapital: 5_000 }).getStatus();
    expect(status.totalCapital).toBe(5_000);
  });

  it('aggregates strategies dailyPnL and totalPnL', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 500);
    bm.recordPnL('A', 100);
    bm.allocateCapital('B', 300);
    bm.recordPnL('B', -50);

    const status = bm.getStatus();
    expect(status.dailyPnL).toBe(50);
    expect(status.totalPnL).toBe(50);
  });

  it('reports DEGRADED when drawdown is halfway to threshold', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.20 });
    bm.allocateCapital('X', 1_000);
    // 10% loss → 50% of 20% threshold → DEGRADED
    bm.recordPnL('X', -1_000);
    const status = bm.getStatus();
    expect(status.status).toBe('DEGRADED');
  });

  it('reports HALTED when drawdown exceeds threshold', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.20 });
    bm.allocateCapital('X', 1_000);
    bm.recordPnL('X', -2_500); // 25% loss > 20% threshold
    const status = bm.getStatus();
    expect(status.status).toBe('HALTED');
  });
});

// ---------------------------------------------------------------------------
// 3. Kelly cap enforcement — allocateCapital()
// ---------------------------------------------------------------------------

describe('BankrollManager — allocateCapital() Kelly cap', () => {
  it('allows allocation within Kelly cap (exactly at cap)', () => {
    const bm = makeBM(); // 10% of 10_000 = 1_000
    expect(bm.allocateCapital('MOMENTUM', 1_000)).toBe(true);
  });

  it('allows allocation below Kelly cap', () => {
    const bm = makeBM();
    expect(bm.allocateCapital('MOMENTUM', 999)).toBe(true);
  });

  it('rejects allocation exceeding Kelly cap', () => {
    const bm = makeBM(); // cap = 1_000
    expect(bm.allocateCapital('MOMENTUM', 1_001)).toBe(false);
  });

  it('rejects allocation when circuit breaker is OPEN', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.10 });
    bm.allocateCapital('X', 500);
    bm.recordPnL('X', -1_100); // >10% drawdown → circuit open
    expect(bm.allocateCapital('Y', 100)).toBe(false);
  });

  it('rejects allocation for HALTED strategy', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.20 });
    bm.allocateCapital('X', 800);
    bm.recordPnL('X', -2_100); // strategy halted
    expect(bm.allocateCapital('X', 100)).toBe(false);
  });

  it('creates strategy entry on first allocation', () => {
    const bm = makeBM();
    bm.allocateCapital('NEW_STRAT', 500);
    expect(bm.getConfig().strategies['NEW_STRAT']).toBeDefined();
  });

  it('accumulates allocated capital across calls', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 200);
    bm.allocateCapital('A', 300);
    expect(bm.getConfig().strategies['A']!.allocatedCapital).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 4. PnL recording + drawdown calculation
// ---------------------------------------------------------------------------

describe('BankrollManager — recordPnL()', () => {
  it('updates dailyPnL correctly with profit', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 500);
    bm.recordPnL('A', 100);
    expect(bm.getConfig().strategies['A']!.dailyPnL).toBe(100);
  });

  it('updates totalPnL correctly with loss', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 500);
    bm.recordPnL('A', -200);
    expect(bm.getConfig().strategies['A']!.totalPnL).toBe(-200);
  });

  it('accumulates multiple PnL records', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 500);
    bm.recordPnL('A', 100);
    bm.recordPnL('A', -50);
    bm.recordPnL('A', 200);
    expect(bm.getConfig().strategies['A']!.totalPnL).toBe(250);
  });

  it('sets currentDrawdown > 0 on loss', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 1_000);
    bm.recordPnL('A', -200);
    const dd = bm.getConfig().strategies['A']!.currentDrawdown;
    expect(dd).toBeGreaterThan(0);
  });

  it('tracks maxDrawdown correctly', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 1_000);
    bm.recordPnL('A', -200); // 20% drawdown
    bm.recordPnL('A', 100);  // partial recovery
    const strat = bm.getConfig().strategies['A']!;
    expect(strat.maxDrawdown).toBeGreaterThanOrEqual(strat.currentDrawdown);
  });

  it('halts strategy when strategy drawdown exceeds maxDrawdownPct', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.25 });
    bm.allocateCapital('A', 1_000);
    bm.recordPnL('A', -300); // 30% strategy-level drawdown → HALTED
    expect(bm.getConfig().strategies['A']!.status).toBe('HALTED');
  });

  it('does not halt strategy below maxDrawdownPct', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.25 });
    bm.allocateCapital('A', 1_000);
    bm.recordPnL('A', -200); // 20% strategy drawdown → still ACTIVE
    expect(bm.getConfig().strategies['A']!.status).toBe('ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// 5. Circuit breaker
// ---------------------------------------------------------------------------

describe('BankrollManager — checkCircuitBreaker()', () => {
  it('returns CLOSED when healthy', () => {
    const bm = makeBM();
    expect(bm.checkCircuitBreaker()).toBe('CLOSED');
  });

  it('returns OPEN when portfolio drawdown >= maxDrawdownPct', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.25 });
    bm.allocateCapital('X', 1_000);
    bm.recordPnL('X', -2_600); // 26% loss > 25% threshold
    expect(bm.checkCircuitBreaker()).toBe('OPEN');
  });

  it('returns CLOSED when drawdown is exactly below threshold', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.25 });
    bm.allocateCapital('X', 1_000);
    bm.recordPnL('X', -2_400); // 24% < 25% → still CLOSED
    expect(bm.checkCircuitBreaker()).toBe('CLOSED');
  });

  it('returns OPEN at exactly the threshold', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.25 });
    bm.allocateCapital('X', 1_000);
    bm.recordPnL('X', -2_500); // exactly 25%
    expect(bm.checkCircuitBreaker()).toBe('OPEN');
  });
});

// ---------------------------------------------------------------------------
// 6. Daily PnL reset
// ---------------------------------------------------------------------------

describe('BankrollManager — resetDailyPnL()', () => {
  it('zeros out dailyPnL for all strategies', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 500);
    bm.recordPnL('A', 100);
    bm.allocateCapital('B', 300);
    bm.recordPnL('B', -50);

    bm.resetDailyPnL();

    expect(bm.getConfig().strategies['A']!.dailyPnL).toBe(0);
    expect(bm.getConfig().strategies['B']!.dailyPnL).toBe(0);
  });

  it('does not reset totalPnL', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 500);
    bm.recordPnL('A', 100);
    bm.resetDailyPnL();
    expect(bm.getConfig().strategies['A']!.totalPnL).toBe(100);
  });

  it('re-activates PAUSED strategies', () => {
    const bm = makeBM();
    bm.allocateCapital('A', 500);
    bm.getConfig().strategies['A']!.status = 'PAUSED';
    bm.resetDailyPnL();
    expect(bm.getConfig().strategies['A']!.status).toBe('ACTIVE');
  });

  it('does NOT re-activate HALTED strategies', () => {
    const bm = makeBM({ totalCapital: 10_000, maxDrawdownPct: 0.25 });
    bm.allocateCapital('A', 1_000);
    bm.recordPnL('A', -300); // strategy halted
    bm.resetDailyPnL();
    expect(bm.getConfig().strategies['A']!.status).toBe('HALTED');
  });
});

// ---------------------------------------------------------------------------
// 7. getKellyCap()
// ---------------------------------------------------------------------------

describe('BankrollManager — getKellyCap()', () => {
  it('returns 10% of totalCapital by default', () => {
    const bm = makeBM({ totalCapital: 20_000 });
    expect(bm.getKellyCap('ANY')).toBe(2_000);
  });

  it('reflects custom kellyCapPct', () => {
    const bm = makeBM({ totalCapital: 10_000, kellyCapPct: 0.05 });
    expect(bm.getKellyCap('ANY')).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 8. JSON persistence (mocked fs)
// ---------------------------------------------------------------------------

describe('BankrollManager — persistence', () => {
  it('calls writeFileSync when allocating', () => {
    writeFileSyncSpy.mockClear();
    const bm = makeBM();
    bm.allocateCapital('X', 200);
    expect(writeFileSyncSpy).toHaveBeenCalled();
  });

  it('calls writeFileSync when recording PnL', () => {
    const bm = makeBM();
    bm.allocateCapital('X', 200);
    writeFileSyncSpy.mockClear();
    bm.recordPnL('X', 50);
    expect(writeFileSyncSpy).toHaveBeenCalled();
  });

  it('gracefully handles missing file on load', () => {
    existsSyncSpy.mockReturnValueOnce(false);
    expect(() => new BankrollManager()).not.toThrow();
  });

  it('gracefully handles corrupt JSON on load', () => {
    existsSyncSpy.mockReturnValueOnce(true);
    readFileSyncSpy.mockReturnValueOnce(Buffer.from('INVALID_JSON{{{'));
    expect(() => new BankrollManager()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9. Singleton
// ---------------------------------------------------------------------------

describe('BankrollManager — singleton', () => {
  beforeEach(() => resetBankrollManagerSingleton());
  afterEach(() => resetBankrollManagerSingleton());

  it('returns the same instance on repeated calls', () => {
    const a = getBankrollManager({ totalCapital: 5_000 });
    const b = getBankrollManager({ totalCapital: 99_000 }); // overrides ignored
    expect(a).toBe(b);
  });

  it('reset creates a fresh instance', () => {
    const a = getBankrollManager({ totalCapital: 5_000 });
    resetBankrollManagerSingleton();
    const b = getBankrollManager({ totalCapital: 5_000 });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// 10. setTotalCapital()
// ---------------------------------------------------------------------------

describe('BankrollManager — setTotalCapital()', () => {
  it('updates totalCapital and persists', () => {
    writeFileSyncSpy.mockClear();
    const bm = makeBM({ totalCapital: 5_000 });
    bm.setTotalCapital(15_000);
    expect(bm.getConfig().totalCapital).toBe(15_000);
    expect(writeFileSyncSpy).toHaveBeenCalled();
  });

  it('adjusts Kelly cap after capital update', () => {
    const bm = makeBM({ totalCapital: 5_000 });
    bm.setTotalCapital(20_000);
    expect(bm.getKellyCap('X')).toBe(2_000);
  });
});
