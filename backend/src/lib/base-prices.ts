/**
 * Base Chain Price Fetcher — DexScreener for Base tokens
 *
 * Fetches token prices on Base via DexScreener API.
 * Used by Surge auto-buy executor to enrich trades with ETH-equivalent value.
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
const COINGECKO_ETH_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

// Cache ETH price for 30 seconds
let cachedEthPrice: { price: number; expiry: number } | null = null;

/**
 * Get current ETH price in USD from CoinGecko
 */
export async function getEthPrice(): Promise<number> {
  if (cachedEthPrice && Date.now() < cachedEthPrice.expiry) {
    return cachedEthPrice.price;
  }

  try {
    const resp = await fetch(COINGECKO_ETH_URL, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return cachedEthPrice?.price || 0;
    const data = (await resp.json()) as any;
    const price = data?.ethereum?.usd || 0;

    cachedEthPrice = { price, expiry: Date.now() + 30_000 };
    return price;
  } catch {
    return cachedEthPrice?.price || 0;
  }
}

export interface BaseTokenPrice {
  address: string;
  symbol?: string;
  name?: string;
  priceUsd: number;
  priceEth: number;
  liquidity?: number;
  volume24h?: number;
}

/**
 * Get Base token price from DexScreener
 */
export async function getBaseTokenPrice(contractAddress: string): Promise<BaseTokenPrice | null> {
  try {
    const resp = await fetch(`${DEXSCREENER_API}/${contractAddress}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;

    const data = (await resp.json()) as any;
    const pairs = data?.pairs;
    if (!pairs || pairs.length === 0) return null;

    // Filter for Base pairs only
    const basePairs = pairs.filter((p: any) => p.chainId === 'base');
    const bestPair = basePairs.length > 0
      ? basePairs.reduce((a: any, b: any) => (b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a)
      : pairs.reduce((a: any, b: any) => (b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a);

    const priceUsd = parseFloat(bestPair.priceUsd) || 0;
    const ethPrice = await getEthPrice();
    const priceEth = ethPrice > 0 ? priceUsd / ethPrice : 0;

    return {
      address: contractAddress,
      symbol: bestPair.baseToken?.symbol,
      name: bestPair.baseToken?.name,
      priceUsd,
      priceEth,
      liquidity: bestPair.liquidity?.usd,
      volume24h: bestPair.volume?.h24,
    };
  } catch {
    return null;
  }
}

/**
 * Estimate ETH value of a token transfer
 * Returns the ETH-equivalent value (used for solAmount field in AgentTrade)
 */
export async function estimateEthValue(contractAddress: string, tokenAmount: number): Promise<number> {
  const price = await getBaseTokenPrice(contractAddress);
  if (!price || price.priceEth === 0) return 0;
  return tokenAmount * price.priceEth;
}
