/**
 * Four.Meme REST API Client
 *
 * Handles the off-chain portion of Four.Meme token creation:
 *   1. Auth: nonce → sign "You are sign in Meme {nonce}" → login → accessToken (5-min cache)
 *   2. Image upload: multipart/form-data → imgUrl
 *   3. Token creation prep: returns createArg + signature for on-chain call
 *
 * Uses BSC_TREASURY_PRIVATE_KEY wallet for signing (same wallet that pays gas).
 *
 * API Base: https://four.meme/meme-api/v1
 * API docs: github.com/slightlyuseless/fourMemeLauncher/docs/API-CreateToken.md
 */

import { privateKeyToAccount } from 'viem/accounts';
import { parseEther } from 'viem';
import { keyManager } from './key-manager.service';

const FOURMEME_API_URL = process.env.FOURMEME_API_URL || 'https://four.meme/meme-api/v1';

// Default placeholder image for tokens without custom art
const DEFAULT_IMAGE_URL = 'https://supermolt.xyz/placeholder-token.png';

// WBNB address on BSC mainnet (used in create payload)
const WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

// Creation fee in BNB (currently 0.01 BNB, hardcoded by Four.Meme)
const CREATE_FEE_BNB = '0.01';

export interface FourMemeCreateParams {
  name: string;
  symbol: string;
  description?: string;
  label?: string;     // Meme|AI|Defi|Games|Infra|De-Sci|Social|Depin|Charity|Others
  imgUrl: string;     // Already uploaded to Four.Meme CDN
  presaleBNB?: string; // BNB amount for initial buy
  twitterUrl?: string;
  telegramUrl?: string;
  webUrl?: string;
  launchDelayMs?: number; // ms from now for launch time (default 60s)
}

export interface FourMemePrepareResult {
  createArg: string;  // hex bytes for contract call
  signature: string;  // hex bytes for contract call
  createFeeWei: bigint; // 0.01 BNB in wei
  presaleWei: bigint;   // optional presale amount in wei
}

export class FourMemeClient {
  private accessToken: string | null = null;
  private tokenExpiry = 0; // timestamp ms
  private account: ReturnType<typeof privateKeyToAccount>;

  constructor(privateKey: `0x${string}`) {
    this.account = privateKeyToAccount(privateKey);
  }

  /**
   * Authenticate with Four.Meme API.
   * Caches accessToken for 5 minutes.
   *
   * Flow:
   *   1. POST /private/user/nonce/generate → nonce string
   *   2. Sign message: "You are sign in Meme {nonce}"
   *   3. POST /private/user/login/dex → accessToken string
   */
  async authenticate(): Promise<string> {
    // Return cached token if still valid (30s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 30_000) {
      return this.accessToken;
    }

    const address = this.account.address.toLowerCase();
    console.log(`[FourMeme] Authenticating ${address}...`);

    // Step 1: Get nonce
    const nonceResp = await fetch(`${FOURMEME_API_URL}/private/user/nonce/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountAddress: address,
        verifyType: 'LOGIN',
        networkCode: 'BSC',
      }),
    });

    if (!nonceResp.ok) {
      throw new Error(`Four.Meme nonce request failed: ${nonceResp.status}`);
    }

    const nonceData = await nonceResp.json() as { code: string; data: string };
    if (nonceData.code !== '0' || !nonceData.data) {
      throw new Error(`Four.Meme nonce error: ${JSON.stringify(nonceData)}`);
    }
    const nonce = nonceData.data;

    // Step 2: Sign message
    const message = `You are sign in Meme ${nonce}`;
    const signature = await this.account.signMessage({ message });

    // Step 3: Login
    const loginResp = await fetch(`${FOURMEME_API_URL}/private/user/login/dex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region: 'WEB',
        langType: 'EN',
        loginIp: '',
        inviteCode: '',
        verifyInfo: {
          address,
          networkCode: 'BSC',
          signature,
          verifyType: 'LOGIN',
        },
        walletName: 'MetaMask',
      }),
    });

    if (!loginResp.ok) {
      throw new Error(`Four.Meme login failed: ${loginResp.status}`);
    }

    const loginData = await loginResp.json() as { code: string; data: string };
    if (loginData.code !== '0' || !loginData.data) {
      throw new Error(`Four.Meme login error: ${JSON.stringify(loginData)}`);
    }

    this.accessToken = loginData.data;
    this.tokenExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    console.log('[FourMeme] Authenticated successfully');

    return this.accessToken;
  }

  /**
   * Upload an image to Four.Meme CDN.
   * Accepts a URL (downloads first) or a raw Buffer.
   * Returns the CDN URL for use in token creation.
   */
  async uploadImage(imageUrlOrBuffer: string | Buffer): Promise<string> {
    const token = await this.authenticate();

    let imageBuffer: Buffer;
    let filename = 'token-image.png';

    if (typeof imageUrlOrBuffer === 'string') {
      console.log(`[FourMeme] Downloading image from ${imageUrlOrBuffer.slice(0, 60)}...`);
      const resp = await fetch(imageUrlOrBuffer);
      if (!resp.ok) {
        throw new Error(`Failed to download image: ${resp.status}`);
      }
      imageBuffer = Buffer.from(await resp.arrayBuffer());
      const urlPath = new URL(imageUrlOrBuffer).pathname;
      filename = urlPath.split('/').pop() || filename;
    } else {
      imageBuffer = imageUrlOrBuffer;
    }

    console.log(`[FourMeme] Uploading image (${imageBuffer.length} bytes)...`);

    // Build multipart/form-data
    const formData = new FormData();
    const arrayBuf = imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: 'image/png' });
    formData.append('file', blob, filename);

    const resp = await fetch(`${FOURMEME_API_URL}/private/token/upload`, {
      method: 'POST',
      headers: {
        'meme-web-access': token,
      },
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Four.Meme image upload failed (${resp.status}): ${text}`);
    }

    const data = await resp.json() as { code: string; data: string };
    if (data.code !== '0' || !data.data) {
      throw new Error(`Four.Meme upload error: ${JSON.stringify(data)}`);
    }

    console.log(`[FourMeme] Image uploaded: ${data.data}`);
    return data.data;
  }

  /**
   * Prepare token creation — calls Four.Meme API to get createArg + signature
   * for the on-chain createToken call.
   *
   * The API response shape: { code: "0", data: { createArg: "0x...", signature: "0x..." } }
   * (key names may vary: createArg/create_arg/arg, signature/sign/signatureHex)
   */
  async prepareCreate(params: FourMemeCreateParams): Promise<FourMemePrepareResult> {
    const token = await this.authenticate();

    console.log(`[FourMeme] Preparing token: ${params.name} (${params.symbol})...`);

    // Build the full payload matching Four.Meme's expected format
    const payload: Record<string, any> = {
      // Customizable params
      name: params.name,
      shortName: params.symbol,
      desc: params.description || '',
      imgUrl: params.imgUrl,
      label: params.label || 'Meme',
      launchTime: Date.now() + (params.launchDelayMs ?? 60_000),
      preSale: params.presaleBNB || '0',
      onlyMPC: false,
      lpTradingFee: 0.0025,
      // Fixed params (required by Four.Meme, cannot change)
      totalSupply: 1_000_000_000,
      raisedAmount: 24,
      saleRate: 0.8,
      reserveRate: 0,
      funGroup: false,
      clickFun: false,
      symbol: 'BNB',
      symbolAddress: WBNB_ADDRESS,
    };

    // Social links (only add if provided)
    if (params.twitterUrl) payload.twitterUrl = params.twitterUrl;
    if (params.telegramUrl) payload.telegramUrl = params.telegramUrl;
    if (params.webUrl) payload.webUrl = params.webUrl;

    const resp = await this._postCreate(token, payload);
    return resp;
  }

  private async _postCreate(token: string, payload: Record<string, any>): Promise<FourMemePrepareResult> {
    const resp = await fetch(`${FOURMEME_API_URL}/private/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'meme-web-access': token,
      },
      body: JSON.stringify(payload),
    });

    if (resp.status === 401) {
      // Token expired, re-auth and retry once
      console.log('[FourMeme] Token expired, re-authenticating...');
      this.accessToken = null;
      this.tokenExpiry = 0;
      const newToken = await this.authenticate();

      const retryResp = await fetch(`${FOURMEME_API_URL}/private/token/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'meme-web-access': newToken,
        },
        body: JSON.stringify(payload),
      });

      if (!retryResp.ok) {
        const text = await retryResp.text();
        throw new Error(`Four.Meme create failed after re-auth (${retryResp.status}): ${text}`);
      }

      return this._extractPrepareResult(await retryResp.json(), payload);
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Four.Meme create prep failed (${resp.status}): ${text}`);
    }

    return this._extractPrepareResult(await resp.json(), payload);
  }

  private _extractPrepareResult(
    raw: any,
    payload: Record<string, any>
  ): FourMemePrepareResult {
    if (raw?.code && raw.code !== '0') {
      throw new Error(`Four.Meme create API error: ${JSON.stringify(raw)}`);
    }

    const d = raw?.data ?? raw;

    // The API may use different key names across versions
    const createArg = d.createArg || d.create_arg || d.arg || d.create_args;
    const signature = d.signature || d.sign || d.signatureHex;

    if (!createArg || !signature) {
      throw new Error(`Four.Meme create response missing createArg/signature. Got keys: ${Object.keys(d)}`);
    }

    const createFeeWei = parseEther(CREATE_FEE_BNB);
    const presaleWei = parseEther(String(payload.preSale || '0'));

    return { createArg, signature, createFeeWei, presaleWei };
  }

  get walletAddress(): string {
    return this.account.address;
  }
}

// ── Singleton ──────────────────────────────────────────────

let fourMemeClient: FourMemeClient | null = null;

export function getFourMemeClient(): FourMemeClient {
  if (!fourMemeClient) {
    const pk = keyManager.requireKey('BSC_TREASURY_PRIVATE_KEY', 'fourmeme-api');
    const hex = pk.startsWith('0x') ? pk : `0x${pk}`;
    fourMemeClient = new FourMemeClient(hex as `0x${string}`);
  }
  return fourMemeClient;
}

export { DEFAULT_IMAGE_URL, CREATE_FEE_BNB };
