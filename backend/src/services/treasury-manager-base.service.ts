/**
 * Treasury Manager Service - Base Chain (via Surge OpenClaw API)
 *
 * Manages USDC treasury wallet and reward distribution on Base.
 * Uses Surge transfer API instead of direct ethers.js — no private keys needed.
 *
 * BASE USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (Circle native, 6 decimals)
 */

import { db as prisma } from '../lib/db';
import * as surgeApi from './surge-api.service';

const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Rank multipliers (same as Solana/BSC)
const RANK_MULTIPLIERS: { [key: number]: number } = {
  1: 2.0,
  2: 1.5,
  3: 1.0,
  4: 0.75,
  5: 0.5,
};

export interface BaseAllocationResult {
  agentId: string;
  agentName: string;
  walletAddress: string;
  rank: number;
  tradeCount: number;
  sortinoRatio: number;
  winRate: number;
  usdcAmount: number;
  multiplier: number;
}

export interface BaseDistributionResult {
  agentId: string;
  agentName: string;
  amount: number;
  txHash: string;
  status: 'success' | 'failed';
  error?: string;
  basescan: string;
}

export class TreasuryManagerBaseService {
  private get treasuryWalletId(): string | null {
    return process.env.SURGE_TREASURY_WALLET_ID || null;
  }

  /**
   * Get USDC balance of treasury wallet on Base
   */
  async getBalance(): Promise<number> {
    const walletId = this.treasuryWalletId;
    if (!walletId) throw new Error('SURGE_TREASURY_WALLET_ID not configured');

    const result = await surgeApi.getTokenBalance(walletId, surgeApi.SURGE_CHAIN_ID_BASE, BASE_USDC_ADDRESS);
    return parseFloat(result.balance) || 0;
  }

  /**
   * Calculate USDC allocations for TradingAgents in a Base epoch.
   * Ranks by trade_count DESC -> sortino DESC -> winRate DESC.
   */
  async calculateAgentAllocations(epochId: string): Promise<BaseAllocationResult[]> {
    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if ((epoch as any).chain !== 'base') throw new Error(`Epoch ${epochId} is not a Base epoch`);

    const agents = await prisma.tradingAgent.findMany({
      where: { status: 'ACTIVE', chain: 'BASE' },
    });

    if (agents.length === 0) throw new Error('No active Base TradingAgents found');

    const agentIds = agents.map((a) => a.id);

    const [stats, agentTradeCounts] = await Promise.all([
      prisma.agentStats.findMany({ where: { agentId: { in: agentIds } } }),
      prisma.agentTrade.groupBy({
        by: ['agentId'],
        where: { agentId: { in: agentIds } },
        _count: { agentId: true },
      }),
    ]);

    const statsMap = new Map(stats.map((s) => [s.agentId, s]));
    const tradeCountMap = new Map(agentTradeCounts.map((tc) => [tc.agentId, tc._count.agentId]));

    const rankedAgents = agents.map((agent) => {
      const agentStats = statsMap.get(agent.id);
      const tradeCount = tradeCountMap.get(agent.id) || agent.totalTrades;
      const sortinoRatio = agentStats ? Number(agentStats.sortinoRatio) : 0;
      const winRate = Number(agent.winRate);
      return { agent, tradeCount, sortinoRatio, winRate };
    });

    rankedAgents.sort((a, b) => {
      if (b.tradeCount !== a.tradeCount) return b.tradeCount - a.tradeCount;
      if (b.sortinoRatio !== a.sortinoRatio) return b.sortinoRatio - a.sortinoRatio;
      return b.winRate - a.winRate;
    });

    const baseAllocation = Number(epoch.baseAllocation) || 200;
    const usdcPool = Number(epoch.usdcPool);
    const allocations: BaseAllocationResult[] = [];

    let totalRaw = 0;
    const rawAmounts: number[] = [];
    for (let i = 0; i < rankedAgents.length; i++) {
      const rank = i + 1;
      const multiplier = RANK_MULTIPLIERS[rank] || 0.5;
      const { tradeCount } = rankedAgents[i];
      const performanceAdjustment = Math.max(0.5, Math.min(1.0, tradeCount > 0 ? 0.7 + (tradeCount / 50) * 0.3 : 0.5));
      const raw = baseAllocation * multiplier * performanceAdjustment;
      rawAmounts.push(raw);
      totalRaw += raw;
    }

    const scaleFactor = totalRaw > usdcPool ? usdcPool / totalRaw : 1;

    for (let i = 0; i < rankedAgents.length; i++) {
      const { agent, tradeCount, sortinoRatio, winRate } = rankedAgents[i];
      const rank = i + 1;
      const multiplier = RANK_MULTIPLIERS[rank] || 0.5;
      const usdcAmount = Math.round(rawAmounts[i] * scaleFactor * 100) / 100;

      allocations.push({
        agentId: agent.id,
        agentName: agent.displayName || agent.name,
        walletAddress: agent.evmAddress || agent.userId,
        rank,
        tradeCount,
        sortinoRatio,
        winRate,
        usdcAmount,
        multiplier,
      });
    }

    return allocations;
  }

  /**
   * Execute USDC distribution to TradingAgents for a Base epoch.
   * NOTE: Surge API does not support direct ERC-20 transfers — this method
   * always throws. Use an on-chain transfer mechanism instead.
   */
  async distributeAgentRewards(epochId: string): Promise<{
    allocations: BaseDistributionResult[];
    summary: { totalAmount: number; successful: number; failed: number; timestamp: string };
  }> {
    const walletId = this.treasuryWalletId;
    if (!walletId) throw new Error('SURGE_TREASURY_WALLET_ID not configured');

    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if ((epoch as any).chain !== 'base') throw new Error(`Epoch ${epochId} is not a Base epoch`);
    if (epoch.status === 'PAID') throw new Error(`Epoch ${epochId} already distributed`);

    const allocations = await this.calculateAgentAllocations(epochId);

    const totalAmount = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    const balance = await this.getBalance();
    if (balance < totalAmount) {
      throw new Error(`Insufficient Base treasury balance: ${balance} USDC < ${totalAmount} USDC needed`);
    }

    const results: BaseDistributionResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const alloc of allocations) {
      try {
        // Surge API does not support direct ERC-20 transfers. Use on-chain transfer instead.
        throw new Error('Surge API does not support direct ERC-20 transfers. Use on-chain transfer instead.');
      } catch (error: any) {
        console.error(`[BASE] Failed to distribute to ${alloc.agentName}:`, error);

        await prisma.treasuryAllocation.create({
          data: {
            epochId,
            tradingAgentId: alloc.agentId,
            amount: alloc.usdcAmount,
            performanceScore: alloc.sortinoRatio,
            rank: alloc.rank,
            chain: 'BASE',
            status: 'failed',
          },
        });

        results.push({
          agentId: alloc.agentId,
          agentName: alloc.agentName,
          amount: alloc.usdcAmount,
          txHash: '',
          status: 'failed',
          error: error.message,
          basescan: '',
        });

        failed++;
      }
    }

    await prisma.scannerEpoch.update({
      where: { id: epochId },
      data: { status: failed === 0 ? 'PAID' : 'ACTIVE' },
    });

    return {
      allocations: results,
      summary: { totalAmount, successful, failed, timestamp: new Date().toISOString() },
    };
  }

  /**
   * Get treasury status for Base
   */
  async getTreasuryStatus() {
    let balance = 0;
    try {
      balance = await this.getBalance();
    } catch {
      // Treasury wallet not configured
    }

    const allocations = await prisma.treasuryAllocation.aggregate({
      where: { status: 'pending', chain: 'BASE' },
      _sum: { amount: true },
    });

    const distributed = await prisma.treasuryAllocation.aggregate({
      where: { status: 'completed', chain: 'BASE' },
      _sum: { amount: true },
    });

    const allocated = Number(allocations._sum?.amount || 0);
    const totalDistributed = Number(distributed._sum?.amount || 0);

    return {
      chain: 'base',
      totalBalance: Math.round(balance * 100) / 100,
      allocated: Math.round(allocated * 100) / 100,
      distributed: Math.round(totalDistributed * 100) / 100,
      available: Math.round((balance - allocated) * 100) / 100,
      treasuryWalletId: this.treasuryWalletId,
    };
  }
}

export const treasuryManagerBase = new TreasuryManagerBaseService();
