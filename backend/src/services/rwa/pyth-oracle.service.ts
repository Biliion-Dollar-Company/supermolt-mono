/**
 * Pyth Oracle Service — fetches real-time price feeds from Pyth Network's Hermes API.
 * Mock mode returns realistic static prices for offline/CI use.
 * Real mode calls https://hermes.pyth.network/v2/
 */

import { RWA_TOKENS } from './rwa-tokens.registry';

export interface PythPrice {
  feedId: string;
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

const HERMES_BASE = 'https://hermes.pyth.network/v2';

const MOCK_PRICES: Record<string, { price: number; confidence: number }> = {
  '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2': { price: 2340.50, confidence: 1.20 },
  '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5': { price: 528.30, confidence: 0.15 },
  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d': { price: 187.45, confidence: 0.42 },
};

export class PythOracleService {
  private mockMode: boolean;

  constructor(mockMode?: boolean) {
    this.mockMode = mockMode ?? (process.env.PYTH_MOCK !== 'false');
  }

  async getPrice(feedId: string): Promise<PythPrice> {
    if (this.mockMode) return this.mockPrice(feedId);

    const res = await fetch(`${HERMES_BASE}/updates/price/latest?ids[]=${feedId}`);
    if (!res.ok) throw new Error(`Pyth API error: ${res.status}`);
    const data = await res.json();
    const parsed = data.parsed?.[0];
    if (!parsed) throw new Error(`No price data for feed ${feedId}`);
    const expo = parsed.price.expo;
    return {
      feedId,
      price: Number(parsed.price.price) * Math.pow(10, expo),
      confidence: Number(parsed.price.conf) * Math.pow(10, expo),
      expo,
      publishTime: parsed.price.publish_time,
    };
  }

  async getPrices(feedIds: string[]): Promise<PythPrice[]> {
    if (this.mockMode) return feedIds.map(id => this.mockPrice(id));

    const params = feedIds.map(id => `ids[]=${id}`).join('&');
    const res = await fetch(`${HERMES_BASE}/updates/price/latest?${params}`);
    if (!res.ok) throw new Error(`Pyth API error: ${res.status}`);
    const data = await res.json();
    return (data.parsed || []).map((p: any) => {
      const expo = p.price.expo;
      return {
        feedId: `0x${p.id}`,
        price: Number(p.price.price) * Math.pow(10, expo),
        confidence: Number(p.price.conf) * Math.pow(10, expo),
        expo,
        publishTime: p.price.publish_time,
      };
    });
  }

  async getAllRwaPrices(): Promise<Record<string, PythPrice>> {
    const feedIds = RWA_TOKENS.filter(t => t.pythFeedId).map(t => t.pythFeedId!);
    if (feedIds.length === 0) return {};
    const prices = await this.getPrices(feedIds);
    const result: Record<string, PythPrice> = {};
    for (const p of prices) {
      const token = RWA_TOKENS.find(t => t.pythFeedId === p.feedId);
      if (token) result[token.symbol] = p;
    }
    return result;
  }

  private mockPrice(feedId: string): PythPrice {
    const mock = MOCK_PRICES[feedId] || { price: 100 + Math.random() * 50, confidence: 0.5 };
    return { feedId, price: mock.price, confidence: mock.confidence, expo: -8, publishTime: Math.floor(Date.now() / 1000) };
  }
}
