/**
 * Kraken Trading Service
 *
 * Wraps the official Kraken CLI binary (kraken-cli) for order execution, balance checks,
 * and live market data. Falls back to Kraken REST API v2 if the binary is missing or
 * fails.
 *
 * Requirements:
 * - kraken-cli binary installed in PATH
 * - KRAKEN_API_KEY and KRAKEN_API_SECRET set in environment
 *
 * Used by:
 * - agent-trading-loop.ts  — market signals + order placement
 * - kraken.routes.ts       — REST API exposed to the frontend/leaderboard
 */

import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { keyManager } from './key-manager.service';

const execAsync = promisify(exec);

const KRAKEN_API_URL = 'https://api.kraken.com';
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

// ── Credentials ──────────────────────────────────────────

function getCredentials() {
  const key = keyManager.getKey('KRAKEN_API_KEY', 'kraken-cli');
  const secret = keyManager.getKey('KRAKEN_API_SECRET', 'kraken-cli');
  return { key, secret };
}

// ── CLI Wrapper ──────────────────────────────────────────

/**
 * Execute a command via the kraken-cli binary.
 */
async function executeCLI(command: string): Promise<string | null> {
  const { key, secret } = getCredentials();
  if (!key || !secret) return null;

  try {
    // Set credentials in environment for the CLI process
    const env = {
      ...process.env,
      KRAKEN_API_KEY: key,
      KRAKEN_API_SECRET: secret,
    };

    const { stdout } = await execAsync(`kraken-cli ${command}`, { env, timeout: 5000 });
    return stdout.trim();
  } catch (err: any) {
    console.warn(`[Kraken CLI] Command failed: ${command} — ${err.message}`);
    return null;
  }
}

// ── Signature generation (for REST fallback) ─────────────

/**
 * Generates the HMAC-SHA512 signature required by Kraken's private API.
 */
function generateSignature(urlPath: string, nonce: string, postData: string, secret: string): string {
  const hash = crypto.createHash('sha256').update(nonce + postData).digest();
  const hmac = crypto.createHmac('sha512', Buffer.from(secret, 'base64'));
  hmac.update(urlPath);
  hmac.update(hash);
  return hmac.digest('base64');
}

// ── HTTP helpers (for REST fallback) ─────────────────────

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
  const { key, secret } = getCredentials();
  if (!key || !secret) {
    throw new Error('[Kraken] Credentials not set in keyManager');
  }
  const nonce = (Date.now() * 1000).toString();
  const postData = new URLSearchParams({ nonce, ...params }).toString();
  const signature = generateSignature(path, nonce, postData, secret);

  const res = await fetch(`${KRAKEN_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'API-Key': key,
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

  // 1. Try CLI first
  const cliData = await executeCLI(`ticker --pair ${pairParam} --format json`);
  if (cliData) {
    try {
      const parsed = JSON.parse(cliData);
      return Object.entries(parsed).map(([key, t]: [string, any]) => ({
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
    } catch (e) {
      console.warn('[Kraken CLI] Failed to parse ticker JSON, falling back to REST');
    }
  }

  // 2. Fallback to REST
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

  // 1. Try CLI first
  const cliResult = await executeCLI(`order add --pair ${normalized} --type ${side} --ordertype market --volume ${volume.toFixed(8)} --format json`);
  if (cliResult) {
    try {
      const parsed = JSON.parse(cliResult);
      const txid = parsed.txid?.[0] || 'unknown';
      return {
        orderId: txid,
        pair,
        side,
        price: currentPrice,
        volume,
        fee: volumeUsd * 0.0026,
        timestamp: new Date(),
        sandboxMode: false,
      };
    } catch (e) {
      console.warn('[Kraken CLI] Failed to parse order JSON, falling back to REST');
    }
  }

  // 2. Fallback to REST
  const result = await privateRequest('/0/private/AddOrder', {
    pair: normalized,
    type: side,
    ordertype: 'market',
    volume: volume.toFixed(8),
  });

  const txids: string[] = result.txid ?? [];
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
 * Close a position by placing an offsetting market order.
 */
export async function closePosition(
  pair: string,
  side: 'buy' | 'sell', // original entry side
  volume: number,
  currentPrice: number,
): Promise<KrakenOrderResult> {
  const exitSide = side === 'buy' ? 'sell' : 'buy';
  const volumeUsd = volume * currentPrice;
  return placeOrder(pair, exitSide, volumeUsd, currentPrice);
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

  // 1. Try CLI first
  const cliData = await executeCLI('balance --format json');
  if (cliData) {
    try {
      const parsed = JSON.parse(cliData);
      return Object.entries(parsed).map(([currency, balance]) => ({
        currency,
        balance: parseFloat(balance as string),
      }));
    } catch (e) {
      console.warn('[Kraken CLI] Failed to parse balance JSON, falling back to REST');
    }
  }

  // 2. Fallback to REST
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

  // Try CLI
  const cliData = await executeCLI('orders open --format json');
  if (cliData) {
    try {
      const parsed = JSON.parse(cliData);
      const open = parsed?.open ?? {};
      return Object.entries(open).map(([txid, order]: [string, any]) => ({ txid, ...order }));
    } catch (e) {}
  }

  const result = await privateRequest('/0/private/OpenOrders', {});
  const open = result?.open ?? {};
  return Object.entries(open).map(([txid, order]: [string, any]) => ({ txid, ...order }));
}

/**
 * Get recent trade history.
 */
export async function getOrderHistory(limit = 50): Promise<any[]> {
  if (SANDBOX_MODE) return [];

  // Try CLI
  const cliData = await executeCLI(`trades history --count ${limit} --format json`);
  if (cliData) {
    try {
      const parsed = JSON.parse(cliData);
      const trades = parsed?.trades ?? {};
      return Object.entries(trades).map(([txid, trade]: [string, any]) => ({ txid, ...trade }));
    } catch (e) {}
  }

  const result = await privateRequest('/0/private/TradesHistory', {
    trades: 'true',
    count: limit.toString(),
  });
  const trades = result?.trades ?? {};
  return Object.entries(trades).map(([txid, trade]: [string, any]) => ({ txid, ...trade }));
}

/**
 * Compute realized PnL from closed trade history.
 * challenge 1 key requirement.
 */
export async function getPnL(): Promise<{ totalPnlUsd: number; trades: KrakenPnLEntry[] }> {
  if (SANDBOX_MODE) {
    // In sandbox, we query the DB for CLOSED paper trades to simulate a real PnL report
    try {
      const { db } = await import('../lib/db');
      const closedTrades = await db.paperTrade.findMany({
        where: { status: 'CLOSED', signalSource: 'kraken_trading_loop' },
        orderBy: { closedAt: 'desc' },
        take: 100,
      });

      const trades = closedTrades.map(t => ({
        pair: t.tokenMint,
        side: 'buy→sell',
        entryPrice: Number(t.entryPrice),
        exitPrice: Number(t.exitPrice || 0),
        volume: Number(t.tokenAmount || 0),
        pnlUsd: Number(t.pnl || 0),
        timestamp: t.closedAt?.toISOString() || t.openedAt.toISOString(),
      }));

      const totalPnlUsd = trades.reduce((sum, t) => sum + t.pnlUsd, 0);
      return { totalPnlUsd, trades };
    } catch (e) {
      console.warn('[Kraken] Failed to fetch sandbox PnL from DB:', e);
      return { totalPnlUsd: 0, trades: [] };
    }
  }

  const history = await getOrderHistory(200);
  let totalPnlUsd = 0;
  const entries: KrakenPnLEntry[] = [];

  const buys: Record<string, { price: number; volume: number; time: string }[]> = {};
  const sells: Record<string, { price: number; volume: number; time: string }[]> = {};

  for (const t of history) {
    const bucket = t.type === 'buy' ? buys : sells;
    const pair = t.pair;
    if (!bucket[pair]) bucket[pair] = [];
    bucket[pair].push({
      price: parseFloat(t.price),
      volume: parseFloat(t.vol),
      time: new Date(t.time * 1000).toISOString(),
    });
  }

  for (const [pair, buyList] of Object.entries(buys)) {
    const sellList = sells[pair] ?? [];
    for (const buy of buyList) {
      // Find matching sell by volume proximity (simple matching for hackathon)
      const sellIdx = sellList.findIndex((s) => Math.abs(s.volume - buy.volume) < buy.volume * 0.1);
      if (sellIdx !== -1) {
        const sell = sellList.splice(sellIdx, 1)[0];
        const pnl = (sell.price - buy.price) * buy.volume;
        totalPnlUsd += pnl;
        entries.push({
          pair,
          side: 'buy→sell',
          entryPrice: buy.price,
          exitPrice: sell.price,
          volume: buy.volume,
          pnlUsd: pnl,
          timestamp: sell.time,
        });
      }
    }
  }

  return { totalPnlUsd, trades: entries };
}
