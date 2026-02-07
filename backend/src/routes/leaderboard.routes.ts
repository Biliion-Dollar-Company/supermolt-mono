// @ts-nocheck — Dead code: Express routes replaced by Hono modules/leaderboard
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/leaderboard
 * Get current leaderboard (active epoch)
 */
router.get('/', async (req, res) => {
  try {
    // Get active epoch
    const activeEpoch = await prisma.scannerEpoch.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startAt: 'desc' }
    });

    if (!activeEpoch) {
      return res.json({
        success: true,
        data: {
          epochId: null,
          epochName: null,
          rankings: [],
          message: 'No active epoch'
        }
      });
    }

    // Get rankings with scanner details
    const rankings = await prisma.scannerRanking.findMany({
      where: { epochId: activeEpoch.id },
      include: {
        scanner: true
      },
      orderBy: { performanceScore: 'desc' }
    });

    // Calculate potential USDC rewards
    const baseAllocation = parseFloat(activeEpoch.baseAllocation.toString());
    const multipliers: Record<number, number> = {
      1: 2.0,
      2: 1.5,
      3: 1.0,
      4: 0.75,
      5: 0.5
    };

    const leaderboard = rankings.map((ranking, index) => {
      const rank = index + 1;
      const multiplier = multipliers[rank] || 1.0;
      const performanceScore = parseFloat(ranking.performanceScore.toString());
      const performanceAdjustment = Math.max(0.5, performanceScore / 100);
      const potentialReward = baseAllocation * multiplier * performanceAdjustment;

      return {
        rank,
        scannerId: ranking.scannerId,
        name: ranking.scanner.name,
        pubkey: ranking.scanner.pubkey,
        strategy: ranking.scanner.strategy,
        description: ranking.scanner.description,
        
        // Performance metrics
        performanceScore: parseFloat(ranking.performanceScore.toString()),
        totalCalls: ranking.totalCalls,
        winningCalls: ranking.winningCalls,
        losingCalls: ranking.losingCalls,
        winRate: parseFloat(ranking.winRate.toString()),
        avgReturn: parseFloat(ranking.avgReturn.toString()),
        totalPnl: parseFloat(ranking.totalPnl.toString()),
        
        // Streak data
        winStreak: ranking.winStreak,
        maxWinStreak: ranking.maxWinStreak,
        
        // USDC rewards
        potentialReward: Math.round(potentialReward * 100) / 100,
        usdcAllocated: parseFloat(ranking.usdcAllocated.toString()),
        multiplier
      };
    });

    res.json({
      success: true,
      data: {
        epochId: activeEpoch.id,
        epochName: activeEpoch.name,
        epochNumber: activeEpoch.epochNumber,
        startAt: activeEpoch.startAt,
        endAt: activeEpoch.endAt,
        status: activeEpoch.status,
        usdcPool: parseFloat(activeEpoch.usdcPool.toString()),
        baseAllocation: parseFloat(activeEpoch.baseAllocation.toString()),
        rankings: leaderboard,
        totalScanners: leaderboard.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/leaderboard/:epochId
 * Get leaderboard for a specific epoch
 */
router.get('/:epochId', async (req, res) => {
  try {
    const { epochId } = req.params;

    const epoch = await prisma.scannerEpoch.findUnique({
      where: { id: epochId }
    });

    if (!epoch) {
      return res.status(404).json({
        success: false,
        error: 'Epoch not found'
      });
    }

    const rankings = await prisma.scannerRanking.findMany({
      where: { epochId },
      include: {
        scanner: true
      },
      orderBy: [
        { rank: 'asc' },
        { performanceScore: 'desc' }
      ]
    });

    const leaderboard = rankings.map(ranking => ({
      rank: ranking.rank,
      finalRank: ranking.finalRank,
      scannerId: ranking.scannerId,
      name: ranking.scanner.name,
      pubkey: ranking.scanner.pubkey,
      strategy: ranking.scanner.strategy,
      
      performanceScore: parseFloat(ranking.performanceScore.toString()),
      totalCalls: ranking.totalCalls,
      winningCalls: ranking.winningCalls,
      losingCalls: ranking.losingCalls,
      winRate: parseFloat(ranking.winRate.toString()),
      avgReturn: parseFloat(ranking.avgReturn.toString()),
      totalPnl: parseFloat(ranking.totalPnl.toString()),
      
      usdcAllocated: parseFloat(ranking.usdcAllocated.toString())
    }));

    res.json({
      success: true,
      data: {
        epoch: {
          id: epoch.id,
          name: epoch.name,
          epochNumber: epoch.epochNumber,
          startAt: epoch.startAt,
          endAt: epoch.endAt,
          status: epoch.status,
          usdcPool: parseFloat(epoch.usdcPool.toString())
        },
        rankings: leaderboard,
        totalDistributed: leaderboard.reduce((sum, r) => sum + r.usdcAllocated, 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/leaderboard/scanner/:scannerId
 * Get performance history for a scanner across all epochs
 */
router.get('/scanner/:scannerId', async (req, res) => {
  try {
    const { scannerId } = req.params;

    const scanner = await prisma.scanner.findUnique({
      where: { id: scannerId }
    });

    if (!scanner) {
      return res.status(404).json({
        success: false,
        error: 'Scanner not found'
      });
    }

    // Get all rankings for this scanner
    const rankings = await prisma.scannerRanking.findMany({
      where: { scannerId },
      include: {
        epoch: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate totals
    const totalEarned = rankings.reduce(
      (sum, r) => sum + parseFloat(r.usdcAllocated.toString()),
      0
    );

    const totalCalls = rankings.reduce((sum, r) => sum + r.totalCalls, 0);
    const totalWins = rankings.reduce((sum, r) => sum + r.winningCalls, 0);
    const overallWinRate = totalCalls > 0 ? (totalWins / totalCalls) * 100 : 0;

    const epochHistory = rankings.map(ranking => ({
      epochId: ranking.epochId,
      epochName: ranking.epoch.name,
      epochNumber: ranking.epoch.epochNumber,
      rank: ranking.rank,
      finalRank: ranking.finalRank,
      performanceScore: parseFloat(ranking.performanceScore.toString()),
      totalCalls: ranking.totalCalls,
      winRate: parseFloat(ranking.winRate.toString()),
      usdcAllocated: parseFloat(ranking.usdcAllocated.toString()),
      startAt: ranking.epoch.startAt,
      endAt: ranking.epoch.endAt
    }));

    res.json({
      success: true,
      data: {
        scanner: {
          id: scanner.id,
          agentId: scanner.agentId,
          name: scanner.name,
          pubkey: scanner.pubkey,
          strategy: scanner.strategy,
          description: scanner.description
        },
        stats: {
          totalEarned,
          totalCalls,
          totalWins,
          overallWinRate: Math.round(overallWinRate * 100) / 100,
          epochsParticipated: rankings.length
        },
        epochHistory
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/leaderboard/stats/global
 * Get global statistics across all epochs
 */
router.get('/stats/global', async (req, res) => {
  try {
    // Get all epochs
    const epochs = await prisma.scannerEpoch.findMany({
      orderBy: { epochNumber: 'desc' }
    });

    // Get all rankings
    const allRankings = await prisma.scannerRanking.findMany();

    // Calculate totals
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
      .sort((a: any, b: any) => b.totalEarned - a.totalEarned)[0];

    res.json({
      success: true,
      data: {
        totalEpochs: epochs.length,
        activeEpochs: epochs.filter(e => e.status === 'ACTIVE').length,
        completedEpochs: epochs.filter(e => e.status === 'PAID').length,
        totalDistributed: Math.round(totalDistributed * 100) / 100,
        totalCalls,
        totalWins,
        globalWinRate: totalCalls > 0 ? Math.round((totalWins / totalCalls) * 100 * 100) / 100 : 0,
        topScanner: topScanner || null
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
