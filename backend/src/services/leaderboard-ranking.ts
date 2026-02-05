/**
 * Leaderboard Ranking Service
 * Calculate agent rankings using multiple metrics
 */

import { PrismaClient } from '@prisma/client';

interface AgentMetrics {
  agentId: string;
  pubkey: string;
  name: string;
  status: string;
  trades: number;
  totalPnL: number;
  winRate: number;
  sortino: number;
  sharpeRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
  consecutiveWins: number;
  consistencyScore: number;
  rank: number;
  score: number;
}

interface RankingWeights {
  sortino: number; // 40% - Risk-adjusted return
  winRate: number; // 20% - Winning trades
  consistency: number; // 15% - Low volatility
  recovery: number; // 15% - Recovery from drawdowns
  volume: number; // 10% - Total trades
}

const DEFAULT_WEIGHTS: RankingWeights = {
  sortino: 0.4,
  winRate: 0.2,
  consistency: 0.15,
  recovery: 0.15,
  volume: 0.1,
};

class LeaderboardRankingService {
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  /**
   * Calculate complete agent metrics
   */
  async calculateAgentMetrics(agentId: string): Promise<AgentMetrics | null> {
    const agent = await this.db.agent.findUnique({
      where: { id: agentId },
      include: {
        _count: { select: { feedActivities: true } },
        agentStats: true,
      },
    });

    if (!agent) return null;

    const trades = await this.db.feedActivity.findMany({
      where: { agentId },
    });

    if (trades.length === 0) {
      return {
        agentId,
        pubkey: agent.pubkey,
        name: agent.name,
        status: agent.status,
        trades: 0,
        totalPnL: 0,
        winRate: 0,
        sortino: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        recoveryFactor: 0,
        consecutiveWins: 0,
        consistencyScore: 0,
        rank: 0,
        score: 0,
      };
    }

    const pnlArray = trades.map((t) => t.pnl || 0);
    const winningTrades = pnlArray.filter((p) => p > 0);
    const winRate = winningTrades.length / trades.length;
    const totalPnL = pnlArray.reduce((a, b) => a + b, 0);

    // Calculate Sortino Ratio (return / downside volatility)
    const sortino = this.calculateSortino(pnlArray);

    // Calculate Sharpe Ratio (return / total volatility)
    const sharpeRatio = this.calculateSharpe(pnlArray);

    // Calculate Max Drawdown
    const maxDrawdown = this.calculateMaxDrawdown(pnlArray);

    // Calculate Recovery Factor (total return / max drawdown)
    const recoveryFactor = Math.abs(maxDrawdown) > 0 ? totalPnL / Math.abs(maxDrawdown) : 0;

    // Calculate consecutive wins
    const consecutiveWins = this.calculateConsecutiveWins(pnlArray);

    // Consistency score (inverse of volatility)
    const volatility = this.calculateVolatility(pnlArray);
    const consistencyScore = Math.max(0, 100 - (volatility * 10)); // 0-100

    return {
      agentId,
      pubkey: agent.pubkey,
      name: agent.name,
      status: agent.status,
      trades: trades.length,
      totalPnL,
      winRate,
      sortino,
      sharpeRatio,
      maxDrawdown,
      recoveryFactor,
      consecutiveWins,
      consistencyScore,
      rank: 0, // Will be set during ranking
      score: 0, // Will be set during ranking
    };
  }

  /**
   * Rank all active agents
   */
  async rankAllAgents(weights: RankingWeights = DEFAULT_WEIGHTS): Promise<AgentMetrics[]> {
    const agents = await this.db.agent.findMany({
      where: { status: 'ACTIVE' },
    });

    const metricsArray: AgentMetrics[] = [];

    for (const agent of agents) {
      const metrics = await this.calculateAgentMetrics(agent.id);
      if (metrics) {
        metricsArray.push(metrics);
      }
    }

    // Calculate weighted scores
    const maxSortino = Math.max(...metricsArray.map((m) => m.sortino || 0), 1);
    const maxWinRate = Math.max(...metricsArray.map((m) => m.winRate || 0), 0.5);
    const maxConsistency = Math.max(...metricsArray.map((m) => m.consistencyScore || 0), 50);
    const maxRecovery = Math.max(...metricsArray.map((m) => m.recoveryFactor || 0), 1);
    const maxTrades = Math.max(...metricsArray.map((m) => m.trades || 0), 10);

    metricsArray.forEach((metrics) => {
      const normedSortino = (metrics.sortino / maxSortino) * weights.sortino;
      const normedWinRate = (metrics.winRate / maxWinRate) * weights.winRate;
      const normedConsistency = (metrics.consistencyScore / maxConsistency) * weights.consistency;
      const normedRecovery = (metrics.recoveryFactor / maxRecovery) * weights.recovery;
      const normedVolume = Math.min(metrics.trades / maxTrades, 1) * weights.volume;

      metrics.score = normedSortino + normedWinRate + normedConsistency + normedRecovery + normedVolume;
    });

    // Sort by score (descending) and assign ranks
    metricsArray.sort((a, b) => b.score - a.score);
    metricsArray.forEach((metrics, index) => {
      metrics.rank = index + 1;
    });

    return metricsArray;
  }

  /**
   * Calculate Sortino Ratio
   * Returns / Downside Volatility (only negative returns)
   */
  private calculateSortino(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const downside = returns
      .filter((r) => r < mean)
      .reduce((sum, r) => sum + Math.pow(r - mean, 2), 0);

    if (downside === 0) return returns.every((r) => r >= 0) ? 10 : 0;

    const downsideStdDev = Math.sqrt(downside / returns.length);
    return downsideStdDev > 0 ? mean / downsideStdDev : 0;
  }

  /**
   * Calculate Sharpe Ratio
   * (Returns - RiskFreeRate) / Volatility
   */
  private calculateSharpe(returns: number[], riskFreeRate = 0.02): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? (mean - riskFreeRate) / stdDev : 0;
  }

  /**
   * Calculate Maximum Drawdown
   */
  private calculateMaxDrawdown(returns: number[]): number {
    let maxDrawdown = 0;
    let peak = returns[0] || 0;

    for (const ret of returns) {
      const cumulativeReturn = peak + ret;
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = (peak - (peak + ret)) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return -maxDrawdown;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Find longest consecutive winning trades
   */
  private calculateConsecutiveWins(returns: number[]): number {
    let maxConsecutive = 0;
    let current = 0;

    for (const ret of returns) {
      if (ret > 0) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }

    return maxConsecutive;
  }

  /**
   * Format metrics for API response
   */
  formatMetrics(metrics: AgentMetrics) {
    return {
      agentId: metrics.agentId,
      rank: metrics.rank,
      name: metrics.name,
      pubkey: metrics.pubkey,
      score: metrics.score.toFixed(2),
      status: metrics.status,
      metrics: {
        trades: metrics.trades,
        pnl: metrics.totalPnL.toFixed(4),
        winRate: `${(metrics.winRate * 100).toFixed(1)}%`,
        sortino: metrics.sortino.toFixed(2),
        sharpe: metrics.sharpeRatio.toFixed(2),
        maxDrawdown: `${(metrics.maxDrawdown * 100).toFixed(1)}%`,
        recovery: metrics.recoveryFactor.toFixed(2),
        consistency: metrics.consistencyScore.toFixed(1),
        consecutiveWins: metrics.consecutiveWins,
      },
    };
  }
}

export function createLeaderboardService(db: PrismaClient) {
  return new LeaderboardRankingService(db);
}
