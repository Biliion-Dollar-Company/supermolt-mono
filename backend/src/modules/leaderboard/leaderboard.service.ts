/**
 * Leaderboard Service
 * 
 * Business logic for leaderboard rankings and statistics
 */

import { PrismaClient } from '@prisma/client';
import { EpochRepository, ScannerRepository } from '../../repositories';
import type {
  LeaderboardDto,
  LeaderboardEntryDto,
  ScannerStatsDto,
  GlobalStatsDto,
  EpochHistoryEntryDto
} from './dto/leaderboard.dto';

export class LeaderboardService {
  private epochRepo: EpochRepository;
  private scannerRepo: ScannerRepository;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.epochRepo = new EpochRepository(this.prisma);
    this.scannerRepo = new ScannerRepository(this.prisma);
  }

  /**
   * Get current leaderboard (active epoch)
   */
  async getCurrentLeaderboard(): Promise<LeaderboardDto | null> {
    const activeEpoch = await this.epochRepo.findActive();

    if (!activeEpoch) {
      return null;
    }

    return this.getLeaderboardForEpoch(activeEpoch.id);
  }

  /**
   * Get leaderboard for specific epoch
   */
  async getLeaderboardForEpoch(epochId: string): Promise<LeaderboardDto> {
    const epoch = await this.epochRepo.findById(epochId);
    if (!epoch) {
      throw new Error(`Epoch ${epochId} not found`);
    }

    const rankings = await this.epochRepo.getRankings(epochId);

    const baseAllocation = parseFloat(epoch.baseAllocation.toString());
    const multipliers: Record<number, number> = {
      1: 2.0,
      2: 1.5,
      3: 1.0,
      4: 0.75,
      5: 0.5
    };

    const leaderboard: LeaderboardEntryDto[] = rankings.map((ranking, index) => {
      const rank = index + 1;
      const multiplier = multipliers[rank] || 1.0;
      const performanceScore = parseFloat(ranking.performanceScore.toString());
      const performanceAdjustment = Math.max(0.5, performanceScore / 100);
      const potentialReward = baseAllocation * multiplier * performanceAdjustment;

      return {
        rank,
        scannerId: ranking.scannerId,
        agentId: ranking.scanner.agentId,
        name: ranking.scanner.name,
        pubkey: ranking.scanner.pubkey,
        strategy: ranking.scanner.strategy,
        description: ranking.scanner.description,
        
        performanceScore,
        totalCalls: ranking.totalCalls,
        winningCalls: ranking.winningCalls,
        losingCalls: ranking.losingCalls,
        winRate: parseFloat(ranking.winRate.toString()),
        avgReturn: parseFloat(ranking.avgReturn.toString()),
        totalPnl: parseFloat(ranking.totalPnl.toString()),
        
        winStreak: ranking.winStreak,
        maxWinStreak: ranking.maxWinStreak,
        
        potentialReward: Math.round(potentialReward * 100) / 100,
        usdcAllocated: parseFloat(ranking.usdcAllocated.toString()),
        multiplier
      };
    });

    const aggregateStats = await this.getAggregateStats();

    return {
      epochId: epoch.id,
      epochName: epoch.name,
      epochNumber: epoch.epochNumber,
      startAt: epoch.startAt.toISOString(),
      endAt: epoch.endAt.toISOString(),
      status: epoch.status,
      usdcPool: parseFloat(epoch.usdcPool.toString()),
      baseAllocation,
      rankings: leaderboard,
      totalScanners: leaderboard.length,
      ...aggregateStats
    };
  }

  /**
   * Get aggregate stats for homepage (totalMessages, totalVolume, totalTransactions)
   */
  async getAggregateStats(): Promise<Pick<LeaderboardDto, 'totalMessages' | 'totalVolume' | 'totalTransactions'>> {
    const [totalMessages, totalTransactions, volumeAgg] = await Promise.all([
      this.prisma.agentMessage.count(),
      this.prisma.scannerCall.count(),
      this.prisma.scannerRanking.aggregate({
        _sum: { usdcAllocated: true }
      })
    ]);

    const totalVolume = parseFloat(
      (volumeAgg._sum.usdcAllocated ?? 0).toString()
    );

    return {
      totalMessages,
      totalVolume: Math.round(totalVolume * 100) / 100,
      totalTransactions
    };
  }

  /**
   * Get scanner performance history
   */
  async getScannerStats(scannerId: string): Promise<ScannerStatsDto> {
    const scanner = await this.scannerRepo.findById(scannerId);
    if (!scanner) {
      throw new Error(`Scanner ${scannerId} not found`);
    }

    // Get all rankings for this scanner
    const rankings = await this.prisma.scannerRanking.findMany({
      where: { scannerId },
      include: { epoch: true },
      orderBy: { createdAt: 'desc' }
    });

    const totalEarned = rankings.reduce(
      (sum, r) => sum + parseFloat(r.usdcAllocated.toString()),
      0
    );

    const totalCalls = rankings.reduce((sum, r) => sum + r.totalCalls, 0);
    const totalWins = rankings.reduce((sum, r) => sum + r.winningCalls, 0);
    const overallWinRate = totalCalls > 0 ? (totalWins / totalCalls) * 100 : 0;

    const epochHistory: EpochHistoryEntryDto[] = rankings.map(ranking => ({
      epochId: ranking.epochId,
      epochName: ranking.epoch.name,
      epochNumber: ranking.epoch.epochNumber,
      rank: ranking.rank,
      finalRank: ranking.finalRank,
      performanceScore: parseFloat(ranking.performanceScore.toString()),
      totalCalls: ranking.totalCalls,
      winRate: parseFloat(ranking.winRate.toString()),
      usdcAllocated: parseFloat(ranking.usdcAllocated.toString()),
      startAt: ranking.epoch.startAt.toISOString(),
      endAt: ranking.epoch.endAt.toISOString()
    }));

    return {
      scanner: {
        id: scanner.id,
        agentId: scanner.agentId,
        name: scanner.name,
        pubkey: scanner.pubkey,
        strategy: scanner.strategy,
        description: scanner.description
      },
      stats: {
        totalEarned: Math.round(totalEarned * 100) / 100,
        totalCalls,
        totalWins,
        overallWinRate: Math.round(overallWinRate * 100) / 100,
        epochsParticipated: rankings.length
      },
      epochHistory
    };
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(): Promise<GlobalStatsDto> {
    const epochs = await this.epochRepo.findAll();
    
    const allRankings = await this.prisma.scannerRanking.findMany({
      include: { scanner: true }
    });

    const totalDistributed = allRankings.reduce(
      (sum, r) => sum + parseFloat(r.usdcAllocated.toString()),
      0
    );

    const totalCalls = allRankings.reduce((sum, r) => sum + r.totalCalls, 0);
    const totalWins = allRankings.reduce((sum, r) => sum + r.winningCalls, 0);

    // Get top scanner overall
    const scannerTotals = allRankings.reduce((acc, ranking) => {
      const scannerId = ranking.scannerId;
      if (!acc[scannerId]) {
        acc[scannerId] = {
          scannerId,
          scannerName: ranking.scanner.name,
          totalEarned: 0,
          totalCalls: 0,
          totalWins: 0
        };
      }
      acc[scannerId].totalEarned += parseFloat(ranking.usdcAllocated.toString());
      acc[scannerId].totalCalls += ranking.totalCalls;
      acc[scannerId].totalWins += ranking.winningCalls;
      return acc;
    }, {} as Record<string, any>);

    const topScanner = Object.values(scannerTotals)
      .sort((a: any, b: any) => b.totalEarned - a.totalEarned)[0] || null;

    return {
      totalEpochs: epochs.length,
      activeEpochs: epochs.filter(e => e.status === 'ACTIVE').length,
      completedEpochs: epochs.filter(e => e.status === 'PAID').length,
      totalDistributed: Math.round(totalDistributed * 100) / 100,
      totalCalls,
      totalWins,
      globalWinRate: totalCalls > 0 ? Math.round((totalWins / totalCalls) * 100 * 100) / 100 : 0,
      topScanner: topScanner ? {
        scannerId: topScanner.scannerId,
        scannerName: topScanner.scannerName,
        totalEarned: Math.round(topScanner.totalEarned * 100) / 100
      } : null
    };
  }
}
