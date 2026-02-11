/**
 * BSC Price Fetcher — DexScreener for BNB Chain tokens
 *
 * Fetches token prices on BSC via DexScreener API.
 * Used by BSC monitor to enrich trades with BNB-equivalent value.
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
const COINGECKO_BNB_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';

// Cache BNB price for 30 seconds
let cachedBnbPrice: { price: number; expiry: number } | null = null;

/**
 * Get current BNB price in USD from CoinGecko
 */
export async function getBnbPrice(): Promise<number> {
  if (cachedBnbPrice && Date.now() < cachedBnbPrice.expiry) {
    return cachedBnbPrice.price;
  }

  try {
    const resp = await fetch(COINGECKO_BNB_URL, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return cachedBnbPrice?.price || 0;
    const data = (await resp.json()) as any;
    const price = data?.binancecoin?.usd || 0;

    cachedBnbPrice = { price, expiry: Date.now() + 30_000 };
    return price;
  } catch {
    return cachedBnbPrice?.price || 0;
  }
}

export interface BSCTokenPrice {
  address: string;
  symbol?: string;
  name?: string;
  priceUsd: number;
  priceBnb: number;
  liquidity?: number;
  volume24h?: number;
}

/**
 * Get BSC token price from DexScreener
 * DexScreener uses the same API regardless of chain — it auto-detects from the pair data.
 */
export async function getBscTokenPrice(contractAddress: string): Promise<BSCTokenPrice | null> {
  try {
    const resp = await fetch(`${DEXSCREENER_API}/${contractAddress}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;

    const data = (await resp.json()) as any;
    const pairs = data?.pairs;
    if (!pairs || pairs.length === 0) return null;

    // Filter for BSC pairs only
    const bscPairs = pairs.filter((p: any) => p.chainId === 'bsc');
    const bestPair = bscPairs.length > 0
      ? bscPairs.reduce((a: any, b: any) => (b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a)
      : pairs.reduce((a: any, b: any) => (b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a);

    const priceUsd = parseFloat(bestPair.priceUsd) || 0;
    const bnbPrice = await getBnbPrice();
    const priceBnb = bnbPrice > 0 ? priceUsd / bnbPrice : 0;

    return {
      address: contractAddress,
      symbol: bestPair.baseToken?.symbol,
      name: bestPair.baseToken?.name,
      priceUsd,
      priceBnb,
      liquidity: bestPair.liquidity?.usd,
      volume24h: bestPair.volume?.h24,
    };
  } catch {
    return null;
  }
}

/**
 * Estimate BNB value of a token transfer
 * Returns the BNB-equivalent value (used for solAmount field in AgentTrade)
 */
export async function estimateBnbValue(contractAddress: string, tokenAmount: number): Promise<number> {
  const price = await getBscTokenPrice(contractAddress);
  if (!price || price.priceBnb === 0) return 0;
  return tokenAmount * price.priceBnb;
}
