/**
 * Kraken Trading Service
 *
 * Wraps Kraken REST API v2 for order execution, balance checks, and live market data.
 * When KRAKEN_SANDBOX_MODE=true (default), simulates orders without hitting the API.
 *
 * Used by:
 * - agent-trading-loop.ts  — market signals + order placement
 * - kraken.routes.ts       — REST API exposed to the frontend/leaderboard
 */

import crypto from 'node:crypto';

const KRAKEN_API_URL = 'https://api.kraken.com';
const KRAKEN_API_KEY = process.env.KRAKEN_API_KEY || '';
const KRAKEN_API_SECRET = process.env.KRAKEN_API_SECRET || '';
export const SANDBOX_MODE = process.env.KRAKEN_SANDBOX_MODE !== 'false'; // default: sandbox

export const KRAKEN_DEFAULT_PAIRS: string[] = (
  process.env.KRAKEN_DEFAULT_PAIRS || 'XBT/USD,ETH/USD,SOL/USD'
).split(',');

// Minimum Kraken order volumes per pair (Kraken enforces these)
const MIN_VOLUMES: Record<string, number> = {
  XBTUSD: 0.0001,
  ETHUSD: 0.002,
  SOLUSD: 0.5,
};

// ── Types ────────────────────────────────────────────────

export interface KrakenOrderResult {
  orderId: string;
  pair: string;
  side: 'buy' | 'sell';
  price: number;
  volume: number;
  fee: number;
  timestamp: Date;
  sandboxMode: boolean;
}

export interface KrakenTickerData {
  pair: string;         // API key e.g. "XBTUSD"
  displayPair: string;  // Human-readable e.g. "XBT/USD"
  price: number;
  bid: number;
  ask: number;
  volume24h: number;    // Base-currency volume
  vwap24h: number;
  trades24h: number;
  low24h: number;
  high24h: number;
  openPrice24h: number;
}

export interface KrakenBalance {
  currency: string;
  balance: number;
}

export interface KrakenPnLEntry {
  pair: string;
  side: string;
  entryPrice: number;
  exitPrice?: number;
  volume: number;
  pnlUsd: number;
  timestamp: string;
}

// ── Signature generation ─────────────────────────────────

/**
 * Generates the HMAC-SHA512 signature required by Kraken's private API.
 * Algorithm: HMAC-SHA512(base64_decode(apiSecret), path + SHA256(nonce + postdata))
 */
function generateSignature(urlPath: string, nonce: string, postData: string): string {
  const hash = crypto.createHash('sha256').update(nonce + postData).digest();
  const hmac = crypto.createHmac('sha512', Buffer.from(KRAKEN_API_SECRET, 'base64'));
  hmac.update(urlPath);
  hmac.update(hash);
  return hmac.digest('base64');
}

// ── HTTP helpers ─────────────────────────────────────────

async function publicRequest(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${KRAKEN_API_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Kraken public API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { error: string[]; result: any };
  if (json.error?.length) throw new Error(`Kraken error: ${json.error.join(', ')}`);
  return json.result;
}

async function privateRequest(path: string, params: Record<string, string>): Promise<any> {
  if (!KRAKEN_API_KEY || !KRAKEN_API_SECRET) {
    throw new Error('[Kraken] KRAKEN_API_KEY / KRAKEN_API_SECRET not set');
  }
  const nonce = (Date.now() * 1000).toString();
  const postData = new URLSearchParams({ nonce, ...params }).toString();
  const signature = generateSignature(path, nonce, postData);

  const res = await fetch(`${KRAKEN_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'API-Key': KRAKEN_API_KEY,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postData,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Kraken private API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { error: string[]; result: any };
  if (json.error?.length) throw new Error(`Kraken error: ${json.error.join(', ')}`);
  return json.result;
}

// ── Pair normalization ───────────────────────────────────

/** "XBT/USD" → "XBTUSD" */
function normalizePair(pair: string): string {
  return pair.replace('/', '');
}

// ── Public API ───────────────────────────────────────────

/**
 * Fetch live ticker data for one or more Kraken pairs.
 */
export async function getTickerData(pairs: string[] = KRAKEN_DEFAULT_PAIRS): Promise<KrakenTickerData[]> {
  const pairParam = pairs.map(normalizePair).join(',');
  const result = await publicRequest('/0/public/Ticker', { pair: pairParam });

  return Object.entries(result).map(([key, t]: [string, any]) => ({
    pair: key,
    displayPair: key.replace('XBT', 'BTC').replace('USD', '/USD').replace('//', '/'),
    price: parseFloat(t.c[0]),
    bid: parseFloat(t.b[0]),
    ask: parseFloat(t.a[0]),
    volume24h: parseFloat(t.v[1]),
    vwap24h: parseFloat(t.p[1]),
    trades24h: Number(t.t[1]),
    low24h: parseFloat(t.l[1]),
    high24h: parseFloat(t.h[1]),
    openPrice24h: parseFloat(t.o),
  }));
}

// ── Private API ───────────────────────────────────────────

/**
 * Place a market order on Kraken.
 * In SANDBOX_MODE (default) returns a simulated order with no network call.
 */
export async function placeOrder(
  pair: string,
  side: 'buy' | 'sell',
  volumeUsd: number,
  currentPrice: number,
): Promise<KrakenOrderResult> {
  const normalized = normalizePair(pair);
  const rawVolume = volumeUsd / (currentPrice || 1);
  const minVol = MIN_VOLUMES[normalized] ?? 0.001;
  const volume = Math.max(rawVolume, minVol);

  if (SANDBOX_MODE) {
    const orderId = `SANDBOX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    console.log(`[Kraken Sandbox] ${side.toUpperCase()} ${volume.toFixed(6)} ${pair} @ ~$${currentPrice}`);
    return {
      orderId,
      pair,
      side,
      price: currentPrice,
      volume,
      fee: volumeUsd * 0.0026,
      timestamp: new Date(),
      sandboxMode: true,
    };
  }

  const result = await privateRequest('/0/private/AddOrder', {
    pair: normalized,
    type: side,
    ordertype: 'market',
    volume: volume.toFixed(8),
  });

  const txids: string[] = result.txid ?? [];
  console.log(`[Kraken] Order placed: ${txids[0]} — ${side} ${volume} ${pair}`);

  return {
    orderId: txids[0] ?? 'unknown',
    pair,
    side,
    price: currentPrice,
    volume,
    fee: volumeUsd * 0.0026,
    timestamp: new Date(),
    sandboxMode: false,
  };
}

/**
 * Get account balances.
 */
export async function getBalance(): Promise<KrakenBalance[]> {
  if (SANDBOX_MODE) {
    return [
      { currency: 'ZUSD', balance: 10_000 },
      { currency: 'USD', balance: 10_000 },
    ];
  }
  const result = await privateRequest('/0/private/Balance', {});
  return Object.entries(result).map(([currency, balance]) => ({
    currency,
    balance: parseFloat(balance as string),
  }));
}

/**
 * Get open orders.
 */
export async function getOpenOrders(): Promise<any[]> {
  if (SANDBOX_MODE) return [];
  const result = await privateRequest('/0/private/OpenOrders', {});
  const open = result?.open ?? {};
  return Object.entries(open).map(([txid, order]: [string, any]) => ({ txid, ...order }));
}

/**
 * Get recent trade history.
 */
export async function getOrderHistory(limit = 50): Promise<any[]> {
  if (SANDBOX_MODE) return [];
  const result = await privateRequest('/0/private/TradesHistory', {
    trades: 'true',
    count: limit.toString(),
  });
  const trades = result?.trades ?? {};
  return Object.entries(trades).map(([txid, trade]: [string, any]) => ({ txid, ...trade }));
}

/**
 * Compute realized PnL from closed trade history using simple FIFO matching.
 * Returns total PnL in USD and a per-trade breakdown for the leaderboard.
 */
export async function getPnL(): Promise<{ totalPnlUsd: number; trades: KrakenPnLEntry[] }> {
  if (SANDBOX_MODE) return { totalPnlUsd: 0, trades: [] };

  const history = await getOrderHistory(200);
  let totalPnlUsd = 0;
  const entries: KrakenPnLEntry[] = [];

  const buys: Record<string, { price: number; volume: number; time: string }[]> = {};
  const sells: Record<string, { price: number; volume: number; time: string }[]> = {};

  for (const t of history) {
    const bucket = t.type === 'buy' ? buys : sells;
    if (!bucket[t.pair]) bucket[t.pair] = [];
    bucket[t.pair].push({
      price: parseFloat(t.price),
      volume: parseFloat(t.vol),
      time: new Date(t.time * 1000).toISOString(),
    });
  }

  for (const [pair, buyList] of Object.entries(buys)) {
    const sellList = sells[pair] ?? [];
    for (const buy of buyList) {
      // Nearest-volume sell match
      const sell = sellList.find((s) => Math.abs(s.volume - buy.volume) < buy.volume * 0.1);
      const pnl = sell ? (sell.price - buy.price) * buy.volume : 0;
      totalPnlUsd += pnl;
      entries.push({
        pair,
        side: 'buy→sell',
        entryPrice: buy.price,
        exitPrice: sell?.price,
        volume: buy.volume,
        pnlUsd: pnl,
        timestamp: buy.time,
      });
    }
  }

  return { totalPnlUsd, trades: entries };
}
