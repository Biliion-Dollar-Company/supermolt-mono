/**
 * Sortino Ratio Cron Job
 * Recalculates all agent Sortino ratios hourly
 */

import { PrismaClient } from '@prisma/client';
import { createSortinoService } from './sortino.service';
import { DistributedLockService } from './distributed-lock.service';
import { cronLockEvents, sortinoCalculations } from './metrics.service';

const HOUR_IN_MS = 60 * 60 * 1000; // 1 hour
const SORTINO_LOCK_TTL_MS = parseInt(process.env.SORTINO_LOCK_TTL_MS || '3500000', 10); // 58m20s

export class SortinoCronJob {
  private db: PrismaClient;
  private sortinoService: ReturnType<typeof createSortinoService>;
  private lockService: DistributedLockService;
  private intervalId: Timer | null = null;
  private isRunning: boolean = false;

  constructor(db: PrismaClient, lockService: DistributedLockService) {
    this.db = db;
    this.sortinoService = createSortinoService(db);
    this.lockService = lockService;
  }

  /**
   * Start the cron job
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Sortino cron job already running');
      return;
    }

    console.log('🕐 Starting Sortino cron job (runs every hour)');

    // Run immediately on start
    this.runCalculation();

    // Then run every hour
    this.intervalId = setInterval(() => {
      this.runCalculation();
    }, HOUR_IN_MS);

    this.isRunning = true;
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('🛑 Sortino cron job stopped');
    }
  }

  /**
   * Run the calculation
   */
  private async runCalculation() {
    const lockKey = 'cron:sortino:hourly';
    try {
      const acquired = await this.lockService.tryAcquire(lockKey, SORTINO_LOCK_TTL_MS);
      if (!acquired) {
        cronLockEvents.labels('sortino_hourly', 'skipped').inc();
        console.log('⏭️  Sortino cron skipped (lock held by another replica)');
        return;
      }
      cronLockEvents.labels('sortino_hourly', 'acquired').inc();

      console.log(`\n🔄 [${new Date().toISOString()}] Running hourly Sortino calculation...`);
      const startTime = Date.now();

      await this.sortinoService.calculateAllAgents();
      sortinoCalculations.labels('success').inc();

      const duration = Date.now() - startTime;
      console.log(`✅ Sortino calculation complete in ${duration}ms`);
    } catch (error) {
      sortinoCalculations.labels('failed').inc();
      console.error('❌ Sortino cron job failed:', error);
    } finally {
      try {
        await this.lockService.release(lockKey);
      } catch (releaseError) {
        cronLockEvents.labels('sortino_hourly', 'release_failed').inc();
        console.error('⚠️ Failed to release Sortino lock:', releaseError);
      }
    }
  }

  /**
   * Check if job is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export function createSortinoCron(db: PrismaClient, lockService: DistributedLockService) {
  return new SortinoCronJob(db, lockService);
}
