/**
 * Sortino Ratio Calculator Service
 * Calculates risk-adjusted returns using only downside deviation
 */

import { PrismaClient } from '@prisma/client';

interface TradeReturn {
  return: number;
  timestamp: Date;
}

interface AgentMetrics {
  agentId: string;
  sortinoRatio: number;
  winRate: number;
  maxDrawdown: number;
  totalPnl: number;
  totalTrades: number;
  averageReturn: number;
  downsideDeviation: number;
}

export class SortinoService {
  private db: PrismaClient;
  private riskFreeRate: number;

  constructor(db: PrismaClient, riskFreeRate: number = 0) {
    this.db = db;
    this.riskFreeRate = riskFreeRate;
  }

  /**
   * Calculate Sortino Ratio for a specific agent
   * Formula: (Mean Return - Risk-Free Rate) / Downside Deviation
   * Only negative returns are used for downside deviation
   */
  async calculateAgentSortino(agentId: string): Promise<AgentMetrics | null> {
    // Fetch all trades for this agent from FeedActivity
    const trades = await this.db.feedActivity.findMany({
      where: { agentId },
      orderBy: { timestamp: 'asc' },
    });

    if (trades.length === 0) {
      return null;
    }

    // Calculate returns for each trade
    const returns: number[] = [];
    let totalPnl = 0;
    let winningTrades = 0;

    for (const trade of trades) {
      if (trade.pnl !== null) {
        const pnlValue = parseFloat(trade.pnl.toString());
        returns.push(pnlValue);
        totalPnl += pnlValue;
        if (pnlValue > 0) {
          winningTrades++;
        }
      }
    }

    // If no PnL data available, return zeros
    if (returns.length === 0) {
      return {
        agentId,
        sortinoRatio: 0,
        winRate: 0,
        maxDrawdown: 0,
        totalPnl: 0,
        totalTrades: trades.length,
        averageReturn: 0,
        downsideDeviation: 0,
      };
    }

    // Calculate mean return
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate downside deviation (only negative returns below mean)
    const negativeReturns = returns.filter((r) => r < 0);
    const downsideDeviation = this.calculateDownsideDeviation(negativeReturns);

    // Calculate Sortino Ratio
    let sortinoRatio = 0;
    if (downsideDeviation > 0) {
      sortinoRatio = (meanReturn - this.riskFreeRate) / downsideDeviation;
    } else if (meanReturn > 0) {
      // If no downside but positive returns, assign high Sortino
      sortinoRatio = 10;
    }

    // Calculate other metrics
    const winRate = winningTrades / returns.length;
    const maxDrawdown = this.calculateMaxDrawdown(returns);

    return {
      agentId,
      sortinoRatio,
      winRate,
      maxDrawdown,
      totalPnl,
      totalTrades: trades.length,
      averageReturn: meanReturn,
      downsideDeviation,
    };
  }

  /**
   * Calculate downside deviation
   * Uses only negative returns
   */
  private calculateDownsideDeviation(negativeReturns: number[]): number {
    if (negativeReturns.length === 0) {
      return 0;
    }

    // Calculate variance of negative returns
    const mean = negativeReturns.reduce((sum, r) => sum + r, 0) / negativeReturns.length;
    const squaredDiffs = negativeReturns.map((r) => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / negativeReturns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate maximum drawdown
   * Maximum peak-to-trough decline
   */
  private calculateMaxDrawdown(returns: number[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const ret of returns) {
      cumulative += ret;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / Math.max(Math.abs(peak), 1);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  /**
   * Calculate and store metrics for all agents with trades
   */
  async calculateAllAgents(): Promise<void> {
    // Get all unique agent IDs from FeedActivity
    const agentIds = await this.db.feedActivity.findMany({
      select: { agentId: true },
      distinct: ['agentId'],
    });

    console.log(`📊 Calculating Sortino for ${agentIds.length} agents...`);

    for (const { agentId } of agentIds) {
      try {
        const metrics = await this.calculateAgentSortino(agentId);

        if (metrics) {
          // Upsert to AgentStats table
          await this.db.agentStats.upsert({
            where: { agentId },
            create: {
              agentId,
              sortinoRatio: metrics.sortinoRatio,
              winRate: metrics.winRate,
              maxDrawdown: metrics.maxDrawdown,
              totalPnl: metrics.totalPnl,
              totalTrades: metrics.totalTrades,
            },
            update: {
              sortinoRatio: metrics.sortinoRatio,
              winRate: metrics.winRate,
              maxDrawdown: metrics.maxDrawdown,
              totalPnl: metrics.totalPnl,
              totalTrades: metrics.totalTrades,
              updatedAt: new Date(),
            },
          });

          console.log(`  ✅ ${agentId.slice(0, 8)}... - Sortino: ${metrics.sortinoRatio.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to calculate for ${agentId}:`, error);
      }
    }

    console.log('✅ Sortino calculation complete');
  }

  /**
   * Get leaderboard (top N agents by Sortino)
   */
  async getLeaderboard(limit: number = 100): Promise<AgentMetrics[]> {
    const stats = await this.db.agentStats.findMany({
      orderBy: { sortinoRatio: 'desc' },
      take: limit,
    });

    return stats.map((s) => ({
      agentId: s.agentId,
      sortinoRatio: parseFloat(s.sortinoRatio.toString()),
      winRate: parseFloat(s.winRate.toString()),
      maxDrawdown: parseFloat(s.maxDrawdown.toString()),
      totalPnl: parseFloat(s.totalPnl.toString()),
      totalTrades: s.totalTrades,
      averageReturn: s.totalTrades > 0 ? parseFloat(s.totalPnl.toString()) / s.totalTrades : 0,
      downsideDeviation: 0, // Not stored in DB
    }));
  }

  /**
   * Get individual agent stats
   */
  async getAgentStats(agentId: string): Promise<AgentMetrics | null> {
    const stats = await this.db.agentStats.findUnique({
      where: { agentId },
    });

    if (!stats) {
      // Try to calculate fresh
      return await this.calculateAgentSortino(agentId);
    }

    return {
      agentId: stats.agentId,
      sortinoRatio: parseFloat(stats.sortinoRatio.toString()),
      winRate: parseFloat(stats.winRate.toString()),
      maxDrawdown: parseFloat(stats.maxDrawdown.toString()),
      totalPnl: parseFloat(stats.totalPnl.toString()),
      totalTrades: stats.totalTrades,
      averageReturn: stats.totalTrades > 0 ? parseFloat(stats.totalPnl.toString()) / stats.totalTrades : 0,
      downsideDeviation: 0,
    };
  }
}

export function createSortinoService(db: PrismaClient, riskFreeRate?: number) {
  return new SortinoService(db, riskFreeRate);
}
