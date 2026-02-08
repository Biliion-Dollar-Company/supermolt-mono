/**
 * Epoch Service
 * 
 * Business logic for epoch management
 */

import { db } from '../../lib/db';
import type { CreateEpochDto, EpochDto, EpochListDto } from './dto/epoch.dto';

export class EpochService {
  private prisma: typeof db;

  constructor() {
    this.prisma = db;
  }

  // Inlined repository helpers
  private async getNextEpochNumber(): Promise<number> {
    const last = await this.prisma.scannerEpoch.findFirst({ orderBy: { epochNumber: 'desc' } });
    return (last?.epochNumber ?? 0) + 1;
  }

  private async findActive() {
    return this.prisma.scannerEpoch.findFirst({ where: { status: 'ACTIVE' } });
  }

  private async findById(id: string) {
    return this.prisma.scannerEpoch.findUnique({ where: { id } });
  }

  private async findAllEpochs() {
    return this.prisma.scannerEpoch.findMany({ orderBy: { epochNumber: 'desc' } });
  }

  private async getRankings(epochId: string) {
    return this.prisma.scannerRanking.findMany({
      where: { epochId },
      include: { scanner: true },
      orderBy: { performanceScore: 'desc' },
    });
  }

  private async updateEpochStatus(id: string, status: string) {
    return this.prisma.scannerEpoch.update({ where: { id }, data: { status } });
  }

  /**
   * Create new epoch
   */
  async create(dto: CreateEpochDto): Promise<EpochDto> {
    const epochNumber = await this.getNextEpochNumber();

    const epoch = await this.prisma.scannerEpoch.create({ data: {
      name: dto.name,
      epochNumber,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      usdcPool: dto.usdcPool || 1000,
      baseAllocation: dto.baseAllocation || 200
    }});

    return {
      id: epoch.id,
      name: epoch.name,
      epochNumber: epoch.epochNumber,
      startAt: epoch.startAt.toISOString(),
      endAt: epoch.endAt.toISOString(),
      status: epoch.status,
      usdcPool: parseFloat(epoch.usdcPool.toString()),
      baseAllocation: parseFloat(epoch.baseAllocation.toString()),
      createdAt: epoch.createdAt.toISOString()
    };
  }

  /**
   * Get all epochs
   */
  async getAll(): Promise<EpochListDto> {
    const epochs = await this.findAllEpochs();
    const activeEpoch = await this.findActive();

    return {
      epochs: epochs.map(e => ({
        id: e.id,
        name: e.name,
        epochNumber: e.epochNumber,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
        status: e.status,
        usdcPool: parseFloat(e.usdcPool.toString()),
        baseAllocation: parseFloat(e.baseAllocation.toString()),
        createdAt: e.createdAt.toISOString()
      })),
      total: epochs.length,
      active: activeEpoch?.id || null
    };
  }

  /**
   * Get epoch by ID
   */
  async getById(epochId: string): Promise<EpochDto> {
    const epoch = await this.findById(epochId);
    
    if (!epoch) {
      throw new Error(`Epoch ${epochId} not found`);
    }

    // Get stats
    const rankings = await this.getRankings(epochId);
    const totalCalls = rankings.reduce((sum, r) => sum + r.totalCalls, 0);
    const totalDistributed = rankings.reduce(
      (sum, r) => sum + parseFloat(r.usdcAllocated.toString()),
      0
    );

    return {
      id: epoch.id,
      name: epoch.name,
      epochNumber: epoch.epochNumber,
      startAt: epoch.startAt.toISOString(),
      endAt: epoch.endAt.toISOString(),
      status: epoch.status,
      usdcPool: parseFloat(epoch.usdcPool.toString()),
      baseAllocation: parseFloat(epoch.baseAllocation.toString()),
      createdAt: epoch.createdAt.toISOString(),
      stats: {
        totalScanners: rankings.length,
        totalCalls,
        totalDistributed: Math.round(totalDistributed * 100) / 100
      }
    };
  }

  /**
   * Update epoch status
   */
  async updateStatus(epochId: string, status: string): Promise<EpochDto> {
    const epoch = await this.updateEpochStatus(epochId, status);

    return {
      id: epoch.id,
      name: epoch.name,
      epochNumber: epoch.epochNumber,
      startAt: epoch.startAt.toISOString(),
      endAt: epoch.endAt.toISOString(),
      status: epoch.status,
      usdcPool: parseFloat(epoch.usdcPool.toString()),
      baseAllocation: parseFloat(epoch.baseAllocation.toString()),
      createdAt: epoch.createdAt.toISOString()
    };
  }

  /**
   * Start epoch (set to ACTIVE)
   */
  async start(epochId: string): Promise<EpochDto> {
    return this.updateStatus(epochId, 'ACTIVE');
  }

  /**
   * End epoch (set to ENDED)
   */
  async end(epochId: string): Promise<EpochDto> {
    return this.updateStatus(epochId, 'ENDED');
  }

  /**
   * Get active epoch
   */
  async getActive(): Promise<EpochDto | null> {
    const epoch = await this.findActive();
    
    if (!epoch) {
      return null;
    }

    return {
      id: epoch.id,
      name: epoch.name,
      epochNumber: epoch.epochNumber,
      startAt: epoch.startAt.toISOString(),
      endAt: epoch.endAt.toISOString(),
      status: epoch.status,
      usdcPool: parseFloat(epoch.usdcPool.toString()),
      baseAllocation: parseFloat(epoch.baseAllocation.toString()),
      createdAt: epoch.createdAt.toISOString()
    };
  }
}
