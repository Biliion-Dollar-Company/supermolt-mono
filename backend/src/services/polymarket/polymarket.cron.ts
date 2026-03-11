/**
 * Polymarket Sync Cron Job
 * Runs every 5 minutes to sync markets from Polymarket
 */

import { polymarketSyncService } from './polymarket.sync';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function createPolymarketSyncCron() {
  const runSync = async () => {
    await polymarketSyncService.syncMarkets();
  };

  // Run initial sync immediately
  runSync().then(() => {
    console.log('[PolymarketCron] ✅ Initial sync complete');
  });

  const intervalId = setInterval(() => {
    runSync().catch((err) => {
      console.error('[PolymarketCron] ❌ Scheduled sync failed:', err);
    });
  }, SYNC_INTERVAL_MS);

  console.log('[PolymarketCron] 🔄 Cron job started (every 5 minutes)');

  return {
    stop: () => clearInterval(intervalId),
  };
}
