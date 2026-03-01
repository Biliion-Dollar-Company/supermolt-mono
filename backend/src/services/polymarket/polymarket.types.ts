/**
 * Polymarket Types
 * Shared type definitions for Polymarket integration
 */

export interface PolymarketMarket {
  id: string;
  question: string;
  description?: string;
  endDate?: string;
  end_date?: string;
  conditionId?: string;
  token_id?: string;
  clobTokenIds?: string;
  probability?: number; // 0-1 (e.g., 0.65 = 65%)
  outcomePrices?: string; // JSON string like "[\"0.65\", \"0.35\"]"
  volume?: number; // Total volume
  volume24hr?: number; // 24-hour volume
  volume_24h?: number; // Alternative field name
  volumeNum?: number; // Numeric volume
  liquidity?: number;
  liquidityNum?: number;
  active: boolean;
  closed?: boolean;
  category?: string; // Category from Polymarket (e.g., "Crypto", "US-current-affairs")
}

export interface OrderBookData {
  market: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  timestamp: number;
}
