/**
 * Trending Token Sync
 *
 * Cron (every 10 minutes):
 *  1. Fetches recently graduated pump.fun tokens from Birdeye
 *  2. Enriches with DexScreener data for tokens without Birdeye key
 *  3. Also pulls tokens SuperRouter has traded recently (72h)
 *  4. Filters by quality thresholds (organic volume, liquidity)
 *  5. Maintains in-memory hot list for the discussion engine
 *
 * Sources (priority order):
 *  A. Birdeye Meme Token List (graduated=true, sorted by graduated_time) — BEST
 *  B. DexScreener trending boosts — FREE fallback
 *  C. SuperRouter recent trades from DB — tokens we already have data on
 */

import { db } from '../lib/db';
import type { TokenContext } from '../lib/conversation-generator';

// ── Quality Thresholds ───────────────────────────────────
// Filters out rugs, dead tokens, and fake volume

const QUALITY = {
  minMarketCap: 20_000,      // $20K — catch earlier stage
  minVolume24h: 10_000,      // $10K — lower bar for fresh tokens
  minLiquidity: 5_000,       // $5K — pump.fun grads start low
  maxAgeHours: 72,           // 3 days
  minUniqueWallets: 5,       // Lower bar
  minHolders: 10,            // Lower bar
};

// ── In-Memory Hot List ───────────────────────────────────

let hotTokens: TokenContext[] = [];
let lastSyncAt: Date | null = null;

export function getHotTokens(): TokenContext[] {
  return hotTokens;
}

export function getLastSyncTime(): Date | null {
  return lastSyncAt;
}

// ── Birdeye Source (Primary) ─────────────────────────────

async function fetchBirdeyeGraduates(): Promise<TokenContext[]> {
  const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
  if (!BIRDEYE_API_KEY) {
    console.log('[TrendingSync] No BIRDEYE_API_KEY, skipping Birdeye source');
    return [];
  }

  try {
    // Import from the scanner's birdeye client (shared rate limiter)
    const { getMemeTokenList } = await import('../scanners/birdeye-client');

    // Fresh graduates sorted by graduation time (newest first)
    const freshGrads = await getMemeTokenList({
      sortBy: 'graduated_time',
      sortType: 'desc',
      graduated: true,
      limit: 30,
      minLiquidity: QUALITY.minLiquidity,
    });
    console.log(`[TrendingSync] Birdeye graduated_time: ${freshGrads.length} raw results`);

    // High volume graduates (most active)
    const highVol = await getMemeTokenList({
      sortBy: 'volume_24h_usd',
      sortType: 'desc',
      graduated: true,
      limit: 20,
      minLiquidity: QUALITY.minLiquidity,
    });
    console.log(`[TrendingSync] Birdeye volume_24h_usd: ${highVol.length} raw results`);

    // Fallback: fresh pump.fun tokens by creation time (may not have graduated_time set yet)
    const freshCreations = await getMemeTokenList({
      sortBy: 'creation_time',
      sortType: 'desc',
      source: 'pump.fun',
      limit: 20,
      minLiquidity: QUALITY.minLiquidity,
    });
    console.log(`[TrendingSync] Birdeye creation_time (pump.fun): ${freshCreations.length} raw results`);

    if (freshGrads.length === 0 && highVol.length === 0 && freshCreations.length === 0) {
      console.warn('[TrendingSync] Birdeye returned 0 results across all 3 queries — API key tier may not support meme token list endpoint');
    }

    // Deduplicate
    const seen = new Set<string>();
    const tokens: TokenContext[] = [];

    for (const list of [freshGrads, highVol, freshCreations]) {
      for (const t of list) {
        if (seen.has(t.address)) continue;
        seen.add(t.address);

        // Quality filters
        if ((t.market_cap || 0) < QUALITY.minMarketCap) continue;
        if ((t.volume_24h_usd || 0) < QUALITY.minVolume24h) continue;
        if ((t.unique_wallet_24h || 0) < QUALITY.minUniqueWallets) continue;
        if ((t.holder || 0) < QUALITY.minHolders) continue;

        tokens.push({
          tokenMint: t.address,
          tokenSymbol: t.symbol,
          tokenName: t.name,
          priceUsd: t.price,
          priceChange24h: t.price_change_24h_percent,
          marketCap: t.market_cap,
          volume24h: t.volume_24h_usd,
          liquidity: t.liquidity,
          fdv: t.fdv,
          chain: 'solana',
          source: 'birdeye_graduated',
          imageUrl: t.logo_uri || undefined,
        });
      }
    }

    console.log(`[TrendingSync] Birdeye: ${tokens.length} graduated tokens passed quality filters`);
    return tokens;
  } catch (err) {
    console.error('[TrendingSync] Birdeye fetch error:', err);
    return [];
  }
}

// ── Batch pair lookup helper ─────────────────────────────
// DexScreener /tokens/v1/{chain}/{addresses} supports comma-separated addresses
// Returns an array of pair objects. We batch up to 30 at a time.

async function batchFetchPairs(chain: string, mints: string[]): Promise<Map<string, any>> {
  const pairsByMint = new Map<string, any>();
  const BATCH_SIZE = 30;

  for (let i = 0; i < mints.length; i += BATCH_SIZE) {
    const batch = mints.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/${chain}/${batch.join(',')}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!res.ok) {
        console.log(`[TrendingSync] DexScreener batch returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      const pairs: any[] = Array.isArray(data) ? data : data.pairs || [];

      for (const pair of pairs) {
        const mint = pair.baseToken?.address;
        if (!mint) continue;
        const existing = pairsByMint.get(mint);
        // Keep pair with highest volume
        if (!existing || (pair.volume?.h24 || 0) > (existing.volume?.h24 || 0)) {
          pairsByMint.set(mint, pair);
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < mints.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      console.error(`[TrendingSync] Batch pair fetch error (batch ${i / BATCH_SIZE + 1}):`, err);
    }
  }

  return pairsByMint;
}

// ── DexScreener Source (Free Fallback) ───────────────────

async function fetchDexScreenerTrending(): Promise<TokenContext[]> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const boosts = Array.isArray(data) ? data : [];

    // Only take Solana tokens
    const solanaBoosts = boosts
      .filter((b: any) => b.chainId === 'solana')
      .slice(0, 30);

    if (solanaBoosts.length === 0) {
      console.log('[TrendingSync] DexScreener boosts: 0 Solana tokens');
      return [];
    }

    // Batch-fetch all pair data in 1-2 calls instead of 30 individual calls
    const mints = solanaBoosts.map((b: any) => b.tokenAddress);
    const boostIconMap = new Map(solanaBoosts.map((b: any) => [b.tokenAddress, b.icon]));
    const pairsByMint = await batchFetchPairs('solana', mints);

    const tokens: TokenContext[] = [];
    for (const mint of mints) {
      const pair = pairsByMint.get(mint);
      if (!pair) continue;

      const mcap = pair.marketCap || pair.fdv || 0;
      const vol = pair.volume?.h24 || 0;
      const liq = pair.liquidity?.usd || 0;

      if (mcap < QUALITY.minMarketCap) continue;
      if (vol < QUALITY.minVolume24h) continue;
      if (liq < QUALITY.minLiquidity) continue;

      tokens.push({
        tokenMint: mint,
        tokenSymbol: pair.baseToken?.symbol || 'UNKNOWN',
        tokenName: pair.baseToken?.name || '',
        priceUsd: parseFloat(pair.priceUsd || '0'),
        priceChange24h: pair.priceChange?.h24 || 0,
        marketCap: mcap,
        volume24h: vol,
        liquidity: liq,
        fdv: pair.fdv || 0,
        chain: 'solana',
        source: 'dexscreener_trending',
        imageUrl: pair.info?.imageUrl || boostIconMap.get(mint) || undefined,
      });
    }

    console.log(`[TrendingSync] DexScreener: ${tokens.length}/${solanaBoosts.length} Solana tokens passed filters`);
    return tokens;
  } catch (err) {
    console.error('[TrendingSync] DexScreener fetch error:', err);
    return [];
  }
}

// ── DexScreener Latest Pairs — Pump.fun Migrations ───────

async function fetchDexScreenerLatestPairs(): Promise<TokenContext[]> {
  try {
    // Fetch latest token profiles
    const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.log(`[TrendingSync] DexScreener token-profiles returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const profiles = Array.isArray(data) ? data : [];

    // Filter for Solana token profiles only
    const solanaProfiles = profiles
      .filter((p: any) => p.chainId === 'solana' && p.tokenAddress)
      .slice(0, 30);

    console.log(`[TrendingSync] DexScreener token-profiles: ${profiles.length} total, ${solanaProfiles.length} Solana`);

    if (solanaProfiles.length === 0) return [];

    // Batch-fetch all pair data
    const mints = [...new Set(solanaProfiles.map((p: any) => p.tokenAddress))];
    const iconMap = new Map(solanaProfiles.map((p: any) => [p.tokenAddress, p.icon]));
    const pairsByMint = await batchFetchPairs('solana', mints);

    const tokens: TokenContext[] = [];
    const maxAge = 72 * 60 * 60 * 1000; // 72h
    const solanaDexes = ['raydium', 'raydium-cp', 'pumpswap', 'meteora', 'orca'];

    for (const mint of mints) {
      const pair = pairsByMint.get(mint);
      if (!pair) continue;

      // Check if it's a recent Solana DEX pair
      if (pair.pairCreatedAt && Date.now() - pair.pairCreatedAt > maxAge) continue;
      if (pair.dexId && !solanaDexes.includes(pair.dexId)) continue;

      const mcap = pair.marketCap || pair.fdv || 0;
      const vol = pair.volume?.h24 || 0;
      const liq = pair.liquidity?.usd || 0;

      if (mcap < QUALITY.minMarketCap) continue;
      if (vol < QUALITY.minVolume24h) continue;
      if (liq < QUALITY.minLiquidity) continue;

      tokens.push({
        tokenMint: mint,
        tokenSymbol: pair.baseToken?.symbol || 'UNKNOWN',
        tokenName: pair.baseToken?.name || '',
        priceUsd: parseFloat(pair.priceUsd || '0'),
        priceChange24h: pair.priceChange?.h24 || 0,
        marketCap: mcap,
        volume24h: vol,
        liquidity: liq,
        chain: 'solana',
        source: 'pumpfun_migration',
        imageUrl: iconMap.get(mint) || pair.info?.imageUrl || undefined,
      });
    }

    console.log(`[TrendingSync] DexScreener latest pairs: ${tokens.length}/${mints.length} recent pump.fun migrations`);
    return tokens;
  } catch (err) {
    console.error('[TrendingSync] DexScreener latest pairs error:', err);
    return [];
  }
}

// ── SuperRouter Recent Trades (DB Source) ────────────────

async function fetchSuperRouterTokens(): Promise<TokenContext[]> {
  try {
    const cutoff = new Date(Date.now() - QUALITY.maxAgeHours * 60 * 60 * 1000);

    // Get unique tokens SuperRouter has traded recently
    const recentTrades = await db.paperTrade.findMany({
      where: {
        chain: 'SOLANA',
        action: 'BUY',
        openedAt: { gte: cutoff },
      },
      select: {
        tokenMint: true,
        tokenSymbol: true,
        tokenName: true,
        marketCap: true,
        liquidity: true,
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });

    // Deduplicate by tokenMint, keep highest marketCap entry
    const tokenMap = new Map<string, typeof recentTrades[0]>();
    for (const t of recentTrades) {
      const existing = tokenMap.get(t.tokenMint);
      if (!existing || (Number(t.marketCap) || 0) > (Number(existing.marketCap) || 0)) {
        tokenMap.set(t.tokenMint, t);
      }
    }

    // Filter out stablecoins and known non-meme tokens
    const EXCLUDED_SYMBOLS = new Set(['USDC', 'USDT', 'SOL', 'WSOL', 'WETH', 'DAI', 'BUSD']);

    const tokens: TokenContext[] = [];
    for (const [mint, t] of tokenMap) {
      if (EXCLUDED_SYMBOLS.has(t.tokenSymbol?.toUpperCase())) continue;
      const mcap = Number(t.marketCap) || 0;
      const liq = Number(t.liquidity) || 0;

      // Light filter — we trust SuperRouter's picks more
      if (mcap < 20_000 && liq < 10_000) continue;

      tokens.push({
        tokenMint: mint,
        tokenSymbol: t.tokenSymbol,
        tokenName: t.tokenName,
        marketCap: mcap || undefined,
        liquidity: liq || undefined,
        chain: 'solana',
        source: 'superrouter_trade',
      });
    }

    console.log(`[TrendingSync] SuperRouter DB: ${tokens.length} recently traded tokens`);

    // Enrich with DexScreener data (batch) so they have volume/price/image
    if (tokens.length > 0) {
      try {
        const enrichMints = tokens.map(t => t.tokenMint);
        const enriched = await batchFetchPairs('solana', enrichMints);
        for (const t of tokens) {
          const pair = enriched.get(t.tokenMint);
          if (!pair) continue;
          t.priceUsd = t.priceUsd || parseFloat(pair.priceUsd || '0');
          t.priceChange24h = t.priceChange24h ?? (pair.priceChange?.h24 || 0);
          t.volume24h = t.volume24h || (pair.volume?.h24 || 0);
          t.liquidity = t.liquidity || (pair.liquidity?.usd || 0);
          t.imageUrl = t.imageUrl || pair.info?.imageUrl || undefined;
          t.tokenName = t.tokenName || pair.baseToken?.name || '';
        }
        console.log(`[TrendingSync] Enriched ${enriched.size}/${tokens.length} SuperRouter tokens via DexScreener`);
      } catch (err) {
        console.error('[TrendingSync] SuperRouter enrichment error:', err);
      }
    }

    return tokens;
  } catch (err) {
    console.error('[TrendingSync] SuperRouter fetch error:', err);
    return [];
  }
}

// ── Agent Discussions (DB Source) ─────────────────────────
// Tokens that agents are actively discussing in conversations.
// This ensures the arena always shows tokens with agent activity,
// even when external API sources (Birdeye, DexScreener) return nothing.

async function fetchDiscussedTokens(alreadySeen: Set<string>): Promise<TokenContext[]> {
  try {
    const cutoff = new Date(Date.now() - QUALITY.maxAgeHours * 60 * 60 * 1000);

    // Get tokens from recent agent conversations
    const recentConvs = await db.agentConversation.findMany({
      where: {
        tokenMint: { not: null },
        createdAt: { gte: cutoff },
      },
      select: { tokenMint: true },
      distinct: ['tokenMint'],
      take: 50,
    });

    // Also get tokens from active positions
    const activePositions = await db.agentPosition.findMany({
      where: { quantity: { gt: 0 } },
      select: { tokenMint: true, tokenSymbol: true },
      distinct: ['tokenMint'],
      take: 30,
    });

    // Get symbol info from trades for these mints
    const allMints = new Set<string>();
    for (const c of recentConvs) if (c.tokenMint && !alreadySeen.has(c.tokenMint)) allMints.add(c.tokenMint);
    for (const p of activePositions) if (p.tokenMint && !alreadySeen.has(p.tokenMint)) allMints.add(p.tokenMint);

    if (allMints.size === 0) return [];

    const mintArray = Array.from(allMints);

    // Get trade data for symbol/name resolution
    const tradeData = await db.paperTrade.findMany({
      where: { tokenMint: { in: mintArray } },
      select: { tokenMint: true, tokenSymbol: true, tokenName: true, marketCap: true, liquidity: true },
      distinct: ['tokenMint'],
      orderBy: { openedAt: 'desc' },
    });

    const tradeMap = new Map<string, typeof tradeData[0]>();
    for (const t of tradeData) tradeMap.set(t.tokenMint, t);

    // Build position symbol map
    const posSymbolMap = new Map<string, string>();
    for (const p of activePositions) posSymbolMap.set(p.tokenMint, p.tokenSymbol);

    // Build token contexts
    const tokens: TokenContext[] = [];
    for (const mint of mintArray) {
      const trade = tradeMap.get(mint);
      const symbol = trade?.tokenSymbol || posSymbolMap.get(mint);
      if (!symbol) continue; // Skip if we can't resolve a symbol

      tokens.push({
        tokenMint: mint,
        tokenSymbol: symbol,
        tokenName: trade?.tokenName || undefined,
        marketCap: Number(trade?.marketCap) || undefined,
        liquidity: Number(trade?.liquidity) || undefined,
        chain: 'solana',
        source: 'agent_discussion',
      });
    }

    // Enrich with DexScreener data so they have price/volume/image
    if (tokens.length > 0) {
      try {
        const enrichMints = tokens.map(t => t.tokenMint);
        const enriched = await batchFetchPairs('solana', enrichMints);
        for (const t of tokens) {
          const pair = enriched.get(t.tokenMint);
          if (!pair) continue;
          t.priceUsd = t.priceUsd || parseFloat(pair.priceUsd || '0');
          t.priceChange24h = t.priceChange24h ?? (pair.priceChange?.h24 || 0);
          t.volume24h = t.volume24h || (pair.volume?.h24 || 0);
          t.liquidity = t.liquidity || (pair.liquidity?.usd || 0);
          t.marketCap = t.marketCap || pair.marketCap || pair.fdv || 0;
          t.imageUrl = t.imageUrl || pair.info?.imageUrl || undefined;
          t.tokenName = t.tokenName || pair.baseToken?.name || '';
        }
        console.log(`[TrendingSync] Enriched ${enriched.size}/${tokens.length} discussed tokens via DexScreener`);
      } catch (err) {
        console.error('[TrendingSync] Discussion token enrichment error:', err);
      }
    }

    console.log(`[TrendingSync] Agent discussions: ${tokens.length} tokens from conversations/positions`);
    return tokens;
  } catch (err) {
    console.error('[TrendingSync] Discussed tokens fetch error:', err);
    return [];
  }
}

// ── Main Sync ────────────────────────────────────────────

async function syncTrendingTokens(): Promise<void> {
  console.log('\n[TrendingSync] Starting sync cycle...');
  const startTime = Date.now();
  const seenMints = new Set<string>();
  const newHotTokens: TokenContext[] = [];

  // 1. Birdeye graduated tokens (best source — real pump.fun grads)
  const birdeyeTokens = await fetchBirdeyeGraduates();
  for (const t of birdeyeTokens) {
    if (!seenMints.has(t.tokenMint)) {
      seenMints.add(t.tokenMint);
      newHotTokens.push(t);
    }
  }

  // 2. DexScreener trending boosts (free, popular tokens)
  const dexTokens = await fetchDexScreenerTrending();
  for (const t of dexTokens) {
    if (!seenMints.has(t.tokenMint)) {
      seenMints.add(t.tokenMint);
      newHotTokens.push(t);
    }
  }

  // 3. DexScreener latest pairs — fresh pump.fun migrations
  const migrationTokens = await fetchDexScreenerLatestPairs();
  for (const t of migrationTokens) {
    if (!seenMints.has(t.tokenMint)) {
      seenMints.add(t.tokenMint);
      newHotTokens.push(t);
    }
  }

  // 4. SuperRouter recent trades (tokens we've actually traded)
  const srTokens = await fetchSuperRouterTokens();
  for (const t of srTokens) {
    if (!seenMints.has(t.tokenMint)) {
      seenMints.add(t.tokenMint);
      newHotTokens.push(t);
    }
  }

  // 5. Tokens from active agent conversations (DB source)
  // Ensures tokens that agents are discussing always appear in the arena
  const discussedTokens = await fetchDiscussedTokens(seenMints);
  for (const t of discussedTokens) {
    if (!seenMints.has(t.tokenMint)) {
      seenMints.add(t.tokenMint);
      newHotTokens.push(t);
    }
  }

  // Sort by volume, then market cap — biggest runners first
  newHotTokens.sort((a, b) => {
    return (b.volume24h || 0) - (a.volume24h || 0)
      || (b.marketCap || 0) - (a.marketCap || 0);
  });

  hotTokens = newHotTokens;
  lastSyncAt = new Date();

  const elapsed = Date.now() - startTime;
  console.log(`[TrendingSync] Sync complete: ${hotTokens.length} hot tokens (${elapsed}ms)`);
  console.log(`  Sources: ${birdeyeTokens.length} birdeye, ${dexTokens.length} dexscreener-boosts, ${migrationTokens.length} pf-migrations, ${srTokens.length} superrouter, ${discussedTokens.length} discussed`);

  for (const t of hotTokens.slice(0, 5)) {
    const mcap = t.marketCap ? `$${(t.marketCap / 1000).toFixed(0)}k` : '?';
    const vol = t.volume24h ? `$${(t.volume24h / 1000).toFixed(0)}k` : '?';
    const change = t.priceChange24h !== undefined ? `${t.priceChange24h >= 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%` : '?';
    console.log(`  📊 $${t.tokenSymbol} — MCap: ${mcap}, Vol: ${vol}, ${change} [${t.source}]`);
  }
}

// ── Cron Manager ─────────────────────────────────────────

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startTrendingTokenSync(): void {
  console.log('[TrendingSync] Starting (every 5 minutes)...');

  // Run immediately
  syncTrendingTokens().catch(err => {
    console.error('[TrendingSync] Initial sync failed:', err);
  });

  syncTimer = setInterval(() => {
    syncTrendingTokens().catch(err => {
      console.error('[TrendingSync] Sync failed:', err);
    });
  }, SYNC_INTERVAL_MS);
}

export function stopTrendingTokenSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  console.log('[TrendingSync] Stopped');
}
