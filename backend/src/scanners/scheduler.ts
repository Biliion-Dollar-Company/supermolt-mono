/**
 * Scanner Scheduler
 * 
 * Runs scanners on a schedule (hourly, daily, etc.)
 */

import { runAlphaScanner } from './alpha-scanner';

export class ScannerScheduler {
  private intervals: NodeJS.Timeout[] = [];
  
  /**
   * Start all scanners
   */
  start() {
    console.log('[Scanner Scheduler] 🚀 Starting scanner scheduler...\n');
    
    // Alpha Scanner - Run every hour
    const alphaInterval = setInterval(async () => {
      console.log('\n' + '='.repeat(70));
      console.log(`[${new Date().toISOString()}] Running Alpha Scanner (hourly)`);
      console.log('='.repeat(70) + '\n');
      
      try {
        await runAlphaScanner();
      } catch (error) {
        console.error('[Scheduler] Alpha Scanner failed:', error);
      }
    }, 3600000); // 1 hour
    
    this.intervals.push(alphaInterval);
    
    // Run Alpha immediately on startup
    setTimeout(async () => {
      console.log('[Scheduler] Running initial Alpha scan...\n');
      try {
        await runAlphaScanner();
      } catch (error) {
        console.error('[Scheduler] Initial Alpha scan failed:', error);
      }
    }, 5000); // 5 seconds after startup
    
    // TODO: Add other scanners
    // Beta Scanner - Run every 30 minutes (AI sentiment)
    // Gamma Scanner - Run every 15 minutes (liquidity)
    // Delta Scanner - Run every hour (technical)
    // Epsilon Scanner - Run every 2 hours (contrarian)
    
    console.log('[Scanner Scheduler] ✅ Scheduler started');
    console.log('  - Alpha Scanner: Every 1 hour');
    console.log('  - Beta Scanner: Not implemented yet');
    console.log('  - Gamma Scanner: Not implemented yet');
    console.log('  - Delta Scanner: Not implemented yet');
    console.log('  - Epsilon Scanner: Not implemented yet\n');
  }
  
  /**
   * Stop all scanners
   */
  stop() {
    console.log('[Scanner Scheduler] 🛑 Stopping scheduler...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('[Scanner Scheduler] Stopped');
  }
}

// Singleton instance
let schedulerInstance: ScannerScheduler | null = null;

export function getScannerScheduler(): ScannerScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ScannerScheduler();
  }
  return schedulerInstance;
}
