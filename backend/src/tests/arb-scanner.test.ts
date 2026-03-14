/**
 * Integration tests: Polymarket Structural Arbitrage Scanner
 *
 * Tests arb detection logic, spread calculation, and DB interaction.
 * DB + HTTP calls are mocked to avoid needing a real Postgres or network.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ── Mock dependencies BEFORE importing the module under test ─────────────────

const mockUpsert = mock(async () => ({ id: 'mkt-1' }));
const mockPredictionCreate = mock(async () => ({ id: 'pred-1' }));

mock.module('../lib/db', () => ({
  db: {
    predictionMarket: { upsert: mockUpsert },
    agentPrediction: { create: mockPredictionCreate },
  },
}));

const mockGetMarkets = mock(async (): Promise<any[]> => []);
mock.module('../services/polymarket/polymarket.client', () => ({
  polymarketClient: { getMarkets: mockGetMarkets },
}));

mock.module('../services/polymarket/polymarket.order-client', () => ({
  polymarketOrderClient: {
    isConfigured: () => false,
    placeMarketBuy: mock(async () => ({ orderId: '', status: 'submitted' })),
  },
}));

const { PolymarketArbScanner } = await import('../services/polymarket/polymarket.arb-scanner');

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMarket(yesPrice: number, noPrice: number, id = 'mkt-test'): any {
  return {
    id,
    question: `Will BTC hit $100k? [${id}]`,
    category: 'Crypto',
    active: true,
    outcomePrices: JSON.stringify([String(yesPrice), String(noPrice)]),
    volume: 50000,
    endDate: new Date(Date.now() + 86400000).toISOString(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PolymarketArbScanner', () => {
  let scanner: InstanceType<typeof PolymarketArbScanner>;

  beforeEach(() => {
    scanner = new PolymarketArbScanner();
    mockGetMarkets.mockClear();
    mockUpsert.mockClear();
    mockPredictionCreate.mockClear();
  });

  it('detects arb when combined price < 0.985', async () => {
    mockGetMarkets.mockResolvedValueOnce([makeMarket(0.48, 0.49)]);

    await scanner.scan();

    const stats = scanner.getStats();
    expect(stats.scansRun).toBe(1);
    expect(stats.opportunitiesFound).toBe(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockPredictionCreate).toHaveBeenCalledTimes(2); // YES + NO
  });

  it('does not trigger arb when combined price >= 0.985', async () => {
    mockGetMarkets.mockResolvedValueOnce([makeMarket(0.50, 0.50)]);

    await scanner.scan();

    expect(scanner.getStats().opportunitiesFound).toBe(0);
    expect(mockPredictionCreate).not.toHaveBeenCalled();
  });

  it('detects borderline arb at just-under threshold', async () => {
    // 0.49 + 0.494 = 0.984 < 0.985 → arb
    mockGetMarkets.mockResolvedValueOnce([makeMarket(0.49, 0.494)]);

    await scanner.scan();

    expect(scanner.getStats().opportunitiesFound).toBe(1);
  });

  it('skips non-crypto markets', async () => {
    const nonCrypto: any = {
      ...makeMarket(0.48, 0.49),
      question: 'Will it rain tomorrow?',
      category: 'Weather',
    };
    mockGetMarkets.mockResolvedValueOnce([nonCrypto]);

    await scanner.scan();

    expect(scanner.getStats().opportunitiesFound).toBe(0);
  });

  it('accumulates scan count across multiple scans', async () => {
    mockGetMarkets.mockResolvedValue([]);

    await scanner.scan();
    await scanner.scan();
    await scanner.scan();

    expect(scanner.getStats().scansRun).toBe(3);
  });

  it('records YES and NO predictions as paper when real orders disabled', async () => {
    mockGetMarkets.mockResolvedValueOnce([makeMarket(0.48, 0.49)]);

    await scanner.scan();

    const calls = mockPredictionCreate.mock.calls as any[][];
    expect(calls).toHaveLength(2);

    for (const call of calls) {
      expect(call[0].data.realOrder).toBe(false);
      expect(call[0].data.orderId).toBeNull();
    }
  });

  it('records correct agentId and confidence', async () => {
    mockGetMarkets.mockResolvedValueOnce([makeMarket(0.48, 0.49)]);

    await scanner.scan();

    const calls = mockPredictionCreate.mock.calls as any[][];
    for (const call of calls) {
      expect(call[0].data.agentId).toBe('arb-scanner');
      expect(call[0].data.confidence).toBe(99);
    }
  });

  it('returns correct stats shape', () => {
    const stats = scanner.getStats();
    expect(stats).toHaveProperty('scansRun');
    expect(stats).toHaveProperty('opportunitiesFound');
    expect(stats).toHaveProperty('lastScanAt');
    expect(stats.scansRun).toBe(0);
    expect(stats.opportunitiesFound).toBe(0);
    expect(stats.lastScanAt).toBeNull();
  });
});
