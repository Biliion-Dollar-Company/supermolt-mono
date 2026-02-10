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
import { db as prisma } from '../lib/db';

export class UnifiedTreasuryService {
  /**
   * Get balance for a specific chain
   */
  async getBalance(chain: 'solana' | 'bsc'): Promise<number> {
    if (chain === 'solana') {
      return treasuryManagerSolana.getBalance();
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

    if (epoch.chain === 'bsc') {
      return treasuryManagerBSC.calculateAgentAllocations(epochId);
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

    if (epoch.chain === 'bsc') {
      return treasuryManagerBSC.distributeAgentRewards(epochId);
    } else {
      return treasuryManagerSolana.distributeAgentRewards(epochId);
    }
  }

  /**
   * Get treasury status for all chains
   */
  async getAllTreasuryStatus() {
    const [solanaStatus, bscStatus] = await Promise.all([
      treasuryManagerSolana.getTreasuryStatus(),
      treasuryManagerBSC.getTreasuryStatus(),
    ]);

    return {
      solana: solanaStatus,
      bsc: bscStatus,
      total: {
        balance: solanaStatus.totalBalance + bscStatus.totalBalance,
        distributed: solanaStatus.distributed + bscStatus.distributed,
      },
    };
  }

  /**
   * Get treasury status for a specific chain
   */
  async getTreasuryStatus(chain: 'solana' | 'bsc') {
    if (chain === 'solana') {
      return treasuryManagerSolana.getTreasuryStatus();
    } else {
      return treasuryManagerBSC.getTreasuryStatus();
    }
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
      orderBy: { chain: 'asc' },
    });

    return {
      solana: epochs.filter(e => e.chain === 'solana'),
      bsc: epochs.filter(e => e.chain === 'bsc'),
    };
  }
}

// Export singleton instance
export const unifiedTreasuryService = new UnifiedTreasuryService();
