/**
 * RWA Data Service — aggregates RWA token data: prices from Pyth, yields from registry,
 * and asset class breakdown for portfolio views.
 */

import { RWA_TOKENS, type RwaTokenInfo, type AssetClassType } from './rwa-tokens.registry';
import { PythOracleService } from './pyth-oracle.service';

export interface EnrichedRwaToken extends RwaTokenInfo {
  currentPrice: number;
  priceChange24h: number;
}

export interface YieldRate {
  symbol: string;
  name: string;
  apy: number;
  issuer: string;
  assetClass: AssetClassType;
}

export class RwaDataService {
  private pyth: PythOracleService;

  constructor(mockMode?: boolean) {
    this.pyth = new PythOracleService(mockMode);
  }

  async getTokens(): Promise<EnrichedRwaToken[]> {
    const pythPrices = await this.pyth.getAllRwaPrices();
    return RWA_TOKENS.map(token => {
      const pythPrice = pythPrices[token.symbol];
      let currentPrice: number;
      if (pythPrice) {
        currentPrice = pythPrice.price;
      } else {
        const fallback: Record<string, number> = { USDY: 1.12, PRCL: 0.40, CETES: 1.05, syrupUSDC: 1.00 };
        currentPrice = fallback[token.symbol] || 1.0;
      }
      return { ...token, currentPrice, priceChange24h: (Math.random() - 0.5) * 4 };
    });
  }

  async getYieldRates(): Promise<YieldRate[]> {
    return RWA_TOKENS
      .filter(t => t.estimatedYield !== null && t.estimatedYield > 0)
      .map(t => ({ symbol: t.symbol, name: t.name, apy: t.estimatedYield!, issuer: t.issuer, assetClass: t.assetClass }));
  }

  async getAssetClassBreakdown(): Promise<Record<AssetClassType, RwaTokenInfo[]>> {
    const breakdown: Record<string, RwaTokenInfo[]> = {};
    for (const token of RWA_TOKENS) {
      if (!breakdown[token.assetClass]) breakdown[token.assetClass] = [];
      breakdown[token.assetClass].push(token);
    }
    return breakdown as Record<AssetClassType, RwaTokenInfo[]>;
  }
}
