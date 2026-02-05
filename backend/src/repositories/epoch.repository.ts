/**
 * Epoch Repository
 * 
 * Handles all Prisma queries for ScannerEpoch and ScannerRanking models
 */

import { PrismaClient, ScannerEpoch, ScannerRanking, Prisma } from '@prisma/client';

export class EpochRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find epoch by ID
   */
  async findById(id: string) {
    return this.prisma.scannerEpoch.findUnique({
      where: { id }
    });
  }

  /**
   * Get active epoch
   */
  async findActive(): Promise<ScannerEpoch | null> {
    return this.prisma.scannerEpoch.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startAt: 'desc' }
    });
  }

  /**
   * Get all epochs
   */
  async findAll(limit?: number): Promise<ScannerEpoch[]> {
    return this.prisma.scannerEpoch.findMany({
      orderBy: { epochNumber: 'desc' },
      ...(limit && { take: limit })
    });
  }

  /**
   * Create epoch
   */
  async create(data: {
    name: string;
    epochNumber: number;
    startAt: Date;
    endAt: Date;
    usdcPool?: number;
    baseAllocation?: number;
  }): Promise<ScannerEpoch> {
    return this.prisma.scannerEpoch.create({
      data: {
        ...data,
        usdcPool: data.usdcPool || 1000,
        baseAllocation: data.baseAllocation || 200,
        status: 'UPCOMING'
      }
    });
  }

  /**
   * Update epoch status
   */
  async updateStatus(id: string, status: string): Promise<ScannerEpoch> {
    return this.prisma.scannerEpoch.update({
      where: { id },
      data: { status }
    });
  }

  /**
   * Get epoch rankings with scanner details
   */
  async getRankings(epochId: string) {
    return this.prisma.scannerRanking.findMany({
      where: { epochId },
      include: {
        scanner: true
      },
      orderBy: { performanceScore: 'desc' }
    });
  }

  /**
   * Get or create ranking for scanner in epoch
   */
  async getOrCreateRanking(
    scannerId: string,
    epochId: string
  ): Promise<ScannerRanking> {
    return this.prisma.scannerRanking.upsert({
      where: {
        scannerId_epochId: {
          scannerId,
          epochId
        }
      },
      create: {
        scannerId,
        epochId,
        performanceScore: 0,
        totalCalls: 0,
        winningCalls: 0,
        losingCalls: 0,
        winRate: 0,
        avgReturn: 0,
        totalPnl: 0
      },
      update: {}
    });
  }

  /**
   * Update ranking
   */
  async updateRanking(
    id: string,
    data: Partial<ScannerRanking>
  ): Promise<ScannerRanking> {
    return this.prisma.scannerRanking.update({
      where: { id },
      data
    });
  }

  /**
   * Update ranking by scanner + epoch
   */
  async updateRankingByIds(
    scannerId: string,
    epochId: string,
    data: Partial<ScannerRanking>
  ): Promise<ScannerRanking> {
    return this.prisma.scannerRanking.update({
      where: {
        scannerId_epochId: {
          scannerId,
          epochId
        }
      },
      data
    });
  }

  /**
   * Get next epoch number
   */
  async getNextEpochNumber(): Promise<number> {
    const latest = await this.prisma.scannerEpoch.findFirst({
      orderBy: { epochNumber: 'desc' }
    });

    return (latest?.epochNumber || 0) + 1;
  }
}
