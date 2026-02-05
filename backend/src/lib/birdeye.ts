/**
 * Birdeye API Integration
 * Fetches token prices, market data, and historical prices
 *
 * API Docs: https://docs.birdeye.so/
 */

const BIRDEYE_API_URL = process.env.BIRDEYE_API_URL || 'https://api.birdeye.so';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

export interface TokenPrice {
  mint: string;
  symbol?: string;
  name?: string;
  price: number;
  priceUsd: number;
  liquidity?: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
  decimals?: number;
  timestamp: string;
}

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  liquidity?: number;
  marketCap?: number;
}

/**
 * Get current price of a token from Birdeye
 */
export async function getTokenPrice(tokenMint: string): Promise<TokenPrice | null> {
  try {
    if (!BIRDEYE_API_KEY) {
      console.warn('BIRDEYE_API_KEY not set, cannot fetch price');
      return null;
    }

    const url = `${BIRDEYE_API_URL}/defi/token_price?address=${tokenMint}`;

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Birdeye API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as any;

    if (!data.success || !data.data) {
      console.warn(`No price data for token ${tokenMint}`);
      return null;
    }

    const tokenData = data.data;

    return {
      mint: tokenMint,
      symbol: tokenData.symbol || tokenData.name,
      name: tokenData.name,
      price: tokenData.price || 0,
      priceUsd: tokenData.price || 0,
      liquidity: tokenData.liquidity,
      marketCap: tokenData.marketCap,
      volume24h: tokenData.volume24h,
      change24h: tokenData.change24h,
      decimals: tokenData.decimals,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to fetch token price from Birdeye:', error);
    return null;
  }
}

/**
 * Get token information from Birdeye
 */
export async function getTokenInfo(tokenMint: string): Promise<TokenInfo | null> {
  try {
    if (!BIRDEYE_API_KEY) {
      console.warn('BIRDEYE_API_KEY not set, cannot fetch token info');
      return null;
    }

    const url = `${BIRDEYE_API_URL}/defi/token_overview?address=${tokenMint}`;

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Birdeye API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as any;

    if (!data.success || !data.data) {
      console.warn(`No info data for token ${tokenMint}`);
      return null;
    }

    const tokenData = data.data;

    return {
      mint: tokenMint,
      symbol: tokenData.symbol || 'UNKNOWN',
      name: tokenData.name || 'Unknown Token',
      decimals: tokenData.decimals || 9,
      logoURI: tokenData.logoURI,
      liquidity: tokenData.liquidity,
      marketCap: tokenData.marketCap
    };
  } catch (error) {
    console.error('Failed to fetch token info from Birdeye:', error);
    return null;
  }
}

/**
 * Get multiple token prices at once
 */
export async function getTokenPrices(tokenMints: string[]): Promise<TokenPrice[]> {
  const prices: TokenPrice[] = [];

  for (const mint of tokenMints) {
    const price = await getTokenPrice(mint);
    if (price) {
      prices.push(price);
    }
    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return prices;
}

/**
 * Get price at a specific block (historical price)
 * Note: Requires paid Birdeye API plan
 */
export async function getTokenPriceAtBlock(
  tokenMint: string,
  slot: number
): Promise<TokenPrice | null> {
  try {
    if (!BIRDEYE_API_KEY) {
      console.warn('BIRDEYE_API_KEY not set, cannot fetch price');
      return null;
    }

    // Most free API tiers don't support historical prices
    // This is a placeholder for future implementation
    console.warn(`Historical price at slot ${slot} requires paid Birdeye API plan`);

    // For now, fall back to current price
    return await getTokenPrice(tokenMint);
  } catch (error) {
    console.error('Failed to fetch historical token price:', error);
    return null;
  }
}

/**
 * Calculate swap output based on prices
 */
export function calculateSwapOutput(
  inputAmount: number,
  inputPrice: number,
  outputPrice: number,
  decimals?: number
): number {
  if (outputPrice === 0) return 0;

  const inputValue = inputAmount * inputPrice;
  return inputValue / outputPrice;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 0.0001) return `$${price.toExponential(2)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 1000) return `$${price.toFixed(2)}`;
  return `$${(price / 1000).toFixed(2)}K`;
}

/**
 * Validate token mint format
 */
export function isValidTokenMint(mint: string): boolean {
  // Solana mints are base58 encoded 32-byte values
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  if (!mint || mint.length < 32 || mint.length > 44) return false;
  
  const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for (const char of mint) {
    if (!base58Alphabet.includes(char)) return false;
  }
  
  return true;
}
