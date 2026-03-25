/**
 * Portfolio Manager Service — handles portfolio allocation strategies,
 * rebalancing logic, and performance metric computation.
 */

import type { AssetClassType } from './rwa-tokens.registry';

export type StrategyProfile = 'conservative' | 'balanced' | 'aggressive';

export interface AllocationTarget {
  symbol: string;
  assetClass: AssetClassType;
  weight: number;
}

export interface RebalanceTrade {
  fromSymbol: string;
  toSymbol: string;
  amount: number;
  reason: string;
}

export interface PortfolioMetrics {
  totalReturn: number;
  sortinoRatio: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
}

const STRATEGY_TEMPLATES: Record<StrategyProfile, AllocationTarget[]> = {
  conservative: [
    { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 40 },
    { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 20 },
    { symbol: 'XAU', assetClass: 'GOLD', weight: 15 },
    { symbol: 'CETES', assetClass: 'GOVERNMENT_BONDS', weight: 10 },
    { symbol: 'USDC', assetClass: 'CRYPTO', weight: 15 },
  ],
  balanced: [
    { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 25 },
    { symbol: 'SPYx', assetClass: 'EQUITIES', weight: 20 },
    { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 15 },
    { symbol: 'XAU', assetClass: 'GOLD', weight: 10 },
    { symbol: 'PRCL', assetClass: 'REAL_ESTATE', weight: 10 },
    { symbol: 'USDC', assetClass: 'CRYPTO', weight: 20 },
  ],
  aggressive: [
    { symbol: 'SPYx', assetClass: 'EQUITIES', weight: 30 },
    { symbol: 'USDC', assetClass: 'CRYPTO', weight: 25 },
    { symbol: 'PRCL', assetClass: 'REAL_ESTATE', weight: 15 },
    { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 15 },
    { symbol: 'XAU', assetClass: 'GOLD', weight: 10 },
    { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 5 },
  ],
};

export class PortfolioManagerService {
  private mockMode: boolean;

  constructor(mockMode?: boolean) {
    this.mockMode = mockMode ?? true;
  }

  generateTargetAllocation(strategy: StrategyProfile): AllocationTarget[] {
    return STRATEGY_TEMPLATES[strategy] || STRATEGY_TEMPLATES.balanced;
  }

  calculateRebalanceTrades(
    current: AllocationTarget[],
    target: AllocationTarget[],
    totalValueUsd: number,
  ): RebalanceTrade[] {
    const trades: RebalanceTrade[] = [];
    const currentMap = new Map(current.map((c) => [c.symbol, c.weight]));
    for (const t of target) {
      const currentWeight = currentMap.get(t.symbol) || 0;
      const diff = t.weight - currentWeight;
      if (diff > 1) {
        trades.push({
          fromSymbol: 'USDC',
          toSymbol: t.symbol,
          amount: (diff / 100) * totalValueUsd,
          reason: `Increase ${t.symbol} from ${currentWeight.toFixed(1)}% to ${t.weight}%`,
        });
      } else if (diff < -1) {
        trades.push({
          fromSymbol: t.symbol,
          toSymbol: 'USDC',
          amount: (Math.abs(diff) / 100) * totalValueUsd,
          reason: `Decrease ${t.symbol} from ${currentWeight.toFixed(1)}% to ${t.weight}%`,
        });
      }
    }
    return trades;
  }

  computeMetrics(data: {
    totalValue: number;
    initialValue: number;
    dailyReturns: number[];
  }): PortfolioMetrics {
    const { totalValue, initialValue, dailyReturns } = data;
    const totalReturn = ((totalValue - initialValue) / initialValue) * 100;

    const mean =
      dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252);

    const downsideReturns = dailyReturns.filter((r) => r < 0);
    const downsideVariance =
      downsideReturns.length > 0
        ? downsideReturns.reduce((sum, r) => sum + r * r, 0) /
          downsideReturns.length
        : 0.0001;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);

    const annualizedReturn = mean * 252;
    const riskFreeRate = 0.04;

    const sharpeRatio =
      volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;
    const sortinoRatio =
      downsideDeviation > 0
        ? (annualizedReturn - riskFreeRate) / downsideDeviation
        : 0;

    let peak = initialValue;
    let maxDrawdown = 0;
    let runningValue = initialValue;
    for (const r of dailyReturns) {
      runningValue *= 1 + r;
      if (runningValue > peak) peak = runningValue;
      const drawdown = ((peak - runningValue) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return { totalReturn, sortinoRatio, sharpeRatio, maxDrawdown, volatility };
  }
}
