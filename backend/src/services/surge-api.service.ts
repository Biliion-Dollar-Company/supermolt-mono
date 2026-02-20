/**
 * Surge OpenClaw API Client — Base chain trading via managed wallets
 *
 * Wraps the Surge API (https://back.surge.xyz/openclaw/) for:
 * - Server-managed wallet creation (no private keys)
 * - Token buy/sell (auto-routes bonding curve vs Aerodrome DEX)
 * - Trade history + token status + tx status
 *
 * All requests use X-API-Key auth. Amounts are human-readable strings.
 *
 * Chain IDs (Surge DB IDs, NOT network IDs):
 *   "1" = Base (8453)
 *   "4" = BNB (56)
 *   "2" = Solana
 */

const SURGE_BASE_URL = 'https://back.surge.xyz';
const REQUEST_TIMEOUT_MS = 30_000;

/** Surge DB chain ID for Base mainnet */
export const SURGE_CHAIN_ID_BASE = '1';
/** Surge DB chain ID for BNB */
export const SURGE_CHAIN_ID_BNB = '4';
/** Surge DB chain ID for Solana */
export const SURGE_CHAIN_ID_SOLANA = '2';

// ── Rate Limiter ──────────────────────────────────────────

interface RateBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per minute
  lastRefill: number;
}

const rateBuckets: Record<string, RateBucket> = {
  trade: { tokens: 10, maxTokens: 10, refillRate: 10, lastRefill: Date.now() },
  balance: { tokens: 20, maxTokens: 20, refillRate: 20, lastRefill: Date.now() },
  transfer: { tokens: 10, maxTokens: 10, refillRate: 10, lastRefill: Date.now() },
  general: { tokens: 30, maxTokens: 30, refillRate: 30, lastRefill: Date.now() },
};

function consumeToken(bucketName: string): boolean {
  const bucket = rateBuckets[bucketName] || rateBuckets.general;
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 60_000;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

// ── Error Class ──────────────────────────────────────────

export class SurgeApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
  ) {
    super(message);
    this.name = 'SurgeApiError';
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429;
  }
}

// ── Types ────────────────────────────────────────────────

export interface SurgeWallet {
  walletId: string;
  address: string;
  chainType: string;
  needsFunding: boolean;
  isNew?: boolean;
}

export interface SurgeWalletBalance {
  walletId: string;
  address: string;
  chainType: string;
  balances: Array<{
    chain: string;
    chainId: string;
    balance: string;
    balanceRaw: string;
    sufficient: boolean;
    minRequired: string;
  }>;
}

export interface SurgeTokenBalance {
  walletId: string;
  address: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  balance: string;
  balanceRaw: string;
  decimals: number;
}

export interface SurgeTradeResult {
  txHash: string;
  [key: string]: any;
}

export interface SurgeQuote {
  amountOut: string;
  [key: string]: any;
}

export interface SurgeTokenStatus {
  tokenAddress: string;
  tokenName: string;
  tokenTicker: string;
  trading: boolean;
  tradingOnUniswap: boolean;
  phase: string; // 'not_launched' | 'bonding_curve' | 'graduated'
  price: string;
  marketCap: string;
  liquidity: string;
}

export interface SurgeTradeHistory {
  trades: any[];
  total: number;
}

export interface SurgeTxStatus {
  [key: string]: any;
}

export interface SurgeLaunchInfo {
  chains: Array<{
    chainId: string;
    chainName: string;
    networkId: string;
    chainType: string;
    fee: string;
    feeSymbol: string;
    minBalance: string;
  }>;
  categories: string[];
}

// ── API Client ──────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.SURGE_API_KEY;
  if (!key) throw new SurgeApiError('SURGE_API_KEY not configured', 500);
  return key;
}

async function surgeRequest<T>(
  method: string,
  path: string,
  body?: Record<string, any>,
  rateBucket = 'general',
): Promise<T> {
  if (!consumeToken(rateBucket)) {
    throw new SurgeApiError('Surge rate limit exceeded (client-side)', 429, 'RATE_LIMITED');
  }

  const url = `${SURGE_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(url, options);

  if (!resp.ok) {
    let errorBody: any = {};
    try {
      errorBody = await resp.json();
    } catch {
      // ignore parse failures
    }
    const msg = Array.isArray(errorBody.message)
      ? errorBody.message.join('; ')
      : errorBody.message || errorBody.error || `Surge API error: ${resp.status}`;
    throw new SurgeApiError(msg, resp.status, errorBody.code);
  }

  return resp.json() as Promise<T>;
}

// ── Launch Info ──────────────────────────────────────────

export async function getLaunchInfo(): Promise<SurgeLaunchInfo> {
  return surgeRequest<SurgeLaunchInfo>('GET', '/openclaw/launch-info', undefined, 'general');
}

// ── Wallet Operations ───────────────────────────────────

export async function createWallet(): Promise<SurgeWallet> {
  return surgeRequest<SurgeWallet>('POST', '/openclaw/wallet/create', {}, 'general');
}

export async function listWallets(): Promise<SurgeWallet[]> {
  return surgeRequest<SurgeWallet[]>('GET', '/openclaw/wallets', undefined, 'general');
}

export async function getWallet(walletId: string): Promise<SurgeWallet> {
  return surgeRequest<SurgeWallet>('GET', `/openclaw/wallet/${walletId}`, undefined, 'balance');
}

export async function getWalletBalance(walletId: string): Promise<SurgeWalletBalance> {
  return surgeRequest<SurgeWalletBalance>('GET', `/openclaw/wallet/${walletId}/balance`, undefined, 'balance');
}

export async function getTokenBalance(
  walletId: string,
  chainId: string,
  tokenAddress: string,
): Promise<SurgeTokenBalance> {
  return surgeRequest<SurgeTokenBalance>(
    'POST',
    `/openclaw/wallet/${walletId}/token-balance`,
    { chainId, tokenAddress },
    'balance',
  );
}

export async function fundWallet(walletId: string): Promise<any> {
  return surgeRequest<any>('POST', `/openclaw/wallet/${walletId}/fund`, {}, 'general');
}

export async function getTradeHistory(walletId: string): Promise<SurgeTradeHistory> {
  return surgeRequest<SurgeTradeHistory>(
    'GET',
    `/openclaw/wallet/${walletId}/history`,
    undefined,
    'balance',
  );
}

// ── Trading Operations (EVM) ────────────────────────────

export async function buyToken(
  chainId: string,
  walletId: string,
  tokenAddress: string,
  ethAmount: string,
): Promise<SurgeTradeResult> {
  return surgeRequest<SurgeTradeResult>(
    'POST',
    '/openclaw/buy',
    { chainId, walletId, tokenAddress, ethAmount },
    'trade',
  );
}

export async function sellToken(
  chainId: string,
  walletId: string,
  tokenAddress: string,
  tokenAmount: string,
): Promise<SurgeTradeResult> {
  return surgeRequest<SurgeTradeResult>(
    'POST',
    '/openclaw/sell',
    { chainId, walletId, tokenAddress, tokenAmount },
    'trade',
  );
}

export async function getQuote(
  chainId: string,
  tokenAddress: string,
  amount: string,
  side: 'buy' | 'sell',
): Promise<SurgeQuote> {
  return surgeRequest<SurgeQuote>(
    'POST',
    '/openclaw/quote',
    { chainId, tokenAddress, amount, side },
    'general',
  );
}

// ── Token Status & TX Status ────────────────────────────

export async function getTokenStatus(
  chainId: string,
  tokenAddress: string,
): Promise<SurgeTokenStatus> {
  return surgeRequest<SurgeTokenStatus>(
    'POST',
    '/openclaw/token-status',
    { chainId, tokenAddress },
    'general',
  );
}

export async function getTxStatus(
  chainId: string,
  txHash: string,
): Promise<SurgeTxStatus> {
  return surgeRequest<SurgeTxStatus>(
    'POST',
    '/openclaw/tx-status',
    { chainId, txHash },
    'general',
  );
}
