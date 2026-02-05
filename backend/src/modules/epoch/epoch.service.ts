/**
 * Epoch Service
 * 
 * Business logic for epoch management
 */

import { PrismaClient } from '@prisma/client';
import { EpochRepository } from '../../repositories';
import type { CreateEpochDto, EpochDto, EpochListDto } from './dto/epoch.dto';

export class EpochService {
  private epochRepo: EpochRepository;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.epochRepo = new EpochRepository(this.prisma);
  }

  /**
   * Create new epoch
   */
  async create(dto: CreateEpochDto): Promise<EpochDto> {
    const epochNumber = await this.epochRepo.getNextEpochNumber();

    const epoch = await this.epochRepo.create({
      name: dto.name,
      epochNumber,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      usdcPool: dto.usdcPool || 1000,
      baseAllocation: dto.baseAllocation || 200
    });

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
    const epochs = await this.epochRepo.findAll();
    const activeEpoch = await this.epochRepo.findActive();

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
    const epoch = await this.epochRepo.findById(epochId);
    
    if (!epoch) {
      throw new Error(`Epoch ${epochId} not found`);
    }

    // Get stats
    const rankings = await this.epochRepo.getRankings(epochId);
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
    const epoch = await this.epochRepo.updateStatus(epochId, status);

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
    const epoch = await this.epochRepo.findActive();
    
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
