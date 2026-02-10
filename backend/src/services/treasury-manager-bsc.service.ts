/**
 * Treasury Manager Service - BSC (Binance Smart Chain)
 * 
 * Manages USDC treasury wallet and reward distribution on BSC
 * 
 * Features:
 * - USDC balance tracking on BSC
 * - Allocation calculation (rank-based multipliers)
 * - On-chain USDC distribution via BSC
 * - Transaction logging and proof tracking
 * 
 * Created: February 10, 2026
 * By: Orion
 */

import { ethers, Wallet, JsonRpcProvider } from 'ethers';
import { db as prisma } from '../lib/db';

// USDC Token Contract on BSC Mainnet
const USDC_CONTRACT_ADDRESS = process.env.BSC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const USDC_DECIMALS = 18; // USDC on BSC has 18 decimals (binance-pegged USDC)

// ERC20 ABI (minimal for USDC transfers)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Rank multipliers (same as Solana)
const RANK_MULTIPLIERS: { [key: number]: number } = {
  1: 2.0,   // 1st place: 2x
  2: 1.5,   // 2nd place: 1.5x
  3: 1.0,   // 3rd place: 1x
  4: 0.75,  // 4th place: 0.75x
  5: 0.5,   // 5th place: 0.5x
};

export interface BSCAllocationResult {
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

export interface BSCDistributionResult {
  agentId: string;
  agentName: string;
  amount: number;
  txHash: string;
  status: 'success' | 'failed';
  error?: string;
  bscscan: string;
}

export class TreasuryManagerBSCService {
  private provider: JsonRpcProvider;
  private wallet: Wallet | null = null;
  private usdcContract: ethers.Contract | null = null;

  constructor() {
    const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
    this.provider = new JsonRpcProvider(rpcUrl);
    this.loadTreasuryWallet();
  }

  /**
   * Load treasury wallet from environment variable
   */
  private loadTreasuryWallet() {
    const privateKey = process.env.BSC_TREASURY_PRIVATE_KEY;

    if (!privateKey) {
      console.warn('⚠️ BSC_TREASURY_PRIVATE_KEY not set - distribution will fail');
      return;
    }

    try {
      this.wallet = new Wallet(privateKey, this.provider);
      this.usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, this.wallet);
      console.log('✅ BSC Treasury wallet loaded:', this.wallet.address);
    } catch (error) {
      console.error('❌ Failed to load BSC treasury wallet:', error);
      throw new Error('Invalid BSC_TREASURY_PRIVATE_KEY format');
    }
  }

  /**
   * Get treasury wallet address
   */
  getTreasuryAddress(): string | null {
    return this.wallet?.address || null;
  }

  /**
   * Get USDC balance of treasury wallet on BSC
   */
  async getBalance(): Promise<number> {
    if (!this.wallet || !this.usdcContract) {
      throw new Error('BSC Treasury wallet not loaded');
    }

    try {
      const balance = await this.usdcContract.balanceOf(this.wallet.address);
      return Number(ethers.formatUnits(balance, USDC_DECIMALS));
    } catch (error) {
      console.error('Error fetching BSC balance:', error);
      throw error;
    }
  }

  /**
   * Calculate USDC allocations for TradingAgents in a BSC epoch.
   * Ranks by trade_count DESC → sortino DESC → winRate DESC.
   */
  async calculateAgentAllocations(epochId: string): Promise<BSCAllocationResult[]> {
    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.chain !== 'bsc') throw new Error(`Epoch ${epochId} is not a BSC epoch`);

    // Get all active TradingAgents
    const agents = await prisma.tradingAgent.findMany({
      where: { status: 'ACTIVE' },
    });

    if (agents.length === 0) throw new Error('No active TradingAgents found');

    const agentIds = agents.map((a) => a.id);

    // Get AgentStats for sortino ratios + trade counts
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

    // Build sortable agent list
    const rankedAgents = agents.map((agent) => {
      const agentStats = statsMap.get(agent.id);
      const tradeCount = tradeCountMap.get(agent.id) || agent.totalTrades;
      const sortinoRatio = agentStats ? Number(agentStats.sortinoRatio) : 0;
      const winRate = Number(agent.winRate);
      return { agent, tradeCount, sortinoRatio, winRate };
    });

    // Sort: trade_count DESC → sortino DESC → winRate DESC
    rankedAgents.sort((a, b) => {
      if (b.tradeCount !== a.tradeCount) return b.tradeCount - a.tradeCount;
      if (b.sortinoRatio !== a.sortinoRatio) return b.sortinoRatio - a.sortinoRatio;
      return b.winRate - a.winRate;
    });

    const baseAllocation = Number(epoch.baseAllocation) || 200;
    const usdcPool = Number(epoch.usdcPool);
    const allocations: BSCAllocationResult[] = [];

    let totalRaw = 0;

    // First pass: calculate raw amounts
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

    // Scale to fit within usdcPool
    const scaleFactor = totalRaw > usdcPool ? usdcPool / totalRaw : 1;

    for (let i = 0; i < rankedAgents.length; i++) {
      const { agent, tradeCount, sortinoRatio, winRate } = rankedAgents[i];
      const rank = i + 1;
      const multiplier = RANK_MULTIPLIERS[rank] || 0.5;
      const usdcAmount = Math.round(rawAmounts[i] * scaleFactor * 100) / 100;

      allocations.push({
        agentId: agent.id,
        agentName: agent.displayName || agent.name,
        walletAddress: agent.userId, // Assuming userId stores the EVM wallet address
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
   * Execute USDC distribution to TradingAgents for a BSC epoch.
   * Sends real on-chain USDC transfers via BSC and records TreasuryAllocation rows.
   */
  async distributeAgentRewards(epochId: string): Promise<{
    allocations: BSCDistributionResult[];
    summary: { totalAmount: number; successful: number; failed: number; timestamp: string };
  }> {
    if (!this.wallet || !this.usdcContract) throw new Error('BSC Treasury wallet not loaded');

    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.chain !== 'bsc') throw new Error(`Epoch ${epochId} is not a BSC epoch`);
    if (epoch.status === 'PAID') throw new Error(`Epoch ${epochId} already distributed`);

    const allocations = await this.calculateAgentAllocations(epochId);

    const totalAmount = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    const balance = await this.getBalance();
    if (balance < totalAmount) {
      throw new Error(`Insufficient BSC treasury balance: ${balance} USDC < ${totalAmount} USDC needed`);
    }

    const results: BSCDistributionResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const alloc of allocations) {
      try {
        const txHash = await this.sendUSDC(alloc.walletAddress, alloc.usdcAmount);

        await prisma.treasuryAllocation.create({
          data: {
            epochId,
            tradingAgentId: alloc.agentId,
            amount: alloc.usdcAmount,
            performanceScore: alloc.sortinoRatio,
            rank: alloc.rank,
            txHash,
            chain: 'bsc',
            status: 'completed',
            completedAt: new Date(),
          },
        });

        results.push({
          agentId: alloc.agentId,
          agentName: alloc.agentName,
          amount: alloc.usdcAmount,
          txHash,
          status: 'success',
          bscscan: `https://bscscan.com/tx/${txHash}`,
        });

        successful++;
        console.log(`✅ [BSC] Distributed ${alloc.usdcAmount} USDC to ${alloc.agentName} (${txHash})`);
      } catch (error: any) {
        console.error(`❌ [BSC] Failed to distribute to ${alloc.agentName}:`, error);

        await prisma.treasuryAllocation.create({
          data: {
            epochId,
            tradingAgentId: alloc.agentId,
            amount: alloc.usdcAmount,
            performanceScore: alloc.sortinoRatio,
            rank: alloc.rank,
            chain: 'bsc',
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
          bscscan: '',
        });

        failed++;
      }
    }

    // Update epoch status
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
   * Send USDC to a recipient on BSC
   */
  private async sendUSDC(recipientAddress: string, amount: number): Promise<string> {
    if (!this.wallet || !this.usdcContract) {
      throw new Error('BSC Treasury wallet not loaded');
    }

    // Convert USDC amount to smallest unit (18 decimals)
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), USDC_DECIMALS);

    // Execute transfer
    const tx = await this.usdcContract.transfer(recipientAddress, amountInSmallestUnit);

    // Wait for confirmation
    const receipt = await tx.wait();

    return receipt.hash;
  }

  /**
   * Get treasury status for BSC
   */
  async getTreasuryStatus() {
    const balance = await this.getBalance();

    // Get total allocated but not distributed (BSC only)
    const allocations = await prisma.treasuryAllocation.aggregate({
      where: { status: 'pending', chain: 'bsc' },
      _sum: { amount: true },
    });

    // Get total distributed (BSC only)
    const distributed = await prisma.treasuryAllocation.aggregate({
      where: { status: 'completed', chain: 'bsc' },
      _sum: { amount: true },
    });

    const allocated = Number(allocations._sum.amount || 0);
    const totalDistributed = Number(distributed._sum.amount || 0);

    return {
      chain: 'bsc',
      totalBalance: Math.round(balance * 100) / 100,
      allocated: Math.round(allocated * 100) / 100,
      distributed: Math.round(totalDistributed * 100) / 100,
      available: Math.round((balance - allocated) * 100) / 100,
      treasuryWallet: this.getTreasuryAddress(),
    };
  }
}

// Export singleton instance
export const treasuryManagerBSC = new TreasuryManagerBSCService();
