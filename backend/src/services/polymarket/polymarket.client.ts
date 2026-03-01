/**
 * Polymarket Client Service
 * Fetches markets from Polymarket via Cloudflare proxy
 */

import axios from 'axios';
import https from 'https';
import { PolymarketMarket, OrderBookData } from './polymarket.types';

// Create axios instance with custom SSL handling for proxy
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Allow self-signed certs (proxy uses this)
  }),
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  responseType: 'json',
  timeout: 15000, // 15 second timeout
});

export class PolymarketClient {
  private apiUrl: string;
  private clobUrl: string;

  constructor() {
    // Use Cloudflare proxy to bypass ISP blocks
    this.apiUrl = process.env.POLYMARKET_API_URL || 'https://polymarket-proxy.trenchverse.workers.dev';
    this.clobUrl = process.env.POLYMARKET_CLOB_URL || 'https://polymarket-proxy.trenchverse.workers.dev';
  }

  /**
   * Get all active markets from Polymarket
   */
  async getMarkets(limit: number = 500): Promise<PolymarketMarket[]> {
    try {
      const response = await axiosInstance.get(`${this.apiUrl}/markets`, {
        params: {
          limit,
          active: true,
          closed: false,
        },
      });

      // Polymarket API returns array directly
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      // Fallback for wrapped response
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }

      console.error('[PolymarketClient] Unexpected response format:', typeof response.data);
      return [];
    } catch (error: any) {
      console.error('[PolymarketClient] Error fetching markets:', error.message);
      return [];
    }
  }

  /**
   * Get markets related to crypto (comprehensive filter)
   */
  async getCryptoPriceMarkets(): Promise<PolymarketMarket[]> {
    const allMarkets = await this.getMarkets(500);

    if (!Array.isArray(allMarkets)) {
      console.error('[PolymarketClient] allMarkets is not an array:', typeof allMarkets);
      return [];
    }

    // Comprehensive crypto keywords
    const cryptoKeywords = [
      'Bitcoin', 'BTC', 'Ethereum', 'Solana',
      'crypto', 'cryptocurrency', 'blockchain', 'token', 'coin',
      'Coinbase', 'DeFi', 'NFT', 'altcoin', 'Ripple', 'XRP',
      'Cardano', 'ADA', 'Polkadot', 'DOT', 'Dogecoin', 'DOGE',
      'Litecoin', 'LTC', 'Chainlink', 'LINK', 'Uniswap', 'UNI',
      'Filecoin', 'FIL', 'Binance', 'BNB', 'stablecoin', 'USDC'
    ];

    const priceKeywords = ['price', '$', 'worth', 'value', 'hit', 'reach'];

    // Filter based on category OR keywords in question
    const filtered = allMarkets.filter((m) => {
      if (!m || !m.question) return false;

      // Accept if category is Crypto
      if (m.category === 'Crypto') return true;

      // Accept if question contains crypto keywords
      const question = m.question.toLowerCase();
      const hasCrypto = cryptoKeywords.some((keyword) =>
        question.includes(keyword.toLowerCase())
      );
      
      if (!hasCrypto) return false;
      
      // If contains "crypto", accept it
      if (question.includes('crypto')) return true;
      
      // Otherwise, must also contain price-related keywords
      return priceKeywords.some((keyword) =>
        question.includes(keyword.toLowerCase())
      );
    });

    return filtered;
  }

  /**
   * Get markets related to politics (comprehensive filter)
   */
  async getPoliticsMarkets(): Promise<PolymarketMarket[]> {
    const allMarkets = await this.getMarkets(500);

    if (!Array.isArray(allMarkets)) {
      console.error('[PolymarketClient] allMarkets is not an array:', typeof allMarkets);
      return [];
    }

    // Political keywords
    const politicsKeywords = [
      'Trump', 'Biden', 'president', 'presidential', 'election',
      'Democrat', 'Republican', 'congress', 'senate', 'governor',
      'political', 'vote', 'voting', 'ballot', 'campaign',
      'House of Representatives', 'Supreme Court', 'nominee',
      'impeach', 'policy', 'administration', 'cabinet',
      'White House', 'Capitol', 'legislature', 'bill', 'law'
    ];

    // Filter based on category OR keywords
    const filtered = allMarkets.filter((m) => {
      if (!m || !m.question) return false;

      // Accept if category is politics-related
      if (m.category && (
        m.category.toLowerCase().includes('current-affairs') ||
        m.category.toLowerCase().includes('politics') ||
        m.category.toLowerCase().includes('election')
      )) {
        return true;
      }

      // Accept if question contains political keywords
      const question = m.question.toLowerCase();
      return politicsKeywords.some((keyword) =>
        question.includes(keyword.toLowerCase())
      );
    });

    return filtered;
  }

  /**
   * Get all trading markets (crypto + politics)
   */
  async getAllTradingMarkets(): Promise<PolymarketMarket[]> {
    const [cryptoMarkets, politicsMarkets] = await Promise.all([
      this.getCryptoPriceMarkets(),
      this.getPoliticsMarkets()
    ]);

    // Combine and deduplicate by ID
    const combined = [...cryptoMarkets, ...politicsMarkets];
    const uniqueMarkets = Array.from(
      new Map(combined.map(m => [m.id, m])).values()
    );

    console.log(`[PolymarketClient] Total trading markets: ${uniqueMarkets.length} (${cryptoMarkets.length} crypto + ${politicsMarkets.length} politics)`);
    return uniqueMarkets;
  }

  /**
   * Get order book for a token
   */
  async getOrderBook(tokenId: string): Promise<OrderBookData | null> {
    try {
      const response = await axiosInstance.get(`${this.clobUrl}/book`, {
        params: { token_id: tokenId },
      });

      return {
        market: tokenId,
        bids: response.data.bids || [],
        asks: response.data.asks || [],
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error(`[PolymarketClient] Error fetching order book for ${tokenId}:`, error.message);
      return null;
    }
  }

  /**
   * Get midpoint price from order book
   */
  async getMidpoint(tokenId: string): Promise<number | null> {
    const book = await getOrderBook(tokenId);
    if (!book || book.bids.length === 0 || book.asks.length === 0) {
      return null;
    }

    const bestBid = parseFloat(book.bids[0].price);
    const bestAsk = parseFloat(book.asks[0].price);

    return (bestBid + bestAsk) / 2;
  }
}

// Export singleton instance
export const polymarketClient = new PolymarketClient();
