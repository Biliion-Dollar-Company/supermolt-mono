/**
 * Trading Executor - Jupiter SDK Integration
 * 
 * Handles agent trade execution (BUY/SELL) via Jupiter aggregator.
 * Features:
 * - Progressive priority fees (start low, escalate on retry)
 * - Cost optimization (<1% total fees)
 * - Retry logic with exponential backoff
 * - Fee tracking and monitoring
 * 
 * Reference: DevPrint trading/jupiter.rs and trading/executor.rs
 */

import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_API_URL = 'https://lite-api.jup.ag/swap/v1';

// ============================================================================
// Types
// ============================================================================

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct?: string;
  routePlan?: any[];
  platformFee?: any;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded VersionedTransaction
  lastValidBlockHeight: number;
}

export interface BuyResult {
  signature: string;
  amountSol: number;
  tokensReceived: number;
  tokensReceivedRaw?: string; // Raw amount from Jupiter (before decimal conversion)
  tokenDecimals: number;
  priorityFeeLamports: number;
  networkFeeLamports?: number;
  swapFeeSol: number;
  totalFeesSol: number;
  executionMs: number;
  priceImpactPct?: number;
  slippageBps: number;
  attempt: number;
}

export interface SellResult {
  signature: string;
  tokensSold: number;
  solReceived: number;
  priorityFeeLamports: number;
  networkFeeLamports?: number;
  swapFeeSol: number;
  totalFeesSol: number;
  executionMs: number;
  priceImpactPct?: number;
  slippageBps: number;
  attempt: number;
}

interface ExecutorConfig {
  rpcUrl: string;
  maxRetries?: number;
  minSlippageBps?: number;
  maxSlippageBps?: number;
  timeoutMs?: number;
}

// ============================================================================
// Trading Executor
// ============================================================================

export class TradingExecutor {
  private connection: Connection;
  private maxRetries: number;
  private minSlippageBps: number;
  private maxSlippageBps: number;
  private timeoutMs: number;

  constructor(config: ExecutorConfig) {
    this.connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: config.timeoutMs || 60000
    });
    this.maxRetries = config.maxRetries || 3;
    this.minSlippageBps = config.minSlippageBps || 50; // 0.5%
    this.maxSlippageBps = config.maxSlippageBps || 300; // 3%
    this.timeoutMs = config.timeoutMs || 60000;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Execute a BUY trade (SOL → Token)
   * 
   * @param agentKeypair - Agent's Solana keypair (for signing)
   * @param tokenMint - Token mint address to buy
   * @param solAmount - Amount of SOL to spend
   * @returns BuyResult with transaction signature and metrics
   */
  async executeBuy(
    agentKeypair: Keypair,
    tokenMint: string,
    solAmount: number
  ): Promise<BuyResult> {
    const startTime = Date.now();
    const lamports = Math.floor(solAmount * 1e9);

    console.log(`🔄 Executing BUY: ${solAmount} SOL → ${tokenMint.slice(0, 8)}...`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Progressive priority fees (DevPrint pattern)
        const priorityFeeLamports = this.getPriorityFeeForAttempt(attempt);
        
        // Progressive slippage (increase on retry)
        const slippageBps = Math.min(
          this.minSlippageBps + (attempt - 1) * 50,
          this.maxSlippageBps
        );

        console.log(`  Attempt ${attempt}/${this.maxRetries}: priority=${priorityFeeLamports} lamports, slippage=${slippageBps} bps`);

        // 1. Get quote from Jupiter
        const quoteStartTime = Date.now();
        const quote = await this.getQuote(
          SOL_MINT,
          tokenMint,
          lamports,
          slippageBps
        );
        const quoteMs = Date.now() - quoteStartTime;

        console.log(`  ✅ Quote received: ${quote.outAmount} tokens (${quoteMs}ms)`);

        // 2. Get swap transaction
        const swapStartTime = Date.now();
        const swapResponse = await this.getSwapTransaction(
          quote,
          agentKeypair.publicKey.toString(),
          priorityFeeLamports
        );
        const swapMs = Date.now() - swapStartTime;

        console.log(`  ✅ Swap transaction built (${swapMs}ms)`);

        // 3. Deserialize, sign, and send
        const txStartTime = Date.now();
        const txBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(txBuffer);
        
        // Sign transaction
        transaction.sign([agentKeypair]);

        // Send transaction
        const signature = await this.connection.sendRawTransaction(
          transaction.serialize(),
          {
            skipPreflight: true, // Skip simulation (faster)
            maxRetries: 0 // We handle retries ourselves
          }
        );

        console.log(`  📤 Transaction sent: ${signature}`);

        // 4. Confirm transaction
        const confirmation = await this.connection.confirmTransaction(
          signature,
          'confirmed'
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        const txMs = Date.now() - txStartTime;
        const executionMs = Date.now() - startTime;

        console.log(`  ✅ Transaction confirmed (${txMs}ms)`);

        // 5. Calculate results
        const tokensReceived = parseFloat(quote.outAmount);
        const swapFeeSol = this.estimateSwapFee(solAmount);
        const totalFeesSol = (priorityFeeLamports / 1e9) + swapFeeSol;

        const result: BuyResult = {
          signature,
          amountSol: solAmount,
          tokensReceived,
          tokensReceivedRaw: quote.outAmount,
          tokenDecimals: 0, // TODO: Fetch from token metadata
          priorityFeeLamports,
          swapFeeSol,
          totalFeesSol,
          executionMs,
          priceImpactPct: quote.priceImpactPct ? parseFloat(quote.priceImpactPct) : undefined,
          slippageBps,
          attempt
        };

        console.log(`✅ BUY completed: ${tokensReceived.toLocaleString()} tokens`);
        console.log(`   Fees: ${totalFeesSol.toFixed(6)} SOL (${((totalFeesSol / solAmount) * 100).toFixed(2)}%)`);
        console.log(`   Time: ${executionMs}ms`);
        console.log(`   Solscan: https://solscan.io/tx/${signature}`);

        return result;

      } catch (error: any) {
        console.error(`  ❌ Attempt ${attempt} failed:`, error.message);

        // If last attempt, throw error
        if (attempt === this.maxRetries) {
          throw new Error(`All ${this.maxRetries} attempts failed. Last error: ${error.message}`);
        }

        // Exponential backoff before retry
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`  ⏳ Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error('Unreachable');
  }

  /**
   * Execute a SELL trade (Token → SOL)
   * 
   * @param agentKeypair - Agent's Solana keypair (for signing)
   * @param tokenMint - Token mint address to sell
   * @param tokenAmount - Amount of tokens to sell (in smallest units)
   * @returns SellResult with transaction signature and metrics
   */
  async executeSell(
    agentKeypair: Keypair,
    tokenMint: string,
    tokenAmount: number
  ): Promise<SellResult> {
    const startTime = Date.now();

    console.log(`🔄 Executing SELL: ${tokenAmount} tokens → SOL`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const priorityFeeLamports = this.getPriorityFeeForAttempt(attempt);
        const slippageBps = Math.min(
          this.minSlippageBps + (attempt - 1) * 50,
          this.maxSlippageBps
        );

        console.log(`  Attempt ${attempt}/${this.maxRetries}: priority=${priorityFeeLamports} lamports, slippage=${slippageBps} bps`);

        // 1. Get quote (Token → SOL)
        const quote = await this.getQuote(
          tokenMint,
          SOL_MINT,
          Math.floor(tokenAmount),
          slippageBps
        );

        const solReceived = parseFloat(quote.outAmount) / 1e9; // Convert lamports to SOL

        console.log(`  ✅ Quote received: ${solReceived.toFixed(4)} SOL`);

        // 2. Get swap transaction
        const swapResponse = await this.getSwapTransaction(
          quote,
          agentKeypair.publicKey.toString(),
          priorityFeeLamports
        );

        // 3. Sign and send
        const txBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(txBuffer);
        transaction.sign([agentKeypair]);

        const signature = await this.connection.sendRawTransaction(
          transaction.serialize(),
          { skipPreflight: true, maxRetries: 0 }
        );

        console.log(`  📤 Transaction sent: ${signature}`);

        // 4. Confirm
        const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        const executionMs = Date.now() - startTime;

        console.log(`  ✅ Transaction confirmed`);

        // 5. Calculate results
        const swapFeeSol = this.estimateSwapFee(solReceived);
        const totalFeesSol = (priorityFeeLamports / 1e9) + swapFeeSol;

        const result: SellResult = {
          signature,
          tokensSold: tokenAmount,
          solReceived,
          priorityFeeLamports,
          swapFeeSol,
          totalFeesSol,
          executionMs,
          priceImpactPct: quote.priceImpactPct ? parseFloat(quote.priceImpactPct) : undefined,
          slippageBps,
          attempt
        };

        console.log(`✅ SELL completed: ${solReceived.toFixed(4)} SOL received`);
        console.log(`   Fees: ${totalFeesSol.toFixed(6)} SOL (${((totalFeesSol / solReceived) * 100).toFixed(2)}%)`);
        console.log(`   Time: ${executionMs}ms`);
        console.log(`   Solscan: https://solscan.io/tx/${signature}`);

        return result;

      } catch (error: any) {
        console.error(`  ❌ Attempt ${attempt} failed:`, error.message);

        if (attempt === this.maxRetries) {
          throw new Error(`All ${this.maxRetries} attempts failed. Last error: ${error.message}`);
        }

        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`  ⏳ Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error('Unreachable');
  }

  // ==========================================================================
  // Jupiter API Integration
  // ==========================================================================

  /**
   * Get swap quote from Jupiter
   */
  private async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<JupiterQuote> {
    const url = `${JUPITER_API_URL}/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=${slippageBps}&` +
      `restrictIntermediateTokens=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        
        // Parse common errors
        if (errorText.includes('Could not find any routes')) {
          throw new Error('No liquidity route found for this token');
        }
        if (errorText.includes('TOKEN_NOT_TRADABLE') || errorText.includes('not tradable')) {
          throw new Error('Token not tradeable on Jupiter');
        }
        
        throw new Error(`Jupiter quote failed (${response.status}): ${errorText}`);
      }

      const quote: JupiterQuote = await response.json();
      return quote;

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Jupiter API timeout - try again later');
      }
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter
   */
  private async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    priorityFeeLamports: number
  ): Promise<JupiterSwapResponse> {
    const url = `${JUPITER_API_URL}/swap`;

    const body = {
      quoteResponse: quote,
      userPublicKey,
      wrapUnwrapSOL: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: priorityFeeLamports,
          priorityLevel: this.getPriorityLevel(priorityFeeLamports)
        }
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter swap failed (${response.status}): ${errorText}`);
      }

      const swapResponse: JupiterSwapResponse = await response.json();
      return swapResponse;

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Jupiter API timeout - try again later');
      }
      throw error;
    }
  }

  // ==========================================================================
  // Fee Management (DevPrint pattern)
  // ==========================================================================

  /**
   * Progressive priority fees - start low, escalate on retry
   * Pattern from DevPrint trading/executor.rs
   */
  private getPriorityFeeForAttempt(attempt: number): number {
    switch (attempt) {
      case 1: return 10_000;        // 0.00001 SOL (~$0.002) - "min"
      case 2: return 100_000;       // 0.0001 SOL (~$0.02)   - "low"
      case 3: return 1_000_000;     // 0.001 SOL (~$0.20)    - "medium"
      default: return 10_000_000;   // 0.01 SOL (~$2)        - "high"
    }
  }

  /**
   * Map lamports to Jupiter priority level
   */
  private getPriorityLevel(lamports: number): string {
    if (lamports < 50_000) return 'min';
    if (lamports < 500_000) return 'low';
    if (lamports < 5_000_000) return 'medium';
    return 'high';
  }

  /**
   * Estimate swap fee (Jupiter typically charges ~0.5%)
   */
  private estimateSwapFee(tradeValueSol: number): number {
    return tradeValueSol * 0.005; // 0.5%
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Check if Jupiter can route to a token (liquidity check)
   */
  async canQuote(tokenMint: string): Promise<boolean> {
    try {
      const testAmount = 1_000_000; // 0.001 SOL
      const quote = await this.getQuote(SOL_MINT, tokenMint, testAmount, 500);
      const outAmount = parseFloat(quote.outAmount);
      return outAmount > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get wallet SOL balance
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(publicKey);
    return balance / 1e9;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create trading executor instance
 */
export function createTradingExecutor(rpcUrl: string): TradingExecutor {
  return new TradingExecutor({ rpcUrl });
}
