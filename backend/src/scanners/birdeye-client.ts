/**
 * Shared Birdeye API client for all scanners.
 *
 * Centralises rate-limiting, auth, and caching so every scanner goes through
 * one place.  Birdeye rate limit is **per account** (not per endpoint), so we
 * need a single queue.
 *
 * Plan tier reference (what we care about):
 *   Premium  → 50 rps / 1 000 rpm
 *   Business → 100 rps / 1 500 rpm
 *
 * We budget conservatively: max 20 rps for scanners, leaving headroom for
 * the rest of the app (price lookups, PnL cache, WebSocket, etc.).
 */

const BIRDEYE_API_URL = process.env.BIRDEYE_API_URL || 'https://public-api.birdeye.so';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

// ── Rate limiter ──────────────────────────────────────────────────────────

const SCANNER_MAX_RPS = 15; // Conservative — leaves room for other services
const MIN_INTERVAL_MS = Math.ceil(1000 / SCANNER_MAX_RPS); // ~67 ms between calls

let lastCallTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastCallTime = Date.now();
}

// ── Core fetch helper ────────────────────────────────────────────────────

async function birdeyeFetch<T>(
  path: string,
  options?: { method?: string; body?: string; timeoutMs?: number }
): Promise<T | null> {
  if (!BIRDEYE_API_KEY) {
    console.warn('[Birdeye Scanner] BIRDEYE_API_KEY not set');
    return null;
  }

  await throttle();

  try {
    const response = await fetch(`${BIRDEYE_API_URL}${path}`, {
      method: options?.method || 'GET',
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY,
        'Accept': 'application/json',
        'x-chain': 'solana',
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options?.body,
      signal: AbortSignal.timeout(options?.timeoutMs || 10000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[Birdeye Scanner] Rate limited — backing off 2 s');
        await new Promise((r) => setTimeout(r, 2000));
      }
      return null;
    }

    const json = (await response.json()) as { success: boolean; data: T };
    if (!json.success) return null;
    return json.data;
  } catch (error) {
    console.error(`[Birdeye Scanner] ${path} failed:`, error);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Meme Token List — THE key endpoint.
 * 100 CU per call but returns up to 100 tokens with full data.
 *
 * sort_by: volume_1h_usd | volume_24h_usd | market_cap | liquidity |
 *          price_change_1h_percent | price_change_24h_percent | holder |
 *          creation_time | graduated_time
 */
export interface MemeToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_uri?: string;
  market_cap: number;
  fdv: number;
  liquidity: number;
  price: number;
  holder: number;
  volume_1h_usd: number;
  volume_24h_usd: number;
  volume_1h_change_percent: number;
  volume_24h_change_percent: number;
  price_change_1h_percent: number;
  price_change_24h_percent: number;
  trade_1h_count: number;
  trade_24h_count: number;
  buy_24h: number;
  sell_24h: number;
  unique_wallet_24h: number;
  last_trade_unix_time: number;
  recent_listing_time: number;
  extensions?: {
    twitter?: string;
    website?: string;
    telegram?: string;
  };
  meme_info?: {
    source?: string;
    graduated?: boolean;
    progress_percent?: number;
  };
}

export async function getMemeTokenList(options: {
  sortBy: string;
  sortType?: 'asc' | 'desc';
  source?: string;
  graduated?: boolean | 'all';
  limit?: number;
  minVolume1h?: number;
  minLiquidity?: number;
  minHolder?: number;
}): Promise<MemeToken[]> {
  const params = new URLSearchParams();
  params.set('sort_by', options.sortBy);
  params.set('sort_type', options.sortType || 'desc');
  params.set('limit', String(options.limit || 50));

  if (options.source) params.set('source', options.source);
  if (options.graduated !== undefined) {
    params.set('graduated', options.graduated === 'all' ? 'all' : String(options.graduated));
  }
  if (options.minVolume1h) params.set('min_volume_1h_usd', String(options.minVolume1h));
  if (options.minLiquidity) params.set('min_liquidity', String(options.minLiquidity));
  if (options.minHolder) params.set('min_holder', String(options.minHolder));

  const data = await birdeyeFetch<{ items: MemeToken[] }>(
    `/defi/v3/token/meme/list?${params.toString()}`
  );

  return data?.items || [];
}

/**
 * OHLCV candles — for Delta scanner technical analysis.
 * 40 CU per call.
 */
export interface OHLCVCandle {
  unixTime: number;
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // token volume
  vUsd: number; // USD volume
}

export async function getOHLCV(
  tokenMint: string,
  interval: '1m' | '5m' | '15m' | '1H' | '4H' | '1D',
  timeFrom: number,
  timeTo: number
): Promise<OHLCVCandle[]> {
  const params = new URLSearchParams({
    address: tokenMint,
    type: interval,
    time_from: String(timeFrom),
    time_to: String(timeTo),
  });

  const data = await birdeyeFetch<{ items: OHLCVCandle[] }>(
    `/defi/v3/ohlcv?${params.toString()}`
  );

  return data?.items || [];
}

/**
 * Token overview — rich metadata for a single token.
 * 30 CU per call.
 */
export interface TokenOverview {
  price: number;
  mc: number; // market cap
  realMc: number;
  liquidity: number;
  v24hUSD: number;
  priceChange24hPercent: number;
  holder: number;
  supply: number;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  extensions?: {
    twitter?: string;
    website?: string;
    telegram?: string;
  };
}

export async function getTokenOverview(tokenMint: string): Promise<TokenOverview | null> {
  return birdeyeFetch<TokenOverview>(`/defi/token_overview?address=${tokenMint}`);
}

/**
 * Token security — scam/rug detection.
 * 50 CU per call.
 */
export interface TokenSecurity {
  isHoneypot: boolean;
  freezeAuthority: string | null;
  mintAuthority: string | null;
  top10HolderPercent: number;
  creatorBalancePercent: number;
}

export async function getTokenSecurity(tokenMint: string): Promise<TokenSecurity | null> {
  return birdeyeFetch<TokenSecurity>(`/defi/token_security?address=${tokenMint}`);
}

/**
 * Recent trades for a token — whale activity detection.
 * 10 CU per call.
 */
export interface TokenTrade {
  txHash: string;
  blockUnixTime: number;
  owner: string;
  volumeUSD: number;
  from: { address: string; symbol: string; uiAmount: number };
  to: { address: string; symbol: string; uiAmount: number };
  source: string;
}

export async function getTokenTrades(
  tokenMint: string,
  limit = 20
): Promise<TokenTrade[]> {
  const data = await birdeyeFetch<{ items: TokenTrade[] }>(
    `/defi/txs/token?address=${tokenMint}&limit=${limit}&sort_type=desc&tx_type=swap`
  );

  return data?.items || [];
}

/**
 * New token listings — freshly launched tokens.
 * 80 CU per call.
 */
export interface NewListing {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  liquidity: number;
  market_cap: number;
  listing_time: number;
}

export async function getNewListings(limit = 50): Promise<NewListing[]> {
  const data = await birdeyeFetch<{ items: NewListing[] }>(
    `/defi/token_new_listing?limit=${limit}&sort_by=listing_time&sort_type=desc&min_liquidity=10000`
  );

  return data?.items || [];
}
