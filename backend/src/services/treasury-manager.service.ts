/**
 * Treasury Manager Service
 * 
 * Manages USDC treasury wallet and reward distribution to scanner agents
 * 
 * Features:
 * - USDC balance tracking
 * - Allocation calculation (rank-based multipliers)
 * - On-chain USDC distribution via Solana
 * - Transaction logging and proof tracking
 * 
 * Created: February 5, 2026
 * By: Backend Infrastructure Agent
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { db as prisma } from '../lib/db';
import { keyManager } from './key-manager.service';

// USDC Token Mint (Devnet for hackathon)
const USDC_MINT = new PublicKey(process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_DECIMALS = 6; // USDC has 6 decimals

// Rank multipliers (based on leaderboard position)
const RANK_MULTIPLIERS: { [key: number]: number } = {
  1: 2.0,   // 1st place: 2x
  2: 1.5,   // 2nd place: 1.5x
  3: 1.0,   // 3rd place: 1x
  4: 0.75,  // 4th place: 0.75x
  5: 0.5,   // 5th place: 0.5x
};

interface AllocationResult {
  scannerId: string;
  scannerName: string;
  pubkey: string;
  rank: number;
  performanceScore: number;
  winRate: number;
  totalCalls: number;
  usdcAmount: number;
  multiplier: number;
}

interface DistributionResult {
  scannerId: string;
  scannerName: string;
  amount: number;
  signature: string;
  status: 'success' | 'failed';
  error?: string;
  solscan: string;
}

// ── TradingAgent reward types ──

export interface AgentAllocationResult {
  agentId: string;
  agentName: string;
  walletAddress: string;
  avatarUrl?: string;
  twitterHandle?: string;
  rank: number;
  tradeCount: number;
  sortinoRatio: number;
  winRate: number;
  usdcAmount: number;
  multiplier: number;
}

export interface AgentDistributionResult {
  agentId: string;
  agentName: string;
  amount: number;
  signature: string;
  status: 'success' | 'failed';
  error?: string;
  solscan: string;
}

export class TreasuryManagerService {
  private connection: Connection;
  private treasuryKeypair: Keypair | null = null;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.loadTreasuryWallet();
  }

  /**
   * Load treasury wallet from environment variable via keyManager.
   * Supports base58-encoded Solana private keys.
   */
  private loadTreasuryWallet() {
    const keypair = keyManager.getSolanaKeypair('TREASURY_PRIVATE_KEY', 'treasury-manager');

    if (!keypair) {
      console.warn('⚠️ TREASURY_PRIVATE_KEY not set - distribution will fail');
      return;
    }

    this.treasuryKeypair = keypair;
    console.log('✅ Treasury wallet loaded:', this.treasuryKeypair.publicKey.toBase58());
  }

  /**
   * Get treasury wallet public key
   */
  getTreasuryPublicKey(): string | null {
    return this.treasuryKeypair?.publicKey.toBase58() || null;
  }

  /**
   * Get USDC balance of treasury wallet
   */
  async getBalance(): Promise<number> {
    if (!this.treasuryKeypair) {
      throw new Error('Treasury wallet not loaded');
    }

    try {
      const tokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        this.treasuryKeypair.publicKey
      );

      const accountInfo = await getAccount(this.connection, tokenAccount);
      const balance = Number(accountInfo.amount) / Math.pow(10, USDC_DECIMALS);

      return balance;
    } catch (error: any) {
      // If account doesn't exist, balance is 0
      if (error.message.includes('could not find account')) {
        return 0;
      }
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  /**
   * Calculate USDC allocations for an epoch
   */
  async calculateAllocations(epochId: string): Promise<AllocationResult[]> {
    // Get epoch details
    const epoch = await prisma.scannerEpoch.findUnique({
      where: { id: epochId },
      include: {
        rankings: {
          include: {
            scanner: true,
          },
          orderBy: {
            performanceScore: 'desc',
          },
        },
      },
    });

    if (!epoch) {
      throw new Error(`Epoch ${epochId} not found`);
    }

    if (epoch.rankings.length === 0) {
      throw new Error(`No rankings found for epoch ${epochId}`);
    }

    const baseAllocation = Number(epoch.baseAllocation) || 200;
    const allocations: AllocationResult[] = [];

    // Calculate allocations for each scanner
    for (let i = 0; i < epoch.rankings.length; i++) {
      const ranking = epoch.rankings[i];
      const rank = i + 1;
      const multiplier = RANK_MULTIPLIERS[rank] || 0.5;

      // Performance adjustment (0.5 - 1.0)
      // Lower bound ensures even poor performers get something
      const performanceScore = Number(ranking.performanceScore);
      const performanceAdjustment = Math.max(0.5, performanceScore / 100);

      // Final USDC amount
      const usdcAmount = baseAllocation * multiplier * performanceAdjustment;

      allocations.push({
        scannerId: ranking.scannerId,
        scannerName: ranking.scanner.name,
        pubkey: ranking.scanner.pubkey,
        rank,
        performanceScore,
        winRate: Number(ranking.winRate),
        totalCalls: ranking.totalCalls,
        usdcAmount: Math.round(usdcAmount * 100) / 100, // Round to 2 decimals
        multiplier,
      });
    }

    return allocations;
  }

  /**
   * Execute USDC distribution to scanners
   */
  async distributeRewards(epochId: string): Promise<{
    allocations: DistributionResult[];
    summary: {
      totalAmount: number;
      successful: number;
      failed: number;
      timestamp: string;
    };
  }> {
    if (!this.treasuryKeypair) {
      throw new Error('Treasury wallet not loaded');
    }

    // Check if epoch already distributed
    const epoch = await prisma.scannerEpoch.findUnique({
      where: { id: epochId },
    });

    if (!epoch) {
      throw new Error(`Epoch ${epochId} not found`);
    }

    if (epoch.status === 'PAID') {
      throw new Error(`Epoch ${epochId} already distributed`);
    }

    // Calculate allocations
    const allocations = await this.calculateAllocations(epochId);

    // Check treasury balance
    const totalAmount = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    const balance = await this.getBalance();

    if (balance < totalAmount) {
      throw new Error(
        `Insufficient treasury balance: ${balance} USDC < ${totalAmount} USDC needed`
      );
    }

    // Execute distributions
    const results: DistributionResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const allocation of allocations) {
      try {
        const signature = await this.sendUSDC(
          allocation.pubkey,
          allocation.usdcAmount
        );

        // Record in database
        await prisma.treasuryAllocation.create({
          data: {
            epochId,
            scannerId: allocation.scannerId,
            amount: allocation.usdcAmount,
            performanceScore: allocation.performanceScore,
            rank: allocation.rank,
            txSignature: signature,
            status: 'completed',
            completedAt: new Date(),
          },
        });

        // Update scanner ranking
        await prisma.scannerRanking.update({
          where: {
            scannerId_epochId: {
              scannerId: allocation.scannerId,
              epochId,
            },
          },
          data: {
            usdcAllocated: allocation.usdcAmount,
            finalRank: allocation.rank,
          },
        });

        results.push({
          scannerId: allocation.scannerId,
          scannerName: allocation.scannerName,
          amount: allocation.usdcAmount,
          signature,
          status: 'success',
          solscan: `https://solscan.io/tx/${signature}`,
        });

        successful++;
        console.log(
          `✅ Distributed ${allocation.usdcAmount} USDC to ${allocation.scannerName} (${signature})`
        );
      } catch (error: any) {
        console.error(
          `❌ Failed to distribute to ${allocation.scannerName}:`,
          error
        );

        // Record failed allocation
        await prisma.treasuryAllocation.create({
          data: {
            epochId,
            scannerId: allocation.scannerId,
            amount: allocation.usdcAmount,
            performanceScore: allocation.performanceScore,
            rank: allocation.rank,
            status: 'failed',
          },
        });

        results.push({
          scannerId: allocation.scannerId,
          scannerName: allocation.scannerName,
          amount: allocation.usdcAmount,
          signature: '',
          status: 'failed',
          error: error.message,
          solscan: '',
        });

        failed++;
      }
    }

    // Update epoch status
    await prisma.scannerEpoch.update({
      where: { id: epochId },
      data: {
        status: failed === 0 ? 'PAID' : 'ACTIVE', // Only mark as PAID if all succeeded
      },
    });

    return {
      allocations: results,
      summary: {
        totalAmount,
        successful,
        failed,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Send USDC to a recipient
   */
  private async sendUSDC(recipientPubkey: string, amount: number): Promise<string> {
    if (!this.treasuryKeypair) {
      throw new Error('Treasury wallet not loaded');
    }

    const recipient = new PublicKey(recipientPubkey);

    // Get associated token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      this.treasuryKeypair.publicKey
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      recipient
    );

    // Convert USDC amount to smallest unit (6 decimals)
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, USDC_DECIMALS));

    const transaction = new Transaction();

    // Check if recipient token account exists, create if not
    try {
      await getAccount(this.connection, recipientTokenAccount);
    } catch {
      // Account doesn't exist, add instruction to create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          this.treasuryKeypair.publicKey, // payer
          recipientTokenAccount,
          recipient,
          USDC_MINT
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        this.treasuryKeypair.publicKey,
        amountInSmallestUnit
      )
    );

    // Send and confirm transaction
    const signature = await this.connection.sendTransaction(
      transaction,
      [this.treasuryKeypair],
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      }
    );

    // Wait for confirmation
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  // ── TradingAgent Reward Distribution ─────────────────────

  /**
   * Calculate USDC allocations for TradingAgents in an epoch.
   * Ranks by trade_count DESC → sortino DESC → winRate DESC.
   */
  async calculateAgentAllocations(epochId: string): Promise<AgentAllocationResult[]> {
    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);

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
    const allocations: AgentAllocationResult[] = [];

    let totalRaw = 0;

    // First pass: calculate raw amounts
    const rawAmounts: number[] = [];
    for (let i = 0; i < rankedAgents.length; i++) {
      const rank = i + 1;
      const multiplier = RANK_MULTIPLIERS[rank] || 0.5;
      // Performance adjustment based on trade activity (0.5–1.0)
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
        walletAddress: agent.userId,
        avatarUrl: agent.avatarUrl ?? undefined,
        twitterHandle: agent.twitterHandle ?? undefined,
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
   * Execute USDC distribution to TradingAgents for an epoch.
   * Sends real on-chain USDC transfers and records TreasuryAllocation rows.
   */
  async distributeAgentRewards(epochId: string): Promise<{
    allocations: AgentDistributionResult[];
    summary: { totalAmount: number; successful: number; failed: number; timestamp: string };
  }> {
    if (!this.treasuryKeypair) throw new Error('Treasury wallet not loaded');

    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.status === 'PAID') throw new Error(`Epoch ${epochId} already distributed`);

    const allocations = await this.calculateAgentAllocations(epochId);

    const totalAmount = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    const balance = await this.getBalance();
    if (balance < totalAmount) {
      throw new Error(`Insufficient treasury balance: ${balance} USDC < ${totalAmount} USDC needed`);
    }

    const results: AgentDistributionResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const alloc of allocations) {
      try {
        const signature = await this.sendUSDC(alloc.walletAddress, alloc.usdcAmount);

        await prisma.treasuryAllocation.create({
          data: {
            epochId,
            tradingAgentId: alloc.agentId,
            amount: alloc.usdcAmount,
            performanceScore: alloc.sortinoRatio,
            rank: alloc.rank,
            txSignature: signature,
            status: 'completed',
            completedAt: new Date(),
          },
        });

        results.push({
          agentId: alloc.agentId,
          agentName: alloc.agentName,
          amount: alloc.usdcAmount,
          signature,
          status: 'success',
          solscan: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        });

        successful++;
        console.log(`✅ Distributed ${alloc.usdcAmount} USDC to ${alloc.agentName} (${signature})`);
      } catch (error: any) {
        console.error(`❌ Failed to distribute to ${alloc.agentName}:`, error);

        await prisma.treasuryAllocation.create({
          data: {
            epochId,
            tradingAgentId: alloc.agentId,
            amount: alloc.usdcAmount,
            performanceScore: alloc.sortinoRatio,
            rank: alloc.rank,
            status: 'failed',
          },
        });

        results.push({
          agentId: alloc.agentId,
          agentName: alloc.agentName,
          amount: alloc.usdcAmount,
          signature: '',
          status: 'failed',
          error: error.message,
          solscan: '',
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
   * Get allocation history for a scanner
   */
  async getScannerAllocations(scannerId: string) {
    const allocations = await prisma.treasuryAllocation.findMany({
      where: { scannerId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Lookup epoch names separately (no relation defined)
    const epochIds = [...new Set(allocations.map((a) => a.epochId))];
    const epochs = epochIds.length > 0
      ? await prisma.scannerEpoch.findMany({ where: { id: { in: epochIds } }, select: { id: true, name: true } })
      : [];
    const epochNameMap = new Map(epochs.map((e) => [e.id, e.name]));

    const totalEarned = allocations
      .filter((a) => a.status === 'completed')
      .reduce((sum, a) => sum + Number(a.amount), 0);

    return {
      allocations: allocations.map((a) => ({
        epochId: a.epochId,
        epochName: epochNameMap.get(a.epochId) || 'Unknown',
        amount: Number(a.amount),
        rank: a.rank,
        txSignature: a.txSignature,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        solscan: a.txSignature
          ? `https://solscan.io/tx/${a.txSignature}`
          : null,
      })),
      totalEarned: Math.round(totalEarned * 100) / 100,
    };
  }

  /**
   * Get treasury pool status
   */
  async getTreasuryStatus() {
    const balance = await this.getBalance();

    // Get total allocated but not distributed
    const allocations = await prisma.treasuryAllocation.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
    });

    // Get total distributed
    const distributed = await prisma.treasuryAllocation.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    });

    const allocated = Number(allocations._sum.amount || 0);
    const totalDistributed = Number(distributed._sum.amount || 0);

    return {
      totalBalance: Math.round(balance * 100) / 100,
      allocated: Math.round(allocated * 100) / 100,
      distributed: Math.round(totalDistributed * 100) / 100,
      available: Math.round((balance - allocated) * 100) / 100,
      treasuryWallet: this.getTreasuryPublicKey(),
    };
  }
}

// Export singleton instance
export const treasuryManager = new TreasuryManagerService();
