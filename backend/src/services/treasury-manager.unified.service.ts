/**
 * Unified Treasury Manager Service
 * 
 * Routes treasury operations to the correct chain (Solana or BSC)
 * based on the epoch's chain field
 * 
 * Created: February 10, 2026
 * By: Orion
 */

import { treasuryManager as treasuryManagerSolana } from './treasury-manager.service';
import { treasuryManagerBSC } from './treasury-manager-bsc.service';
import { treasuryManagerBase } from './treasury-manager-base.service';
import { Chain } from '@prisma/client';
import { circleGateway, type DistributionSummary, type RewardRecipient } from './circle-gateway.service';
import { complianceGateway, type GateTransferResult } from './compliance/gateway.service';
import { db as prisma } from '../lib/db';

export class UnifiedTreasuryService {
  /**
   * Get balance for a specific chain
   */
  async getBalance(chain: 'solana' | 'bsc' | 'base'): Promise<number> {
    if (chain === 'solana') {
      return treasuryManagerSolana.getBalance();
    } else if (chain === 'base') {
      return treasuryManagerBase.getBalance();
    } else {
      return treasuryManagerBSC.getBalance();
    }
  }

  /**
   * Calculate agent allocations for an epoch (auto-detects chain)
   */
  async calculateAgentAllocations(epochId: string) {
    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);

    if ((epoch as any).chain === 'bsc') {
      return treasuryManagerBSC.calculateAgentAllocations(epochId);
    } else if ((epoch as any).chain === 'base') {
      return treasuryManagerBase.calculateAgentAllocations(epochId);
    } else {
      return treasuryManagerSolana.calculateAgentAllocations(epochId);
    }
  }

  /**
   * Distribute agent rewards for an epoch (auto-detects chain)
   */
  async distributeAgentRewards(epochId: string) {
    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);

    if ((epoch as any).chain === 'bsc') {
      return treasuryManagerBSC.distributeAgentRewards(epochId);
    } else if ((epoch as any).chain === 'base') {
      return treasuryManagerBase.distributeAgentRewards(epochId);
    } else {
      return treasuryManagerSolana.distributeAgentRewards(epochId);
    }
  }

  /**
   * Get treasury status for all chains
   */
  async getAllTreasuryStatus() {
    const [solanaStatus, bscStatus, baseStatus] = await Promise.all([
      treasuryManagerSolana.getTreasuryStatus(),
      treasuryManagerBSC.getTreasuryStatus(),
      treasuryManagerBase.getTreasuryStatus(),
    ]);

    return {
      solana: solanaStatus,
      bsc: bscStatus,
      base: baseStatus,
      total: {
        balance: solanaStatus.totalBalance + bscStatus.totalBalance + baseStatus.totalBalance,
        distributed: solanaStatus.distributed + bscStatus.distributed + baseStatus.distributed,
      },
    };
  }

  /**
   * Get treasury status for a specific chain
   */
  async getTreasuryStatus(chain: 'solana' | 'bsc' | 'base') {
    if (chain === 'solana') {
      return treasuryManagerSolana.getTreasuryStatus();
    } else if (chain === 'base') {
      return treasuryManagerBase.getTreasuryStatus();
    } else {
      return treasuryManagerBSC.getTreasuryStatus();
    }
  }

  /**
   * Distribute epoch rewards through Circle Gateway (cross-chain USDC).
   *
   * Fetches active TradingAgents for the epoch, maps them to RewardRecipient
   * objects, and delegates to circleGateway.distributeRewards(). Results are
   * persisted back to the DB and the epoch is marked PAID on full success.
   *
   * Falls back gracefully to the legacy chain-specific managers when Circle
   * Gateway environment variables are not configured.
   *
   * @param epochId - ID of the ScannerEpoch to pay out
   */
  async distributeViaGateway(epochId: string): Promise<DistributionSummary> {
    // Graceful fallback: if gateway isn't configured, route to legacy managers
    if (!circleGateway.isConfigured()) {
      throw new Error(
        '[UnifiedTreasury] Circle Gateway not configured — set CIRCLE_GATEWAY_API_KEY ' +
          'or CIRCLE_GATEWAY_MOCK=true, then retry. Alternatively use distributeAgentRewards().',
      );
    }

    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.status === 'PAID') throw new Error(`Epoch ${epochId} already distributed`);

    // Load active agents for this epoch's chain
    const chainFilter = (epoch as Record<string, unknown>).chain as string | undefined;
    const agentChainStr = (chainFilter?.toUpperCase() ?? 'SOLANA') as keyof typeof Chain;
    const agentChain: Chain = Chain[agentChainStr] ?? Chain.SOLANA;

    const agents = await prisma.tradingAgent.findMany({
      where: { status: 'ACTIVE', chain: agentChain },
    });

    if (agents.length === 0) {
      throw new Error(`No active ${agentChain} agents found for epoch ${epochId}`);
    }

    // Build recipient list — rank by totalTrades DESC (simple heuristic)
    const sorted = [...agents].sort((a, b) => (b.totalTrades ?? 0) - (a.totalTrades ?? 0));
    const usdcPool = Number(epoch.usdcPool) || 0;
    const perAgent = sorted.length > 0 ? Math.floor((usdcPool / sorted.length) * 100) / 100 : 0;

    const RANK_MULTIPLIERS: Record<number, number> = { 1: 2.0, 2: 1.5, 3: 1.0, 4: 0.75, 5: 0.5 };

    // Normalise destination chain: all EVMs without explicit mapping default to "ethereum"
    function toGatewayChain(agentChainValue: string): RewardRecipient['destinationChain'] {
      const c = agentChainValue.toLowerCase();
      if (c === 'solana') return 'solana';
      if (c === 'base') return 'base';
      if (c === 'polygon') return 'polygon';
      return 'ethereum';
    }

    const recipients: RewardRecipient[] = sorted.map((agent, idx) => {
      const rank = idx + 1;
      const multiplier = RANK_MULTIPLIERS[rank] ?? 0.5;
      return {
        agentId: agent.id,
        agentName: agent.displayName ?? agent.name,
        walletAddress: agent.evmAddress ?? agent.userId,
        destinationChain: toGatewayChain(agentChain),
        amount: Math.round(perAgent * multiplier * 100) / 100,
        rank,
      };
    });

    const summary = await circleGateway.distributeRewards(recipients);
    // Override epochId so callers get back the real ID, not the gateway's auto-generated one
    (summary as unknown as Record<string, unknown>).epochId = epochId;

    // Persist results to DB
    for (const r of summary.recipients) {
      await prisma.treasuryAllocation.create({
        data: {
          epochId,
          tradingAgentId: r.agentId,
          amount: r.amount,
          performanceScore: 0,
          rank: r.rank,
          chain: agentChain as Chain,
          status: r.result.status === 'completed' ? 'completed' : 'failed',
        },
      });
    }

    // Mark epoch PAID when fully successful
    if (summary.status === 'completed') {
      await prisma.scannerEpoch.update({
        where: { id: epochId },
        data: { status: 'PAID' },
      });
    }

    return summary;
  }

  /**
   * Compliance-gated distribution via Circle Gateway.
   *
   * Same as distributeViaGateway but runs every recipient through the
   * compliance pipeline (KYC → AML → KYT → Travel Rule) before transfer.
   * Blocked recipients are skipped; flagged recipients proceed with logging.
   */
  async distributeViaGatewayCompliant(epochId: string): Promise<DistributionSummary & { complianceResults: GateTransferResult[] }> {
    if (!circleGateway.isConfigured()) {
      throw new Error(
        '[UnifiedTreasury] Circle Gateway not configured — set CIRCLE_GATEWAY_API_KEY ' +
          'or CIRCLE_GATEWAY_MOCK=true, then retry.',
      );
    }

    const epoch = await prisma.scannerEpoch.findUnique({ where: { id: epochId } });
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.status === 'PAID') throw new Error(`Epoch ${epochId} already distributed`);

    const chainFilter = (epoch as Record<string, unknown>).chain as string | undefined;
    const agentChainStr = (chainFilter?.toUpperCase() ?? 'SOLANA') as keyof typeof Chain;
    const agentChain: Chain = Chain[agentChainStr] ?? Chain.SOLANA;

    const agents = await prisma.tradingAgent.findMany({
      where: { status: 'ACTIVE', chain: agentChain },
    });

    if (agents.length === 0) {
      throw new Error(`No active ${agentChain} agents found for epoch ${epochId}`);
    }

    const sorted = [...agents].sort((a, b) => (b.totalTrades ?? 0) - (a.totalTrades ?? 0));
    const usdcPool = Number(epoch.usdcPool) || 0;
    const perAgent = sorted.length > 0 ? Math.floor((usdcPool / sorted.length) * 100) / 100 : 0;
    const RANK_MULTIPLIERS: Record<number, number> = { 1: 2.0, 2: 1.5, 3: 1.0, 4: 0.75, 5: 0.5 };

    function toGatewayChain(v: string): RewardRecipient['destinationChain'] {
      const c = v.toLowerCase();
      if (c === 'solana') return 'solana';
      if (c === 'base') return 'base';
      if (c === 'polygon') return 'polygon';
      return 'ethereum';
    }

    // Build recipients and run compliance checks
    const allRecipients: RewardRecipient[] = sorted.map((agent, idx) => {
      const rank = idx + 1;
      const multiplier = RANK_MULTIPLIERS[rank] ?? 0.5;
      return {
        agentId: agent.id,
        agentName: agent.displayName ?? agent.name,
        walletAddress: agent.evmAddress ?? agent.userId,
        destinationChain: toGatewayChain(agentChain),
        amount: Math.round(perAgent * multiplier * 100) / 100,
        rank,
      };
    });

    // Run compliance pipeline for each recipient
    const complianceResults: GateTransferResult[] = [];
    const approvedRecipients: RewardRecipient[] = [];

    for (const recipient of allRecipients) {
      const result = await complianceGateway.gateTransfer({
        agentId: recipient.agentId,
        agentName: recipient.agentName,
        walletAddress: recipient.walletAddress,
        chain: agentChain.toLowerCase(),
        amount: recipient.amount,
        destinationChain: recipient.destinationChain,
      });

      complianceResults.push(result);

      if (result.action !== 'BLOCKED') {
        approvedRecipients.push(recipient);
      } else {
        console.log(`[Compliance] BLOCKED ${recipient.agentName} (${recipient.walletAddress}): ${result.reason}`);
      }
    }

    if (approvedRecipients.length === 0) {
      throw new Error(`All ${allRecipients.length} recipients blocked by compliance — no distribution possible`);
    }

    // Distribute only to approved recipients
    const summary = await circleGateway.distributeRewards(approvedRecipients);
    (summary as unknown as Record<string, unknown>).epochId = epochId;

    // Persist results
    for (const r of summary.recipients) {
      await prisma.treasuryAllocation.create({
        data: {
          epochId,
          tradingAgentId: r.agentId,
          amount: r.amount,
          performanceScore: 0,
          rank: r.rank,
          chain: agentChain as Chain,
          status: r.result.status === 'completed' ? 'completed' : 'failed',
        },
      });
    }

    if (summary.status === 'completed') {
      await prisma.scannerEpoch.update({
        where: { id: epochId },
        data: { status: 'PAID' },
      });
    }

    return { ...summary, complianceResults };
  }

  /**
   * Get active epochs for all chains
   */
  async getActiveEpochs() {
    const now = new Date();
    
    const epochs = await prisma.scannerEpoch.findMany({
      where: {
        startAt: { lte: now },
        endAt: { gte: now },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      solana: epochs.filter((e) => (e as any).chain === 'solana'),
      bsc: epochs.filter((e) => (e as any).chain === 'bsc'),
      base: epochs.filter((e) => (e as any).chain === 'base'),
    };
  }
}

// Export singleton instance
export const unifiedTreasuryService = new UnifiedTreasuryService();
