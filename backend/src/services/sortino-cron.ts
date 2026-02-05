/**
 * Sortino Ratio Cron Job
 * Recalculates all agent Sortino ratios hourly
 */

import { PrismaClient } from '@prisma/client';
import { createSortinoService } from './sortino.service';

const HOUR_IN_MS = 60 * 60 * 1000; // 1 hour

export class SortinoCronJob {
  private db: PrismaClient;
  private sortinoService: ReturnType<typeof createSortinoService>;
  private intervalId: Timer | null = null;
  private isRunning: boolean = false;

  constructor(db: PrismaClient) {
    this.db = db;
    this.sortinoService = createSortinoService(db);
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
    try {
      console.log(`\n🔄 [${new Date().toISOString()}] Running hourly Sortino calculation...`);
      const startTime = Date.now();

      await this.sortinoService.calculateAllAgents();

      const duration = Date.now() - startTime;
      console.log(`✅ Sortino calculation complete in ${duration}ms`);
    } catch (error) {
      console.error('❌ Sortino cron job failed:', error);
    }
  }

  /**
   * Check if job is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export function createSortinoCron(db: PrismaClient) {
  return new SortinoCronJob(db);
}
