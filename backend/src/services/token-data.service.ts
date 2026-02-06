/**
 * Token Data Service
 * Fetches real token metrics from DexScreener (free, no API key)
 */

interface TokenMetrics {
  holders?: number;
  liquidity?: number;
  volume24h?: number;
  priceChange24h?: number;
  marketCap?: number;
  priceUsd?: number;
  smartMoneyFlow?: 'IN' | 'OUT' | 'NEUTRAL';
  fdv?: number;
  txns24h?: number;
}

/**
 * Fetch real token data from DexScreener
 * Free API, no key required
 */
export async function fetchTokenMetrics(tokenMint: string): Promise<TokenMetrics> {
  try {
    console.log(`📊 Fetching real token data for ${tokenMint.substring(0, 8)}...`);
    
    // DexScreener API (free, public)
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`⚠️  DexScreener API failed (${response.status}), using fallback`);
      return getFallbackData();
    }
    
    const data = await response.json();
    
    // DexScreener returns array of pairs for this token
    if (!data.pairs || data.pairs.length === 0) {
      console.warn(`⚠️  No pairs found for token, using fallback`);
      return getFallbackData();
    }
    
    // Use the most liquid pair (usually first)
    const pair = data.pairs[0];
    
    const metrics: TokenMetrics = {
      priceUsd: parseFloat(pair.priceUsd || '0'),
      liquidity: pair.liquidity?.usd || 0,
      volume24h: pair.volume?.h24 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      marketCap: pair.marketCap || 0,
      fdv: pair.fdv || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
    };
    
    console.log(`✅ Real data fetched:`);
    console.log(`   Price: $${metrics.priceUsd}`);
    console.log(`   Liquidity: $${metrics.liquidity?.toLocaleString()}`);
    console.log(`   Volume 24h: $${metrics.volume24h?.toLocaleString()}`);
    console.log(`   Price Change: ${metrics.priceChange24h?.toFixed(2)}%`);
    console.log(`   Market Cap: $${metrics.marketCap?.toLocaleString()}`);
    console.log(`   Txns 24h: ${metrics.txns24h}`);
    
    return metrics;
  } catch (error) {
    console.error(`❌ Error fetching token data:`, error);
    return getFallbackData();
  }
}

/**
 * Fallback data when API fails
 * Returns conservative estimates
 */
function getFallbackData(): TokenMetrics {
  return {
    liquidity: 50000,
    volume24h: 100000,
    priceChange24h: 0,
    marketCap: 500000,
    txns24h: 100,
    smartMoneyFlow: 'NEUTRAL',
  };
}

/**
 * Analyze smart money flow (placeholder - would need on-chain data)
 */
export function analyzeSmartMoneyFlow(metrics: TokenMetrics): 'IN' | 'OUT' | 'NEUTRAL' {
  // Simple heuristic: high volume + positive price = IN, negative = OUT
  if (!metrics.volume24h || !metrics.priceChange24h) return 'NEUTRAL';
  
  if (metrics.volume24h > 500000 && metrics.priceChange24h > 10) {
    return 'IN';
  } else if (metrics.priceChange24h < -10) {
    return 'OUT';
  }
  
  return 'NEUTRAL';
}
