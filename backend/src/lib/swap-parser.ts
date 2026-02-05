import { PublicKey } from '@solana/web3.js';
import base58 from 'bs58';

/**
 * Supported DEX program IDs
 */
export const PROGRAM_IDS = {
  JUPITER: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsYZgUjCFnJ1r7p7Kho',
  RAYDIUM_V4: '675kPX9MHTjS2zt1qrXrQVxwwp4kakXqnMwCESKycD8',
  RAYDIUM_FUSION: 'routeUGWgWzR8AZwJ9u6YPMVto8aoXvs98vcjqqeaaSC',
  PUMP_FUN_AMM: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', // Pump.fun AMM program
  WSOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWaJiBWkGwZg68AEWXBdp5RkJJEKPZvMLZMqSNSjP',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEec'
};

/**
 * Swap information extracted from a transaction
 */
export interface SwapInfo {
  dex: 'jupiter' | 'raydium' | 'pump-fun' | 'unknown';
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount?: number;
  walletAddress?: string;
  signature?: string;
  timestamp?: string;
}

/**
 * Parse Jupiter swap instruction
 * Jupiter uses a specific instruction format with token swap data
 */
function parseJupiterSwap(instruction: any): SwapInfo | null {
  try {
    const parsed = instruction.parsed || {};
    const info = parsed.info || {};

    // Extract input/output tokens from instruction data
    // Jupiter format: typically has source and destination token accounts
    return {
      dex: 'jupiter',
      inputMint: info.source || '',
      outputMint: info.destination || '',
      inputAmount: info.amount ? Number(info.amount) : 0,
      outputAmount: info.outputAmount ? Number(info.outputAmount) : undefined
    };
  } catch (error) {
    console.error('Failed to parse Jupiter swap:', error);
    return null;
  }
}

/**
 * Parse Raydium swap instruction
 */
function parseRaydiumSwap(instruction: any): SwapInfo | null {
  try {
    const parsed = instruction.parsed || {};
    const info = parsed.info || {};

    return {
      dex: 'raydium',
      inputMint: info.tokenA || info.source || '',
      outputMint: info.tokenB || info.destination || '',
      inputAmount: info.inputAmount ? Number(info.inputAmount) : 0,
      outputAmount: info.outputAmount ? Number(info.outputAmount) : undefined
    };
  } catch (error) {
    console.error('Failed to parse Raydium swap:', error);
    return null;
  }
}

/**
 * Parse Pump.fun swap instruction
 * Pump.fun AMM format:
 * - accounts[1]: signer (wallet)
 * - accounts[3]: token mint
 * - accounts[4]: WSOL (wrapped SOL)
 * - Inner instructions contain transfer details
 */
function parsePumpFunSwap(instruction: any): SwapInfo | null {
  try {
    const accounts = instruction.accounts || [];
    
    // Pump.fun structure: signer is account[1], token mint is account[3], WSOL is account[4]
    const signerWallet = accounts[1] || '';
    const tokenMint = accounts[3] || '';
    const wsolMint = accounts[4] || PROGRAM_IDS.WSOL;

    // Check inner instructions for token transfers to get amounts
    const innerInstructions = instruction.innerInstructions || [];
    let inputAmount = 0;
    let outputAmount = 0;

    // Look for transfer instructions in inner calls
    for (const inner of innerInstructions) {
      const innerAccounts = inner.accounts || [];
      const programId = inner.programId || '';

      // Token program transfers
      if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
          programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        
        // Parse transfer data (base58 encoded, first 8 bytes are discriminator, next 8 bytes are amount)
        try {
          const decoded = base58.decode(inner.data || '');
          if (decoded.length >= 16) {
            // Read amount as u64 (little endian)
            const amountBytes = decoded.slice(1, 9); // Skip discriminator byte
            const amount = Number(
              amountBytes[0] +
              amountBytes[1] * 256 +
              amountBytes[2] * 256 * 256 +
              amountBytes[3] * 256 * 256 * 256
            );

            // Check if this is input (WSOL) or output (token) based on accounts
            const fromAccount = innerAccounts[0] || '';
            const toAccount = innerAccounts[2] || '';

            // If transferring from wallet, it's input (buying with SOL)
            if (toAccount === signerWallet || fromAccount.includes(signerWallet)) {
              if (outputAmount === 0) outputAmount = amount;
            } else if (inputAmount === 0) {
              inputAmount = amount;
            }
          }
        } catch (decodeError) {
          console.log('Could not decode transfer amount:', decodeError);
        }
      }
    }

    return {
      dex: 'pump-fun',
      inputMint: wsolMint, // Buying with SOL
      outputMint: tokenMint, // Getting token
      inputAmount: inputAmount > 0 ? inputAmount : 0,
      outputAmount: outputAmount > 0 ? outputAmount : undefined,
      walletAddress: signerWallet
    };
  } catch (error) {
    console.error('Failed to parse Pump.fun swap:', error);
    return null;
  }
}

/**
 * Decode raw instruction data (base58 encoded)
 * This is a basic decoder for detecting swap patterns
 */
function decodeRawInstruction(data: string): any {
  try {
    // Decode base58
    const decoded = base58.decode(data);

    // First 8 bytes are typically discriminator for Anchor programs
    const discriminator = decoded.slice(0, 8);

    return {
      discriminator: Buffer.from(discriminator).toString('hex'),
      dataLength: decoded.length,
      rawData: decoded
    };
  } catch (error) {
    console.error('Failed to decode instruction:', error);
    return null;
  }
}

/**
 * Extract token mint from accounts
 * Tries to identify token mints from instruction accounts
 */
function extractTokenMints(accounts: any[]): { source?: string; destination?: string } {
  try {
    const result: { source?: string; destination?: string } = {};

    if (Array.isArray(accounts) && accounts.length >= 2) {
      // Typically source is first account, destination is second
      result.source = accounts[0]?.pubkey || accounts[0];
      result.destination = accounts[1]?.pubkey || accounts[1];
    }

    return result;
  } catch (error) {
    console.error('Failed to extract token mints:', error);
    return {};
  }
}

/**
 * Main swap parser function
 * Identifies and extracts swap information from Solana instructions
 */
export function parseSwapInstruction(
  instruction: any,
  txSignature?: string,
  timestamp?: string
): SwapInfo | null {
  try {
    const programId = instruction.programId || '';

    console.log('🔍 [PARSER] Checking instruction:', {
      programId: programId.slice(0, 16) + '...',
      hasAccounts: !!(instruction.accounts && instruction.accounts.length > 0),
      accountCount: instruction.accounts?.length || 0
    });

    // Pump.fun AMM detection (HIGHEST PRIORITY - most common for new tokens)
    if (programId === PROGRAM_IDS.PUMP_FUN_AMM) {
      console.log('✅ [PARSER] Detected Pump.fun AMM swap');
      const swap = parsePumpFunSwap(instruction);
      return swap ? { ...swap, signature: txSignature, timestamp } : null;
    }

    // Jupiter detection
    if (programId.includes(PROGRAM_IDS.JUPITER)) {
      console.log('✅ [PARSER] Detected Jupiter swap');
      const swap = parseJupiterSwap(instruction);
      return swap ? { ...swap, signature: txSignature, timestamp } : null;
    }

    // Raydium detection
    if (
      programId.includes(PROGRAM_IDS.RAYDIUM_V4) ||
      programId.includes(PROGRAM_IDS.RAYDIUM_FUSION)
    ) {
      console.log('✅ [PARSER] Detected Raydium swap');
      const swap = parseRaydiumSwap(instruction);
      return swap ? { ...swap, signature: txSignature, timestamp } : null;
    }

    // Fallback: check for parsed swap type
    const parsed = instruction.parsed || {};
    if (parsed.type === 'swap' || parsed.type === 'tokenSwap') {
      console.log('⚠️ [PARSER] Detected generic swap (unknown DEX)');
      const info = parsed.info || {};
      return {
        dex: 'unknown',
        inputMint: info.source || info.inputMint || '',
        outputMint: info.destination || info.outputMint || '',
        inputAmount: info.amount || info.inputAmount || 0,
        outputAmount: info.outputAmount,
        signature: txSignature,
        timestamp
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse swap instruction:', error);
    return null;
  }
}

/**
 * Parse all instructions in a transaction and find swaps
 */
export function extractSwapsFromTransaction(
  transaction: any
): SwapInfo[] {
  const swaps: SwapInfo[] = [];

  try {
    const instructions = transaction.instructions || [];
    const txSignature = transaction.signature;
    const timestamp = transaction.timestamp;

    console.log('🔍 [PARSER] Extracting swaps from transaction:', {
      signature: typeof txSignature === 'string' ? txSignature.slice(0, 16) + '...' : 'unknown',
      instructionCount: instructions.length
    });

    for (const instruction of instructions) {
      const swap = parseSwapInstruction(instruction, txSignature, timestamp);
      if (swap) {
        console.log('✅ [PARSER] Swap found:', {
          dex: swap.dex,
          input: swap.inputMint.slice(0, 8) + '...',
          output: swap.outputMint.slice(0, 8) + '...',
          amount: swap.inputAmount
        });
        swaps.push(swap);
      }
    }

    console.log(`🔍 [PARSER] Total swaps extracted: ${swaps.length}`);
    return swaps;
  } catch (error) {
    console.error('Failed to extract swaps from transaction:', error);
    return [];
  }
}

/**
 * Normalize token mint for consistent comparison
 */
export function normalizeTokenMint(mint: string): string {
  if (!mint) return '';
  try {
    // Try to parse as PublicKey to validate
    new PublicKey(mint);
    return mint;
  } catch {
    return '';
  }
}

/**
 * Check if mint is a known stablecoin
 */
export function isStablecoin(mint: string): boolean {
  const stablecoins = [PROGRAM_IDS.USDC, PROGRAM_IDS.USDT];
  return stablecoins.includes(mint);
}

/**
 * Check if mint is wrapped SOL
 */
export function isWrappedSol(mint: string): boolean {
  return mint === PROGRAM_IDS.WSOL;
}
