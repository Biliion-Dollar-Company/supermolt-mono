/**
 * Prediction Market Provider Interface
 *
 * Platform-agnostic interface for prediction market integrations.
 * Kalshi is the first implementation; Drift BET, Polymarket, and
 * Hedgehog can implement the same interface later.
 */

export interface MarketFilter {
  category?: string;
  status?: 'open' | 'closed' | 'settled';
  limit?: number;
  cursor?: string;
}

export interface MarketData {
  externalId: string;
  title: string;
  category: string;
  subtitle?: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  status: string;
  expiresAt: Date;
  closesAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface OrderbookData {
  yes: Array<{ price: number; quantity: number }>;
  no: Array<{ price: number; quantity: number }>;
}

export interface OrderParams {
  ticker: string;
  side: 'YES' | 'NO';
  contracts: number;
  price?: number; // Limit price (omit for market order)
}

export interface OrderResult {
  orderId: string;
  status: string;
  avgPrice: number;
  filledContracts: number;
}

export interface PositionData {
  ticker: string;
  side: 'YES' | 'NO';
  contracts: number;
  avgPrice: number;
  currentValue: number;
}

export interface PredictionMarketProvider {
  readonly platform: string;

  /** Check if the provider has valid API credentials configured */
  isConfigured(): boolean;

  /** Fetch markets with optional filters */
  getMarkets(filter?: MarketFilter): Promise<MarketData[]>;

  /** Fetch a single market by ticker/ID */
  getMarket(ticker: string): Promise<MarketData | null>;

  /** Fetch live orderbook for a market */
  getOrderbook(ticker: string): Promise<OrderbookData | null>;

  /** Sync markets from external API into local PredictionMarket table */
  syncMarkets(filter?: MarketFilter): Promise<number>;

  /** Check and resolve expired PENDING markets */
  checkResolutions(): Promise<number>;

  /** Place a real order (requires API credentials) */
  placeOrder?(params: OrderParams): Promise<OrderResult>;

  /** Get current positions (requires API credentials) */
  getPositions?(): Promise<PositionData[]>;

  /** Get account balance (requires API credentials) */
  getBalance?(): Promise<number>;
}
