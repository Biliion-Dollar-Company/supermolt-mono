/**
 * Jupiter RWA Swap Service — executes USDC <-> RWA token swaps via Jupiter Swap API v2.
 * Mock mode returns realistic swap simulations. Real mode calls https://api.jup.ag/swap/v2
 */

import { RWA_TOKENS, USDC_MINT, getRwaToken } from './rwa-tokens.registry';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fee: number;
  route: string;
}

export interface SwapResult {
  txSignature: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  status: 'completed' | 'failed';
}

const JUP_API = 'https://api.jup.ag';

export class JupiterRwaService {
  private mockMode: boolean;
  private apiKey: string | undefined;

  constructor(mockMode?: boolean) {
    this.mockMode = mockMode ?? (process.env.JUPITER_MOCK !== 'false');
    this.apiKey = process.env.JUPITER_API_KEY;
  }

  private resolveMint(symbol: string): string {
    if (symbol === 'USDC') return USDC_MINT;
    const token = getRwaToken(symbol);
    if (!token) throw new Error(`Unknown RWA token: ${symbol}`);
    return token.mint;
  }

  async getQuote(inputSymbol: string, outputSymbol: string, amount: number): Promise<SwapQuote> {
    const inputMint = this.resolveMint(inputSymbol);
    const outputMint = this.resolveMint(outputSymbol);

    if (this.mockMode) return this.mockQuote(inputMint, outputMint, inputSymbol, outputSymbol, amount);

    const amountLamports = Math.floor(amount * 1_000_000);
    const params = new URLSearchParams({ inputMint, outputMint, amount: amountLamports.toString(), slippageBps: '50' });
    const res = await fetch(`${JUP_API}/swap/v2/quote?${params}`, {
      headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
    });
    if (!res.ok) throw new Error(`Jupiter quote error: ${res.status}`);
    const data = await res.json();
    return {
      inputMint, outputMint, inputAmount: amount,
      outputAmount: Number(data.outAmount) / 1_000_000,
      priceImpact: Number(data.priceImpactPct || 0),
      fee: amount * 0.001,
      route: data.routePlan?.[0]?.swapInfo?.label || 'Jupiter',
    };
  }

  async executeSwap(inputSymbol: string, outputSymbol: string, amount: number, walletAddress: string): Promise<SwapResult> {
    const inputMint = this.resolveMint(inputSymbol);
    const outputMint = this.resolveMint(outputSymbol);

    if (this.mockMode) {
      const quote = this.mockQuote(inputMint, outputMint, inputSymbol, outputSymbol, amount);
      return {
        txSignature: `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        inputMint, outputMint, inputAmount: amount, outputAmount: quote.outputAmount, fee: quote.fee, status: 'completed',
      };
    }
    throw new Error('Real swap execution requires wallet signing — use mock mode for demo');
  }

  private mockQuote(inputMint: string, outputMint: string, inputSymbol: string, outputSymbol: string, amount: number): SwapQuote {
    const mockRates: Record<string, number> = {
      'USDC_USDY': 0.893, 'USDY_USDC': 1.12,
      'USDC_PRCL': 2.5, 'PRCL_USDC': 0.4,
      'USDC_CETES': 0.95, 'CETES_USDC': 1.05,
      'USDC_SPYx': 0.00189, 'SPYx_USDC': 528.30,
      'USDC_XAU': 0.000427, 'XAU_USDC': 2340.50,
      'USDC_syrupUSDC': 1.0, 'syrupUSDC_USDC': 1.0,
    };
    const rate = mockRates[`${inputSymbol}_${outputSymbol}`] || 1.0;
    const outputAmount = amount * rate;
    const slippage = outputAmount * 0.002;
    return { inputMint, outputMint, inputAmount: amount, outputAmount: outputAmount - slippage, priceImpact: 0.2, fee: amount * 0.001, route: 'Jupiter (mock)' };
  }
}
