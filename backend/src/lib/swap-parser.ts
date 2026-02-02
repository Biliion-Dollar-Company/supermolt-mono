import { PublicKey } from '@solana/web3.js';
import base58 from 'bs58';

/**
 * Supported DEX program IDs
 */
export const PROGRAM_IDS = {
  JUPITER: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsYZgUjCFnJ1r7p7Kho',
  RAYDIUM_V4: '675kPX9MHTjS2zt1qrXrQVxwwp4kakXqnMwCESKycD8',
  RAYDIUM_FUSION: 'routeUGWgWzR8AZwJ9u6YPMVto8aoXvs98vcjqqeaaSC',
  PUMP_FUN: 'TokenkegQfeZyiNwAJsyFbPVwwQQQZ1z5He8nwvWUL', // Placeholder - actual program varies
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
 * Pump.fun has simpler structure with bonding curve trades
 */
function parsePumpFunSwap(instruction: any): SwapInfo | null {
  try {
    const parsed = instruction.parsed || {};
    const info = parsed.info || {};

    // Pump.fun swaps have a specific token mint and SOL<->token trade
    return {
      dex: 'pump-fun',
      inputMint: info.inputMint || PROGRAM_IDS.WSOL, // Usually SOL
      outputMint: info.outputMint || info.tokenMint || '',
      inputAmount: info.inputAmount ? Number(info.inputAmount) : 0,
      outputAmount: info.outputAmount ? Number(info.outputAmount) : undefined
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

    // Match program ID to DEX
    if (programId.includes(PROGRAM_IDS.JUPITER)) {
      const swap = parseJupiterSwap(instruction);
      return swap ? { ...swap, signature: txSignature, timestamp } : null;
    }

    if (
      programId.includes(PROGRAM_IDS.RAYDIUM_V4) ||
      programId.includes(PROGRAM_IDS.RAYDIUM_FUSION)
    ) {
      const swap = parseRaydiumSwap(instruction);
      return swap ? { ...swap, signature: txSignature, timestamp } : null;
    }

    // Pump.fun detection - look for token swap patterns
    const parsed = instruction.parsed || {};
    if (parsed.type === 'swap' || parsed.type === 'tokenSwap') {
      // Try to identify which DEX based on program or data
      if (programId.includes('pump') || instruction.accounts?.some((a: any) => a.includes('pump'))) {
        const swap = parsePumpFunSwap(instruction);
        return swap ? { ...swap, signature: txSignature, timestamp } : null;
      }

      // Generic swap
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

    for (const instruction of instructions) {
      const swap = parseSwapInstruction(instruction, txSignature, timestamp);
      if (swap) {
        swaps.push(swap);
      }
    }

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
