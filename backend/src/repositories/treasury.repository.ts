/**
 * Treasury Repository
 * 
 * Handles all Prisma queries for TreasuryPool and TreasuryAllocation models
 */

import { PrismaClient, TreasuryPool, TreasuryAllocation } from '@prisma/client';

export class TreasuryRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get treasury pool (should only be one)
   */
  async getPool(): Promise<TreasuryPool | null> {
    return this.prisma.treasuryPool.findFirst();
  }

  /**
   * Create treasury pool
   */
  async createPool(data: {
    totalBalance: number;
    treasuryWallet: string;
  }): Promise<TreasuryPool> {
    return this.prisma.treasuryPool.create({
      data: {
        totalBalance: data.totalBalance,
        treasuryWallet: data.treasuryWallet,
        allocated: 0,
        distributed: 0,
        profitsEarned: 0
      }
    });
  }

  /**
   * Update treasury pool
   */
  async updatePool(data: Partial<TreasuryPool>): Promise<TreasuryPool> {
    const pool = await this.getPool();
    if (!pool) {
      throw new Error('Treasury pool not found');
    }

    return this.prisma.treasuryPool.update({
      where: { id: pool.id },
      data
    });
  }

  /**
   * Increment distributed amount
   */
  async incrementDistributed(amount: number): Promise<TreasuryPool> {
    const pool = await this.getPool();
    if (!pool) {
      throw new Error('Treasury pool not found');
    }

    return this.prisma.treasuryPool.update({
      where: { id: pool.id },
      data: {
        distributed: {
          increment: amount
        }
      }
    });
  }

  /**
   * Create allocation record
   */
  async createAllocation(data: {
    epochId: string;
    scannerId: string;
    amount: number;
    performanceScore: number;
    rank: number;
    txSignature?: string;
    status: string;
  }): Promise<TreasuryAllocation> {
    return this.prisma.treasuryAllocation.create({
      data: {
        ...data,
        txSignature: data.txSignature || null,
        completedAt: data.status === 'completed' ? new Date() : null
      }
    });
  }

  /**
   * Update allocation status
   */
  async updateAllocation(
    id: string,
    data: {
      status?: string;
      txSignature?: string;
      completedAt?: Date;
    }
  ): Promise<TreasuryAllocation> {
    return this.prisma.treasuryAllocation.update({
      where: { id },
      data
    });
  }

  /**
   * Get scanner allocations
   */
  async getScannerAllocations(scannerId: string): Promise<TreasuryAllocation[]> {
    return this.prisma.treasuryAllocation.findMany({
      where: { scannerId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get epoch allocations
   */
  async getEpochAllocations(epochId: string): Promise<TreasuryAllocation[]> {
    return this.prisma.treasuryAllocation.findMany({
      where: { epochId },
      orderBy: { rank: 'asc' }
    });
  }

  /**
   * Get all allocations with scanner details
   */
  async getAllAllocationsWithScanners(limit?: number) {
    return this.prisma.treasuryAllocation.findMany({
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: limit })
    });
  }
}
