/**
 * Polymarket Arb Scanner Cron
 * Runs the structural arbitrage scanner every 30 seconds.
 */

import { polymarketArbScanner } from './polymarket.arb-scanner';

const SCAN_INTERVAL_MS = 30 * 1000;

export function createPolymarketArbCron() {
  console.log('[PolymarketArbCron] Starting arb scanner (every 30s)');

  // Initial scan
  polymarketArbScanner.scan().catch((err) => {
    console.error('[PolymarketArbCron] Initial scan failed:', err);
  });

  const intervalId = setInterval(() => {
    polymarketArbScanner.scan().catch((err) => {
      console.error('[PolymarketArbCron] Scheduled scan failed:', err);
    });
  }, SCAN_INTERVAL_MS);

  return {
    stop: () => clearInterval(intervalId),
  };
}
