/**
 * Prediction Market Cron Jobs
 *
 * Two periodic loops:
 * 1. Market sync (every 5 min): Fetch top markets from Kalshi → upsert PredictionMarket
 * 2. Resolution check (every 15 min): Resolve expired markets → update AgentPrediction + PredictionStats
 *
 * Pattern: same as sortino-cron.ts with distributed lock
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { DistributedLockService } from './distributed-lock.service';
import { getKalshiService } from './kalshi.service';
import { calculateLevel } from './onboarding.service';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RESOLVE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const SYNC_LOCK_TTL_MS = 4 * 60 * 1000; // 4 minutes
const RESOLVE_LOCK_TTL_MS = 14 * 60 * 1000; // 14 minutes

const XP_CORRECT_PREDICTION = 50;

export class PredictionCronJob {
  private db: PrismaClient;
  private lockService: DistributedLockService;
  private syncIntervalId: Timer | null = null;
  private resolveIntervalId: Timer | null = null;
  private isRunning = false;

  constructor(db: PrismaClient, lockService: DistributedLockService) {
    this.db = db;
    this.lockService = lockService;
  }

  start() {
    if (this.isRunning) {
      console.log('[Prediction] Cron already running');
      return;
    }

    console.log('[Prediction] Starting cron jobs (sync: 5min, resolve: 15min)');

    // Run immediately then on interval
    this.runSync();
    this.runResolution();

    this.syncIntervalId = setInterval(() => this.runSync(), SYNC_INTERVAL_MS);
    this.resolveIntervalId = setInterval(() => this.runResolution(), RESOLVE_INTERVAL_MS);
    this.isRunning = true;
  }

  stop() {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    if (this.resolveIntervalId) clearInterval(this.resolveIntervalId);
    this.syncIntervalId = null;
    this.resolveIntervalId = null;
    this.isRunning = false;
    console.log('[Prediction] Cron jobs stopped');
  }

  private async runSync() {
    const lockKey = 'cron:prediction:sync';
    try {
      const acquired = await this.lockService.tryAcquire(lockKey, SYNC_LOCK_TTL_MS);
      if (!acquired) {
        console.log('[Prediction] Sync skipped (lock held)');
        return;
      }

      const kalshi = getKalshiService();
      const synced = await kalshi.syncMarkets({ limit: 200 });
      console.log(`[Prediction] Market sync complete: ${synced} markets`);
    } catch (error) {
      console.error('[Prediction] Sync error:', error);
    } finally {
      try { await this.lockService.release(lockKey); } catch {}
    }
  }

  private async runResolution() {
    const lockKey = 'cron:prediction:resolve';
    try {
      const acquired = await this.lockService.tryAcquire(lockKey, RESOLVE_LOCK_TTL_MS);
      if (!acquired) {
        console.log('[Prediction] Resolution skipped (lock held)');
        return;
      }

      // Step 1: Check external markets for resolved outcomes
      const kalshi = getKalshiService();
      const resolvedCount = await kalshi.checkResolutions();

      // Step 2: Resolve agent predictions for newly resolved markets
      const resolvedMarkets = await this.db.predictionMarket.findMany({
        where: {
          outcome: { in: ['YES', 'NO', 'VOID'] },
        },
        include: {
          predictions: {
            where: { outcome: 'PENDING' },
          },
        },
      });

      let predictionsResolved = 0;
      for (const market of resolvedMarkets) {
        for (const pred of market.predictions) {
          await this.resolvePrediction(pred, market.outcome as 'YES' | 'NO' | 'VOID');
          predictionsResolved++;
        }
      }

      if (resolvedCount > 0 || predictionsResolved > 0) {
        console.log(`[Prediction] Resolution complete: ${resolvedCount} markets, ${predictionsResolved} predictions`);
      }
    } catch (error) {
      console.error('[Prediction] Resolution error:', error);
    } finally {
      try { await this.lockService.release(lockKey); } catch {}
    }
  }

  private async resolvePrediction(
    prediction: { id: string; agentId: string; side: string; totalCost: Prisma.Decimal; avgPrice: Prisma.Decimal; contracts: number },
    marketOutcome: 'YES' | 'NO' | 'VOID'
  ) {
    const isCorrect = prediction.side === marketOutcome;
    const isVoid = marketOutcome === 'VOID';

    // Calculate payout: $1 per contract if correct, $0 if wrong, refund if void
    const totalCost = parseFloat(prediction.totalCost.toString());
    let payout: number;
    let pnl: number;

    if (isVoid) {
      payout = totalCost; // Refund
      pnl = 0;
    } else if (isCorrect) {
      payout = prediction.contracts; // $1 per contract
      pnl = payout - totalCost;
    } else {
      payout = 0;
      pnl = -totalCost;
    }

    const outcome = isVoid ? 'VOID' : (isCorrect ? prediction.side : (prediction.side === 'YES' ? 'NO' : 'YES'));

    // Brier score component for this prediction
    const predProb = parseFloat(prediction.avgPrice.toString());
    const actualOutcome = isCorrect ? 1 : 0;
    const brierComponent = Math.pow(predProb - actualOutcome, 2);

    await this.db.$transaction(async (tx) => {
      // 1. Update the prediction
      await tx.agentPrediction.update({
        where: { id: prediction.id },
        data: {
          outcome: marketOutcome as any,
          payout,
          pnl,
        },
      });

      // 2. Recalculate PredictionStats atomically
      const allResolved = await tx.agentPrediction.findMany({
        where: {
          agentId: prediction.agentId,
          outcome: { not: 'PENDING' },
        },
      });

      const total = allResolved.length;
      const correct = allResolved.filter(p => {
        if (p.outcome === 'VOID') return false;
        return p.side === p.outcome;
      }).length;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;

      // Calculate aggregate Brier score
      const brierSum = allResolved.reduce((sum, p) => {
        if (p.outcome === 'VOID') return sum;
        const prob = parseFloat(p.avgPrice.toString());
        const actual = p.side === p.outcome ? 1 : 0;
        return sum + Math.pow(prob - actual, 2);
      }, 0);
      const nonVoid = allResolved.filter(p => p.outcome !== 'VOID').length;
      const brierScore = nonVoid > 0 ? brierSum / nonVoid : 1;

      // Calculate ROI
      const totalCostAll = allResolved.reduce((sum, p) => sum + parseFloat(p.totalCost.toString()), 0);
      const totalPayoutAll = allResolved.reduce((sum, p) => sum + (p.payout ? parseFloat(p.payout.toString()) : 0), 0);
      const roi = totalCostAll > 0 ? ((totalPayoutAll - totalCostAll) / totalCostAll) * 100 : 0;

      // Calculate streak
      const sortedByDate = [...allResolved]
        .filter(p => p.outcome !== 'VOID')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      let streak = 0;
      for (const p of sortedByDate) {
        if (p.side === p.outcome) streak++;
        else break;
      }

      // Get existing best streak
      const existingStats = await tx.predictionStats.findUnique({
        where: { agentId: prediction.agentId },
      });
      const bestStreak = Math.max(streak, existingStats?.bestStreak || 0);

      await tx.predictionStats.upsert({
        where: { agentId: prediction.agentId },
        update: {
          totalPredictions: total,
          correctPredictions: correct,
          accuracy,
          brierScore,
          roi,
          streak,
          bestStreak,
          totalCost: totalCostAll,
          totalPayout: totalPayoutAll,
        },
        create: {
          agentId: prediction.agentId,
          totalPredictions: total,
          correctPredictions: correct,
          accuracy,
          brierScore,
          roi,
          streak,
          bestStreak,
          totalCost: totalCostAll,
          totalPayout: totalPayoutAll,
        },
      });

      // 3. Award XP for correct predictions (not void)
      if (isCorrect && !isVoid) {
        const updated = await tx.tradingAgent.update({
          where: { id: prediction.agentId },
          data: { xp: { increment: XP_CORRECT_PREDICTION } },
        });
        const newLevel = calculateLevel(updated.xp);
        if (updated.level !== newLevel) {
          await tx.tradingAgent.update({
            where: { id: prediction.agentId },
            data: { level: newLevel },
          });
        }
      }
    });
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export function createPredictionCron(db: PrismaClient, lockService: DistributedLockService) {
  return new PredictionCronJob(db, lockService);
}
