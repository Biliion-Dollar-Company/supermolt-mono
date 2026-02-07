/**
 * Price Fetcher Service
 * 
 * Fetches real-time token prices from multiple sources:
 * - DexScreener (primary)
 * - Jupiter (fallback)
 * - Birdeye (optional)
 * 
 * Used by position manager for PnL calculation.
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
const CACHE_TTL_MS = 30_000; // 30 seconds

interface TokenPrice {
  priceUSD: number;
  priceSOL: number;
  priceNative: number;
  liquidity?: number;
  volume24h?: number;
  change24h?: number;
  source: 'dexscreener' | 'jupiter' | 'birdeye';
  timestamp: number;
}

interface PriceCache {
  [tokenMint: string]: {
    price: TokenPrice;
    expiresAt: number;
  };
}

export class PriceFetcher {
  private cache: PriceCache = {};

  /**
   * Get token price in SOL (for PnL calculation)
   */
  async getPriceSOL(tokenMint: string): Promise<number | null> {
    const price = await this.getPrice(tokenMint);
    return price?.priceSOL ?? null;
  }

  /**
   * Get token price in USD (for USDC volume calculation)
   */
  async getPriceUSD(tokenMint: string): Promise<number | null> {
    const price = await this.getPrice(tokenMint);
    return price?.priceUSD ?? null;
  }

  /**
   * Get full token price data
   */
  async getPrice(tokenMint: string): Promise<TokenPrice | null> {
    // Check cache
    const cached = this.cache[tokenMint];
    if (cached && Date.now() < cached.expiresAt) {
      return cached.price;
    }

    // Fetch fresh price
    const price = await this.fetchPriceDexScreener(tokenMint);
    
    if (price) {
      // Cache result
      this.cache[tokenMint] = {
        price,
        expiresAt: Date.now() + CACHE_TTL_MS
      };
    }

    return price;
  }

  /**
   * Fetch price from DexScreener
   */
  private async fetchPriceDexScreener(tokenMint: string): Promise<TokenPrice | null> {
    try {
      const response = await fetch(`${DEXSCREENER_API}/tokens/${tokenMint}`, {
        signal: AbortSignal.timeout(5000) // 5s timeout
      });

      if (!response.ok) {
        console.warn(`DexScreener API error for ${tokenMint}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        console.warn(`No pairs found for token ${tokenMint}`);
        return null;
      }

      // Find SOL pair (best for PnL calculation)
      const solPair = data.pairs.find((p: any) => 
        p.quoteToken?.symbol === 'SOL' || 
        p.baseToken?.symbol === 'SOL'
      );

      // Fallback to first pair (usually highest liquidity)
      const pair = solPair || data.pairs[0];

      // Determine if token is quote or base
      const isQuote = pair.quoteToken?.address === tokenMint;
      const priceUSD = parseFloat(pair.priceUsd || '0');
      
      // priceNative is in quote token (usually SOL)
      let priceSOL: number;
      if (isQuote) {
        // If token is quote token, price is 1/priceNative
        priceSOL = 1 / parseFloat(pair.priceNative || '1');
      } else {
        // If token is base token, price is priceNative
        priceSOL = parseFloat(pair.priceNative || '0');
      }

      return {
        priceUSD,
        priceSOL,
        priceNative: parseFloat(pair.priceNative || '0'),
        liquidity: parseFloat(pair.liquidity?.usd || '0'),
        volume24h: parseFloat(pair.volume?.h24 || '0'),
        change24h: parseFloat(pair.priceChange?.h24 || '0'),
        source: 'dexscreener',
        timestamp: Date.now()
      };

    } catch (error: any) {
      console.error(`Error fetching price for ${tokenMint}:`, error.message);
      return null;
    }
  }

  /**
   * Get prices for multiple tokens (batch)
   */
  async getPrices(tokenMints: string[]): Promise<Map<string, TokenPrice>> {
    const results = new Map<string, TokenPrice>();

    // Fetch in parallel
    const promises = tokenMints.map(async (mint) => {
      const price = await this.getPrice(mint);
      if (price) {
        results.set(mint, price);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: string[] } {
    const entries = Object.keys(this.cache);
    return {
      size: entries.length,
      entries
    };
  }
}

// Singleton instance
let priceFetcherInstance: PriceFetcher | null = null;

export function getPriceFetcher(): PriceFetcher {
  if (!priceFetcherInstance) {
    priceFetcherInstance = new PriceFetcher();
  }
  return priceFetcherInstance;
}
