/**
 * God Wallets - High-conviction whale traders
 * 
 * These wallets are tracked by Alpha Scanner for copy-trading signals
 */

export const GOD_WALLETS = [
  // Top Solana meme coin traders (examples - need real research)
  {
    pubkey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    name: 'Ansem',
    conviction: 0.95, // Historical win rate weight
    notes: 'Known for early BONK, WIF calls'
  },
  {
    pubkey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    name: 'Toly (Anatoly)',
    conviction: 0.90,
    notes: 'Solana founder, early on ecosystem tokens'
  },
  {
    pubkey: 'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ',
    name: 'Mert (Helius)',
    conviction: 0.88,
    notes: 'Helius founder, infrastructure plays'
  },
  // Add 21 more high-conviction wallets
  // Sources: Twitter, on-chain analysis, whale watchers
];

/**
 * Analyze wallet transaction to determine conviction
 */
export function analyzeTransaction(tx: any, wallet: typeof GOD_WALLETS[0]): number {
  let score = wallet.conviction; // Base score from wallet reputation
  
  // Adjust based on transaction size
  if (tx.amount > 100_000) score += 0.05; // Large position = higher conviction
  if (tx.amount > 1_000_000) score += 0.10;
  
  // Adjust based on timing
  const isRecent = Date.now() - tx.timestamp < 3600000; // <1 hour
  if (isRecent) score += 0.05; // Fresh signals stronger
  
  // Cap at 1.0
  return Math.min(score, 1.0);
}

/**
 * Check if token is eligible (avoid scams/rugs)
 */
export function isTokenEligible(tokenMint: string, metadata: any): boolean {
  // Basic filters
  if (!metadata.symbol) return false;
  if (!metadata.liquidity || metadata.liquidity < 10000) return false; // Min $10k liquidity
  if (metadata.holders < 100) return false; // Min 100 holders
  
  // TODO: Add more sophisticated filters
  // - Check for freeze authority
  // - Verify mint authority burned
  // - Scan for social media presence
  
  return true;
}
