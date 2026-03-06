/**
 * Polymarket BTC Latency Arbitrage Cron
 * Starts the latency scanner that monitors Binance vs Polymarket price lag.
 */

import { polymarketLatencyScanner } from './polymarket.latency-scanner';

export function createPolymarketLatencyCron() {
  console.log('[PolymarketLatencyCron] Starting BTC latency arb scanner');

  polymarketLatencyScanner.start().catch((err) => {
    console.error('[PolymarketLatencyCron] Failed to start:', err);
  });

  return {
    stop: () => polymarketLatencyScanner.stop(),
  };
}
