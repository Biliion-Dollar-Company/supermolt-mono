/**
 * Kalshi Prediction Market Service
 *
 * Wraps the kalshi-typescript SDK for market browsing, syncing,
 * and optional order placement. Works without API keys for
 * public market data; authenticated endpoints are opt-in.
 *
 * IMPORTANT: kalshi-typescript is loaded lazily (dynamic import)
 * so the server starts even if the package has Bun compatibility issues.
 *
 * Pattern: singleton via getKalshiService(), same as fourmeme-api.service.ts
 */

import { db } from '../lib/db';
import type {
  PredictionMarketProvider,
  MarketFilter,
  MarketData,
  OrderbookData,
  OrderParams,
  OrderResult,
  PositionData,
} from './prediction-provider.interface';
import { keyManager } from './key-manager.service';

const MARKET_CACHE_TTL_MS = 30_000; // 30s in-memory cache

// Map Kalshi status to our simplified status
const STATUS_MAP: Record<string, string> = {
  active: 'open',
  initialized: 'open',
  inactive: 'closed',
  closed: 'closed',
  determined: 'settled',
  finalized: 'settled',
  disputed: 'closed',
  amended: 'closed',
};

interface CachedMarkets {
  data: MarketData[];
  fetchedAt: number;
  key: string;
}

// Lazy-loaded SDK references
let KalshiSDK: {
  Configuration: any;
  MarketApi: any;
  OrdersApi: any;
  PortfolioApi: any;
} | null = null;
let sdkLoadAttempted = false;
let sdkLoadError: string | null = null;

async function loadKalshiSDK() {
  if (sdkLoadAttempted) return KalshiSDK;
  sdkLoadAttempted = true;

  try {
    const mod = await import('kalshi-typescript');
    KalshiSDK = {
      Configuration: mod.Configuration,
      MarketApi: mod.MarketApi,
      OrdersApi: mod.OrdersApi,
      PortfolioApi: mod.PortfolioApi,
    };
    console.log('[Kalshi] SDK loaded successfully');
    return KalshiSDK;
  } catch (error: any) {
    sdkLoadError = error.message || 'Unknown import error';
    console.warn(`[Kalshi] SDK failed to load: ${sdkLoadError}`);
    console.warn('[Kalshi] Prediction market features will be degraded (DB-only, no live Kalshi data)');
    return null;
  }
}

export class KalshiService implements PredictionMarketProvider {
  readonly platform = 'KALSHI';
  private marketApi: any = null;
  private ordersApi: any = null;
  private portfolioApi: any = null;
  private authenticated = false;
  private marketCache: CachedMarkets | null = null;
  private initialized = false;

  async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return this.marketApi !== null;

    this.initialized = true;
    const sdk = await loadKalshiSDK();
    if (!sdk) return false;

    const mode = process.env.KALSHI_MODE || 'demo';
    const basePath = mode === 'production'
      ? 'https://trading-api.kalshi.com/trade-api/v2'
      : 'https://demo-api.kalshi.co/trade-api/v2';

    const apiKey = keyManager.getKey('KALSHI_API_KEY', 'kalshi') ?? undefined;
    // getPemKey handles base64-encoded PEM automatically
    const pem = keyManager.getPemKey('KALSHI_PRIVATE_KEY_PEM', 'kalshi') ?? undefined;

    try {
      const config = new sdk.Configuration({
        basePath,
        ...(apiKey && pem ? { apiKey, privateKeyPem: pem } : {}),
      });

      this.marketApi = new sdk.MarketApi(config);

      if (apiKey && pem) {
        this.ordersApi = new sdk.OrdersApi(config);
        this.portfolioApi = new sdk.PortfolioApi(config);
        this.authenticated = true;
        console.log(`[Kalshi] Configured with API key (${mode} mode)`);
      } else {
        console.log('[Kalshi] No API key configured — public endpoints only');
      }
      return true;
    } catch (error: any) {
      console.error('[Kalshi] Failed to initialize:', error.message);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.authenticated;
  }

  async getMarkets(filter?: MarketFilter): Promise<MarketData[]> {
    const ready = await this.ensureInitialized();
    if (!ready) return [];

    const cacheKey = JSON.stringify(filter || {});

    // Return cached if fresh
    if (this.marketCache && this.marketCache.key === cacheKey &&
        Date.now() - this.marketCache.fetchedAt < MARKET_CACHE_TTL_MS) {
      return this.marketCache.data;
    }

    try {
      const limit = filter?.limit || 100;
      const status = filter?.status === 'open' ? 'active' as any : filter?.status as any;

      const response = await this.marketApi.getMarkets(
        limit,
        filter?.cursor,
        undefined, // eventTicker
        filter?.category, // seriesTicker
        undefined, // minCreatedTs
        undefined, // maxCreatedTs
        undefined, // minUpdatedTs
        undefined, // maxCloseTs
        undefined, // minCloseTs
        undefined, // minSettledTs
        undefined, // maxSettledTs
        status,
      );

      const markets = (response.data?.markets || []).map((m: any) => this.mapMarket(m));
      this.marketCache = { data: markets, fetchedAt: Date.now(), key: cacheKey };
      return markets;
    } catch (error) {
      console.error('[Kalshi] getMarkets error:', error);
      if (this.marketCache?.key === cacheKey) return this.marketCache.data;
      return [];
    }
  }

  async getMarket(ticker: string): Promise<MarketData | null> {
    const ready = await this.ensureInitialized();
    if (!ready) return null;

    try {
      const response = await this.marketApi.getMarket(ticker);
      if (!response.data?.market) return null;
      return this.mapMarket(response.data.market);
    } catch (error) {
      console.error(`[Kalshi] getMarket(${ticker}) error:`, error);
      return null;
    }
  }

  async getOrderbook(ticker: string): Promise<OrderbookData | null> {
    const ready = await this.ensureInitialized();
    if (!ready) return null;

    try {
      const response = await this.marketApi.getMarketOrderbook(ticker);
      if (!response.data?.orderbook) return null;

      const ob = response.data.orderbook as any;
      return {
        yes: (ob.yes || []).map((level: any) => ({
          price: (level[0] || level.price || 0) / 100,
          quantity: level[1] || level.quantity || 0,
        })),
        no: (ob.no || []).map((level: any) => ({
          price: (level[0] || level.price || 0) / 100,
          quantity: level[1] || level.quantity || 0,
        })),
      };
    } catch (error) {
      console.error(`[Kalshi] getOrderbook(${ticker}) error:`, error);
      return null;
    }
  }

  async syncMarkets(filter?: MarketFilter): Promise<number> {
    const markets = await this.getMarkets({ ...filter, limit: filter?.limit || 200 });
    if (markets.length === 0) return 0;

    let synced = 0;
    for (const market of markets) {
      try {
        await db.predictionMarket.upsert({
          where: {
            platform_externalId: {
              platform: 'KALSHI',
              externalId: market.externalId,
            },
          },
          update: {
            title: market.title,
            category: market.category,
            subtitle: market.subtitle || null,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            volume: market.volume,
            status: market.status,
            expiresAt: market.expiresAt,
            closesAt: market.closesAt || null,
            metadata: (market.metadata || {}) as any,
          },
          create: {
            platform: 'KALSHI',
            externalId: market.externalId,
            title: market.title,
            category: market.category,
            subtitle: market.subtitle || null,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            volume: market.volume,
            status: market.status,
            expiresAt: market.expiresAt,
            closesAt: market.closesAt || null,
            metadata: (market.metadata || {}) as any,
          },
        });
        synced++;
      } catch (error) {
        console.error(`[Kalshi] Failed to upsert market ${market.externalId}:`, error);
      }
    }

    console.log(`[Kalshi] Synced ${synced}/${markets.length} markets`);
    return synced;
  }

  async checkResolutions(): Promise<number> {
    const pendingMarkets = await db.predictionMarket.findMany({
      where: {
        platform: 'KALSHI',
        outcome: 'PENDING',
        OR: [
          { closesAt: { lte: new Date() } },
          { expiresAt: { lte: new Date() } },
        ],
      },
      take: 50,
    });

    if (pendingMarkets.length === 0) return 0;

    let resolved = 0;
    for (const market of pendingMarkets) {
      try {
        const fresh = await this.getMarket(market.externalId);
        if (!fresh) continue;

        const meta = fresh.metadata as any;
        const result = meta?.result;

        if (result === 'yes' || result === 'no') {
          const outcome = result === 'yes' ? 'YES' : 'NO';
          await db.predictionMarket.update({
            where: { id: market.id },
            data: {
              outcome: outcome as any,
              status: 'settled',
              yesPrice: result === 'yes' ? 1 : 0,
              noPrice: result === 'no' ? 1 : 0,
            },
          });
          resolved++;
        } else if (fresh.status === 'closed' || fresh.status === 'settled') {
          await db.predictionMarket.update({
            where: { id: market.id },
            data: { status: fresh.status },
          });
        }
      } catch (error) {
        console.error(`[Kalshi] Resolution check failed for ${market.externalId}:`, error);
      }
    }

    if (resolved > 0) console.log(`[Kalshi] Resolved ${resolved} markets`);
    return resolved;
  }

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    const ready = await this.ensureInitialized();
    if (!ready || !this.ordersApi) {
      throw new Error('Kalshi API not available — cannot place real orders');
    }

    const response = await this.ordersApi.createOrder({
      ticker: params.ticker,
      action: 'buy' as any,
      side: params.side.toLowerCase() as any,
      count: params.contracts,
      type: (params.price ? 'limit' : 'market') as any,
      ...(params.price ? { yes_price: Math.round(params.price * 100) } : {}),
    } as any);

    const order = (response.data as any)?.order;
    return {
      orderId: order?.order_id || '',
      status: order?.status || 'unknown',
      avgPrice: (order?.avg_price || 0) / 100,
      filledContracts: order?.filled_count || 0,
    };
  }

  async getPositions(): Promise<PositionData[]> {
    return [];
  }

  async getBalance(): Promise<number> {
    const ready = await this.ensureInitialized();
    if (!ready || !this.portfolioApi) return 0;

    try {
      const response = await this.portfolioApi.getBalance();
      return ((response.data as any)?.balance || 0) / 100;
    } catch (error) {
      console.error('[Kalshi] getBalance error:', error);
      return 0;
    }
  }

  private mapMarket(m: any): MarketData {
    const yesPrice = (m.yes_bid ?? m.last_price ?? 50) / 100;
    const noPrice = 1 - yesPrice;

    return {
      externalId: m.ticker,
      title: m.title || m.subtitle || 'Untitled',
      category: 'Other',
      subtitle: m.subtitle || undefined,
      yesPrice,
      noPrice,
      volume: (m.volume || 0) / 100,
      status: STATUS_MAP[m.status] || m.status || 'open',
      expiresAt: m.expiration_time ? new Date(m.expiration_time) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      closesAt: m.close_time ? new Date(m.close_time) : undefined,
      metadata: {
        result: m.result,
        event_ticker: m.event_ticker,
        open_interest: m.open_interest,
        open_time: m.open_time,
        rules_primary: m.rules_primary,
      },
    };
  }
}

// Singleton
let instance: KalshiService | null = null;

export function getKalshiService(): KalshiService {
  if (!instance) {
    instance = new KalshiService();
  }
  return instance;
}
