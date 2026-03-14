/**
 * Integration tests: Kalshi Service — market mapping, caching, order placement
 *
 * All external SDK and DB calls are mocked.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetMarketsApi = mock(async () => ({ data: { markets: [] } }));
const mockGetMarketApi = mock(async () => ({ data: { market: null } }));
const mockGetOrderbookApi = mock(async () => ({ data: { orderbook: null } }));
const mockCreateOrderApi = mock(async () => ({
  data: {
    order: { order_id: 'ord-123', status: 'resting', avg_price: 55, filled_count: 1 },
  },
}));
const mockGetBalanceApi = mock(async () => ({ data: { balance: 10000 } }));

const fakeMarketApi = {
  getMarkets: mockGetMarketsApi,
  getMarket: mockGetMarketApi,
  getMarketOrderbook: mockGetOrderbookApi,
};
const fakeOrdersApi = { createOrder: mockCreateOrderApi };
const fakePortfolioApi = { getBalance: mockGetBalanceApi };

mock.module('kalshi-typescript', () => ({
  Configuration: mock((opts: any) => opts),
  MarketApi: mock(() => fakeMarketApi),
  OrdersApi: mock(() => fakeOrdersApi),
  PortfolioApi: mock(() => fakePortfolioApi),
}));

mock.module('../lib/db', () => ({
  db: {
    predictionMarket: {
      upsert: mock(async () => ({ id: 'mkt-1' })),
      findMany: mock(async () => []),
      update: mock(async () => ({})),
    },
  },
}));

mock.module('../services/key-manager.service', () => ({
  keyManager: {
    getKey: mock((key: string) => (key === 'KALSHI_API_KEY' ? 'test-api-key' : null)),
    getPemKey: mock((key: string) =>
      key === 'KALSHI_PRIVATE_KEY_PEM'
        ? '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----'
        : null,
    ),
  },
}));

const { KalshiService } = await import('../services/kalshi.service');

// ── Helpers ──────────────────────────────────────────────────────────────────

function rawKalshiMarket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ticker: 'BTCUSD-60000',
    title: 'BTC above $60k?',
    subtitle: 'Crypto price market',
    status: 'active',
    yes_bid: 55,
    volume: 100000,
    expiration_time: new Date(Date.now() + 86400000).toISOString(),
    close_time: new Date(Date.now() + 43200000).toISOString(),
    result: null,
    event_ticker: 'BTCUSD',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('KalshiService', () => {
  let service: InstanceType<typeof KalshiService>;

  beforeEach(() => {
    service = new KalshiService();
    mockGetMarketsApi.mockClear();
    mockCreateOrderApi.mockClear();
  });

  it('initializes successfully with API key + PEM', async () => {
    const ready = await service.ensureInitialized();
    expect(ready).toBe(true);
  });

  it('reports configured when credentials are present', async () => {
    await service.ensureInitialized();
    expect(service.isConfigured()).toBe(true);
  });

  it('returns empty array when API returns no markets', async () => {
    mockGetMarketsApi.mockResolvedValueOnce({ data: { markets: [] } } as any);
    const markets = await service.getMarkets();
    expect(markets).toEqual([]);
  });

  it('maps Kalshi market fields to internal format', async () => {
    mockGetMarketsApi.mockResolvedValueOnce({
      data: { markets: [rawKalshiMarket()] },
    } as any);

    const markets = await service.getMarkets();

    expect(markets).toHaveLength(1);
    const m = markets[0];
    expect(m.externalId).toBe('BTCUSD-60000');
    expect(m.title).toBe('BTC above $60k?');
    expect(m.yesPrice).toBeCloseTo(0.55, 2);
    expect(m.noPrice).toBeCloseTo(0.45, 2);
    expect(m.status).toBe('open'); // 'active' maps to 'open'
    expect(m.volume).toBe(1000); // 100000 cents / 100
  });

  it('maps finalized status to settled', async () => {
    mockGetMarketsApi.mockResolvedValueOnce({
      data: { markets: [rawKalshiMarket({ status: 'finalized' })] },
    } as any);

    const markets = await service.getMarkets();
    expect(markets[0].status).toBe('settled');
  });

  it('caches markets and avoids redundant API calls', async () => {
    mockGetMarketsApi.mockResolvedValue({ data: { markets: [] } } as any);

    await service.getMarkets();
    await service.getMarkets();

    expect(mockGetMarketsApi).toHaveBeenCalledTimes(1);
  });

  it('places order with correct parameters', async () => {
    await service.ensureInitialized();

    const result = await service.placeOrder({
      ticker: 'BTCUSD-60000',
      side: 'YES',
      contracts: 2,
      price: 0.55,
    });

    expect(result.orderId).toBe('ord-123');
    expect(result.status).toBe('resting');
    expect(result.avgPrice).toBeCloseTo(0.55, 2); // 55 cents / 100

    const call = (mockCreateOrderApi.mock.calls as any[][])[0][0];
    expect(call.ticker).toBe('BTCUSD-60000');
    expect(call.side).toBe('yes');
    expect(call.count).toBe(2);
    expect(call.yes_price).toBe(55); // Math.round(0.55 * 100)
  });

  it('returns account balance divided by 100', async () => {
    await service.ensureInitialized();
    const balance = await service.getBalance();
    expect(balance).toBe(100); // 10000 cents / 100
  });
});
