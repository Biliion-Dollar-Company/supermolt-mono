/**
 * Ponzinomics API Connector
 * Integrates token analytics, trading signals, and execution
 */

import { env } from './env';

export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  verified?: boolean;
}

export interface TokenSignal {
  mint: string;
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-1
  reason: string;
  priceTarget?: number;
  stopLoss?: number;
  updatedAt: string;
}

export interface TokenAnalytics {
  mint: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  liquidityUSD: number;
}

export interface TradeExecution {
  transactionId: string;
  mint: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  slippage: number;
  signature: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

class PonzinomicsConnector {
  private baseUrl = 'https://api.ponzinomics.dev';
  private apiKey = env.PONZINOMICS_API_KEY;

  async getTokenMetadata(mint: string): Promise<TokenMetadata> {
    const response = await fetch(`${this.baseUrl}/tokens/${mint}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token metadata: ${response.statusText}`);
    }

    return response.json();
  }

  async getTokenSignal(mint: string): Promise<TokenSignal> {
    const response = await fetch(`${this.baseUrl}/signals/${mint}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token signal: ${response.statusText}`);
    }

    return response.json();
  }

  async getTokenAnalytics(mint: string): Promise<TokenAnalytics> {
    const response = await fetch(`${this.baseUrl}/analytics/${mint}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token analytics: ${response.statusText}`);
    }

    return response.json();
  }

  async getTrendingTokens(limit = 10): Promise<TokenMetadata[]> {
    const response = await fetch(`${this.baseUrl}/trending?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trending tokens: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tokens || [];
  }

  async getTokensBySignal(signal: TokenSignal['signal'], limit = 20): Promise<TokenMetadata[]> {
    const response = await fetch(
      `${this.baseUrl}/signals?signal=${signal}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens by signal: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tokens || [];
  }

  async executeSwap(
    walletAddress: string,
    mint: string,
    amount: number,
    slippage: number,
  ): Promise<TradeExecution> {
    const response = await fetch(`${this.baseUrl}/trades/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet: walletAddress,
        mint,
        amount,
        slippage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute swap: ${response.statusText}`);
    }

    return response.json();
  }

  async getTradeHistory(walletAddress: string, limit = 50): Promise<TradeExecution[]> {
    const response = await fetch(
      `${this.baseUrl}/trades/history?wallet=${walletAddress}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch trade history: ${response.statusText}`);
    }

    const data = await response.json();
    return data.trades || [];
  }

  async copyTrade(
    fromAgent: string,
    toWallet: string,
    tradeId: string,
    scalePercent = 100,
  ): Promise<TradeExecution> {
    const response = await fetch(`${this.baseUrl}/trades/copy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromAgent,
        toWallet,
        tradeId,
        scalePercent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to copy trade: ${response.statusText}`);
    }

    return response.json();
  }

  async getArbitrageOpportunities(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/arbitrage/opportunities`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch arbitrage opportunities: ${response.statusText}`);
    }

    const data = await response.json();
    return data.opportunities || [];
  }
}

export const ponzinomics = new PonzinomicsConnector();
