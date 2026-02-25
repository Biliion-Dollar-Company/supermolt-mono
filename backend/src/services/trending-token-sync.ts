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
  minMarketCap: 50_000,      // $50K — pump.fun grads start low
  minVolume24h: 30_000,      // $30K — needs some real activity
  minLiquidity: 15_000,      // $15K — Birdeye already filters this
  maxAgeHours: 72,           // 3 days
  minUniqueWallets: 10,      // Filter bot-only tokens
  minHolders: 20,            // Needs some distribution
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

    // High volume graduates (most active)
    const highVol = await getMemeTokenList({
      sortBy: 'volume_24h_usd',
      sortType: 'desc',
      graduated: true,
      limit: 20,
      minLiquidity: QUALITY.minLiquidity,
    });

    // Deduplicate
    const seen = new Set<string>();
    const tokens: TokenContext[] = [];

    for (const list of [freshGrads, highVol]) {
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

// ── DexScreener Source (Free Fallback) ───────────────────

async function fetchDexScreenerTrending(): Promise<TokenContext[]> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const boosts = Array.isArray(data) ? data : [];

    const tokens: TokenContext[] = [];

    // Only take Solana tokens (pump.fun tokens are on Solana)
    const solanaBoosts = boosts
      .filter((b: any) => b.chainId === 'solana')
      .slice(0, 10);

    for (const boost of solanaBoosts) {
      // Fetch full pair data
      try {
        const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${boost.tokenAddress}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!pairRes.ok) continue;
        const pairData = await pairRes.json();
        const pair = pairData.pairs?.[0];
        if (!pair) continue;

        const mcap = pair.marketCap || pair.fdv || 0;
        const vol = pair.volume?.h24 || 0;
        const liq = pair.liquidity?.usd || 0;

        if (mcap < QUALITY.minMarketCap) continue;
        if (vol < QUALITY.minVolume24h) continue;
        if (liq < QUALITY.minLiquidity) continue;

        tokens.push({
          tokenMint: boost.tokenAddress,
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
          imageUrl: pair.info?.imageUrl || undefined,
        });

        // Rate limit DexScreener
        await new Promise(r => setTimeout(r, 400));
      } catch {
        continue;
      }
    }

    console.log(`[TrendingSync] DexScreener: ${tokens.length} Solana tokens passed filters`);
    return tokens;
  } catch (err) {
    console.error('[TrendingSync] DexScreener fetch error:', err);
    return [];
  }
}

// ── DexScreener Latest Pairs — Pump.fun Migrations ───────

async function fetchDexScreenerLatestPairs(): Promise<TokenContext[]> {
  try {
    // Search for recent Raydium pairs (where pump.fun tokens migrate to)
    const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=pump', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pairs = data.pairs || [];

    const tokens: TokenContext[] = [];
    const seen = new Set<string>();

    // Filter for Solana Raydium pairs with pump-style addresses
    const solanaPairs = pairs
      .filter((p: any) =>
        p.chainId === 'solana' &&
        (p.dexId === 'raydium' || p.dexId === 'raydium-cp') &&
        p.pairCreatedAt &&
        Date.now() - p.pairCreatedAt < 72 * 60 * 60 * 1000 // < 72h old
      )
      .slice(0, 20);

    for (const pair of solanaPairs) {
      const mint = pair.baseToken?.address;
      if (!mint || seen.has(mint)) continue;
      seen.add(mint);

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
        imageUrl: pair.info?.imageUrl || undefined,
      });
    }

    console.log(`[TrendingSync] DexScreener latest pairs: ${tokens.length} recent pump.fun migrations`);
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
    return tokens;
  } catch (err) {
    console.error('[TrendingSync] SuperRouter fetch error:', err);
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

  // Sort: birdeye_graduated first, then by volume
  newHotTokens.sort((a, b) => {
    // Prioritize graduated tokens
    if (a.source === 'birdeye_graduated' && b.source !== 'birdeye_graduated') return -1;
    if (b.source === 'birdeye_graduated' && a.source !== 'birdeye_graduated') return 1;
    // Then by volume
    return (b.volume24h || 0) - (a.volume24h || 0);
  });

  hotTokens = newHotTokens;
  lastSyncAt = new Date();

  const elapsed = Date.now() - startTime;
  console.log(`[TrendingSync] Sync complete: ${hotTokens.length} hot tokens (${elapsed}ms)`);
  console.log(`  Sources: ${birdeyeTokens.length} birdeye, ${dexTokens.length} dexscreener-boosts, ${migrationTokens.length} pf-migrations, ${srTokens.length} superrouter`);

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
