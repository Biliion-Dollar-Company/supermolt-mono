/**
 * Pump.fun API Client — Solana Token Launcher
 *
 * Handles token creation on pump.fun via two APIs:
 *   1. pump.fun IPFS API: Upload metadata (name, symbol, desc, image)
 *   2. PumpPortal local transaction API: Build unsigned create tx
 *
 * The PumpPortal local transaction API is free (no API key).
 * We sign the transaction locally with our wallet + mint keypair.
 *
 * Flow:
 *   1. Generate random mint keypair
 *   2. Upload metadata to pump.fun IPFS → metadataUri
 *   3. POST to PumpPortal /api/trade-local → unsigned tx bytes
 *   4. Sign tx with wallet + mint keypair
 *   5. Send to Solana RPC
 *
 * Sources:
 *   - pumpportal.fun/creation
 *   - pumpportal.fun/trading-api
 *   - pump.fun/api/ipfs
 */

import {
  Connection,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
  sendAndConfirmRawTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import {
  PUMP_IPFS_URL,
  PUMPPORTAL_LOCAL_TX_URL,
  PUMP_TOTAL_SUPPLY,
  PUMP_TOKEN_DECIMALS,
} from '../lib/pumpfun-constants';

// ── Types ────────────────────────────────────────────────

export interface PumpFunCreateParams {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;       // URL to download, or use placeholder
  twitter?: string;
  telegram?: string;
  website?: string;
  initialBuySol?: number;  // Optional initial buy in SOL (default: 0)
  slippage?: number;       // Slippage % (default: 10)
  priorityFee?: number;    // Priority fee in SOL (default: 0.0005)
}

export interface PumpFunMetadataResult {
  metadataUri: string;
  metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    showName: boolean;
    createdOn: string;
  };
}

export interface PumpFunCreateResult {
  mintAddress: string;
  txSignature: string;
  name: string;
  symbol: string;
  metadataUri: string;
  pumpFunUrl: string;
  explorerUrl: string;
}

// ── Client ───────────────────────────────────────────────

export class PumpFunClient {
  private connection: Connection;
  private wallet: Keypair;

  constructor(walletKeypair: Keypair, rpcUrl?: string) {
    this.wallet = walletKeypair;
    this.connection = new Connection(
      rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
  }

  /**
   * Upload token metadata to pump.fun IPFS.
   *
   * POST https://pump.fun/api/ipfs
   * Content-Type: multipart/form-data
   *
   * Fields: file (image), name, symbol, description, twitter, telegram, website, showName
   * Response: { metadataUri: "https://cf-ipfs.com/ipfs/Qm..." }
   */
  async uploadMetadata(params: PumpFunCreateParams): Promise<PumpFunMetadataResult> {
    console.log(`[PumpFun] Uploading metadata for ${params.name} (${params.symbol})...`);

    const formData = new FormData();

    // Image handling
    if (params.imageUrl) {
      console.log(`[PumpFun] Downloading image from ${params.imageUrl.slice(0, 60)}...`);
      const imgResp = await fetch(params.imageUrl);
      if (!imgResp.ok) throw new Error(`Failed to download image: ${imgResp.status}`);
      const imgBuffer = await imgResp.arrayBuffer();
      const blob = new Blob([imgBuffer], { type: 'image/png' });
      formData.append('file', blob, 'token-image.png');
    } else {
      // Minimal 1x1 purple PNG placeholder
      const png = Buffer.from(
        '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d76360f86f0000000201017798cc370000000049454e44ae426082',
        'hex'
      );
      const arrayBuf = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuf], { type: 'image/png' });
      formData.append('file', blob, 'placeholder.png');
    }

    formData.append('name', params.name);
    formData.append('symbol', params.symbol);
    formData.append('description', params.description || '');
    formData.append('showName', 'true');

    if (params.twitter) formData.append('twitter', params.twitter);
    if (params.telegram) formData.append('telegram', params.telegram);
    if (params.website) formData.append('website', params.website);

    const resp = await fetch(PUMP_IPFS_URL, {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Pump.fun IPFS upload failed (${resp.status}): ${text}`);
    }

    const data = await resp.json() as PumpFunMetadataResult;
    if (!data.metadataUri) {
      throw new Error(`Pump.fun IPFS upload missing metadataUri: ${JSON.stringify(data)}`);
    }

    console.log(`[PumpFun] Metadata uploaded: ${data.metadataUri}`);
    return data;
  }

  /**
   * Create a token on pump.fun.
   *
   * Uses PumpPortal's local transaction API to build the unsigned tx,
   * then signs locally with wallet + mint keypair and sends.
   *
   * Flow:
   *   1. Generate random mint keypair
   *   2. Upload metadata to IPFS
   *   3. Request unsigned tx from PumpPortal
   *   4. Deserialize, sign with wallet + mint
   *   5. Send to Solana
   */
  async createToken(params: PumpFunCreateParams): Promise<PumpFunCreateResult> {
    // Step 1: Generate mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`[PumpFun] Generated mint: ${mintKeypair.publicKey.toBase58()}`);

    // Step 2: Upload metadata
    const { metadataUri } = await this.uploadMetadata(params);

    // Step 3: Request unsigned transaction from PumpPortal
    console.log('[PumpFun] Building create transaction via PumpPortal...');

    const txResp = await fetch(PUMPPORTAL_LOCAL_TX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: this.wallet.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: {
          name: params.name,
          symbol: params.symbol,
          uri: metadataUri,
        },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: 'true',
        amount: params.initialBuySol ?? 0,
        slippage: params.slippage ?? 10,
        priorityFee: params.priorityFee ?? 0.0005,
        pool: 'pump',
      }),
    });

    if (!txResp.ok) {
      const text = await txResp.text();
      throw new Error(`PumpPortal create tx failed (${txResp.status}): ${text}`);
    }

    // Step 4: Deserialize and sign
    // PumpPortal returns base64-encoded VersionedTransaction bytes
    const txData = await txResp.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

    // Sign with wallet (the mint keypair is already included by PumpPortal)
    tx.sign([this.wallet, mintKeypair]);

    // Step 5: Send
    console.log('[PumpFun] Sending transaction...');

    const signature = await this.connection.sendRawTransaction(
      tx.serialize(),
      { skipPreflight: false, maxRetries: 3 }
    );

    console.log(`[PumpFun] Tx submitted: ${signature}`);

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    const mintAddress = mintKeypair.publicKey.toBase58();
    const pumpFunUrl = `https://pump.fun/coin/${mintAddress}`;
    const explorerUrl = `https://solscan.io/tx/${signature}`;

    console.log(`[PumpFun] Token created: ${mintAddress}`);
    console.log(`[PumpFun] Pump.fun: ${pumpFunUrl}`);
    console.log(`[PumpFun] Explorer: ${explorerUrl}`);

    return {
      mintAddress,
      txSignature: signature,
      name: params.name,
      symbol: params.symbol,
      metadataUri,
      pumpFunUrl,
      explorerUrl,
    };
  }

  get walletAddress(): string {
    return this.wallet.publicKey.toBase58();
  }
}

// ── Factory / Singleton ──────────────────────────────────

let pumpFunClient: PumpFunClient | null = null;

/**
 * Get or create PumpFunClient singleton.
 * Uses SOLANA_DEPLOYER_PRIVATE_KEY (base58) or falls back to TREASURY_PRIVATE_KEY (base64).
 */
export function getPumpFunClient(): PumpFunClient {
  if (!pumpFunClient) {
    let keypair: Keypair;

    // Try base58 private key first (standard Solana format)
    const b58Key = process.env.SOLANA_DEPLOYER_PRIVATE_KEY;
    if (b58Key) {
      keypair = Keypair.fromSecretKey(bs58.decode(b58Key));
    } else {
      // Fall back to base64 treasury key
      const b64Key = process.env.TREASURY_PRIVATE_KEY;
      if (!b64Key) {
        throw new Error('SOLANA_DEPLOYER_PRIVATE_KEY or TREASURY_PRIVATE_KEY required for pump.fun');
      }
      keypair = Keypair.fromSecretKey(Buffer.from(b64Key, 'base64'));
    }

    pumpFunClient = new PumpFunClient(keypair);
  }
  return pumpFunClient;
}
