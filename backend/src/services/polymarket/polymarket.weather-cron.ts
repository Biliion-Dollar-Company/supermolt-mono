/**
 * Polymarket Weather Scanner Cron
 * Runs the weather market scanner every 5 minutes.
 */

import { polymarketWeatherScanner } from './polymarket.weather-scanner';

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function createPolymarketWeatherCron() {
  console.log('[PolymarketWeatherCron] Starting weather scanner (every 5min)');

  // Initial scan
  polymarketWeatherScanner.scan().catch((err) => {
    console.error('[PolymarketWeatherCron] Initial scan failed:', err);
  });

  const intervalId = setInterval(() => {
    polymarketWeatherScanner.scan().catch((err) => {
      console.error('[PolymarketWeatherCron] Scheduled scan failed:', err);
    });
  }, SCAN_INTERVAL_MS);

  return {
    stop: () => clearInterval(intervalId),
  };
}
