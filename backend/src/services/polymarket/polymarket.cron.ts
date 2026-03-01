/**
 * Polymarket Sync Cron Job
 * Runs every 5 minutes to sync markets from Polymarket
 */

import { CronJob } from 'cron';
import { polymarketSyncService } from './polymarket.sync';

export function createPolymarketSyncCron() {
  // Run every 5 minutes: '*/5 * * * *'
  const job = new CronJob('*/5 * * * *', async () => {
    await polymarketSyncService.syncMarkets();
  });

  // Run initial sync immediately
  polymarketSyncService.syncMarkets().then(() => {
    console.log('[PolymarketCron] ✅ Initial sync complete');
  });

  job.start();
  console.log('[PolymarketCron] 🔄 Cron job started (every 5 minutes)');

  return job;
}
