/**
 * Polymarket CLOB Order Client
 *
 * Places real orders on the Polymarket Central Limit Order Book.
 * Requires POLYMARKET_PRIVATE_KEY (EVM key on Polygon mainnet).
 *
 * Auth flow: EIP-712 L1 signature → API key → signed order
 * Exchange: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E (Polygon)
 */

import axios from 'axios';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

const CLOB_API = 'https://clob.polymarket.com';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const CHAIN_ID = 137; // Polygon mainnet

const AUTH_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: CHAIN_ID,
} as const;

const AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'int256' },
    { name: 'message', type: 'string' },
  ],
} as const;

const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
} as const;

export interface PolyOrderResult {
  orderId: string;
  status: string;
}

export class PolymarketOrderClient {
  private account: PrivateKeyAccount | null = null;
  private apiKey: string | null = null;
  private authCachedAt = 0;
  private readonly AUTH_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours (keys expire at 24h)

  constructor() {
    const pk = process.env.POLYMARKET_PRIVATE_KEY;
    if (!pk) return;

    try {
      const hex = pk.startsWith('0x') ? pk : `0x${pk}`;
      this.account = privateKeyToAccount(hex as `0x${string}`);
      console.log(`[PolymarketOrderClient] Configured for address ${this.account.address}`);
    } catch {
      console.warn('[PolymarketOrderClient] Invalid POLYMARKET_PRIVATE_KEY — real orders disabled');
    }
  }

  isConfigured(): boolean {
    return this.account !== null;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 0n; // int256 → bigint
    const signature = await this.account!.signTypedData({
      domain: AUTH_DOMAIN,
      types: AUTH_TYPES,
      primaryType: 'ClobAuth',
      message: {
        address: this.account!.address,
        timestamp,
        nonce,
        message: 'This message attests that I control the given wallet',
      },
    });

    return {
      'POLY-ADDRESS': this.account!.address,
      'POLY-SIGNATURE': signature,
      'POLY-TIMESTAMP': timestamp,
      'POLY-NONCE': nonce.toString(),
    };
  }

  private async ensureApiKey(): Promise<boolean> {
    const now = Date.now();
    if (this.apiKey && now - this.authCachedAt < this.AUTH_TTL_MS) return true;
    if (!this.account) return false;

    try {
      const headers = await this.getAuthHeaders();
      const resp = await axios.post(`${CLOB_API}/auth/api-key`, {}, { headers });
      this.apiKey = resp.data.apiKey;
      this.authCachedAt = now;
      console.log('[PolymarketOrderClient] API key obtained');
      return true;
    } catch (err: any) {
      console.error('[PolymarketOrderClient] Auth failed:', err.response?.data || err.message);
      return false;
    }
  }

  /**
   * Place a FOK (Fill-or-Kill) market buy order.
   *
   * @param tokenId   CTF token ID for YES or NO outcome
   * @param usdcAmount USDC to spend (e.g. 1.0 = $1.00)
   * @param price     Expected execution price in [0, 1]
   */
  async placeMarketBuy(
    tokenId: string,
    usdcAmount: number,
    price: number,
  ): Promise<PolyOrderResult> {
    const authed = await this.ensureApiKey();
    if (!authed) throw new Error('Polymarket CLOB auth failed');

    const account = this.account!;

    // USDC and CTF tokens both use 6 decimal places
    const makerAmount = BigInt(Math.round(usdcAmount * 1e6));
    const takerAmount = BigInt(Math.round((usdcAmount / Math.max(price, 0.001)) * 1e6));
    const salt = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    const expiration = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

    const orderMessage = {
      salt,
      maker: account.address as `0x${string}`,
      signer: account.address as `0x${string}`,
      taker: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      tokenId: BigInt(tokenId),
      makerAmount,
      takerAmount,
      expiration,
      nonce: BigInt(0),
      feeRateBps: BigInt(0),
      side: 0, // BUY = 0 (uint8 → number in viem)
      signatureType: 0, // EOA (uint8 → number in viem)
    };

    const orderSignature = await account.signTypedData({
      domain: {
        name: 'Polymarket CTF Exchange',
        version: '1',
        chainId: CHAIN_ID,
        verifyingContract: CTF_EXCHANGE as `0x${string}`,
      },
      types: ORDER_TYPES,
      primaryType: 'Order',
      message: orderMessage,
    });

    const authHeaders = await this.getAuthHeaders();
    const resp = await axios.post(
      `${CLOB_API}/order`,
      {
        order: {
          salt: salt.toString(),
          maker: account.address,
          signer: account.address,
          taker: '0x0000000000000000000000000000000000000000',
          tokenId,
          makerAmount: makerAmount.toString(),
          takerAmount: takerAmount.toString(),
          expiration: expiration.toString(),
          nonce: '0',
          feeRateBps: '0',
          side: 'BUY',
          signatureType: 0,
        },
        owner: account.address,
        orderType: 'FOK',
        signature: orderSignature,
      },
      {
        headers: {
          ...authHeaders,
          'POLY-API-KEY': this.apiKey!,
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      orderId: resp.data.orderID || resp.data.id || '',
      status: resp.data.status || 'submitted',
    };
  }
}

export const polymarketOrderClient = new PolymarketOrderClient();
