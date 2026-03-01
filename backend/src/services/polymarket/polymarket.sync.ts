/**
 * Polymarket Market Sync Service
 * Syncs markets from Polymarket to database every 5 minutes
 */

import { db } from '../../lib/db';
import { polymarketClient } from './polymarket.client';
import { PolymarketMarket } from './polymarket.types';

export class PolymarketSyncService {
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;
  private totalMarketsSynced = 0;

  /**
   * Sync all trading markets to database
   */
  async syncMarkets(): Promise<{ synced: number; errors: number }> {
    if (this.syncInProgress) {
      console.log('[PolymarketSync] Sync already in progress, skipping...');
      return { synced: 0, errors: 0 };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    let synced = 0;
    let errors = 0;

    try {
      console.log('[PolymarketSync] 🔄 Starting market sync...');
      
      // Fetch all markets from Polymarket
      const markets = await polymarketClient.getAllTradingMarkets();
      console.log(`[PolymarketSync] Fetched ${markets.length} markets from Polymarket`);

      // Upsert each market to database
      for (const market of markets) {
        try {
          await this.upsertMarket(market);
          synced++;
        } catch (error: any) {
          console.error(`[PolymarketSync] Error upserting market ${market.id}:`, error.message);
          errors++;
        }
      }

      this.lastSyncTime = new Date();
      this.totalMarketsSynced = synced;
      
      const duration = Date.now() - startTime;
      console.log(`[PolymarketSync] ✅ Sync complete: ${synced} synced, ${errors} errors (${duration}ms)`);

      return { synced, errors };
    } catch (error: any) {
      console.error('[PolymarketSync] ❌ Sync failed:', error.message);
      return { synced, errors: errors + 1 };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Upsert a single market to database
   */
  private async upsertMarket(market: PolymarketMarket): Promise<void> {
    const externalId = market.id;
    const title = market.question;
    const category = market.category || 'Unknown';
    
    // Calculate YES/NO prices
    let yesPrice = 0.5;
    let noPrice = 0.5;
    
    if (market.probability !== undefined && market.probability !== null) {
      yesPrice = market.probability;
      noPrice = 1 - market.probability;
    } else if (market.outcomePrices) {
      try {
        const prices = JSON.parse(market.outcomePrices);
        if (Array.isArray(prices) && prices.length >= 2) {
          yesPrice = parseFloat(prices[0]);
          noPrice = parseFloat(prices[1]);
        }
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    // Get volume
    const volume = market.volume || market.volumeNum || market.volume24hr || market.volume_24h || 0;

    // Get expiry date
    const expiryDate = market.endDate || market.end_date;
    const expiresAt = expiryDate ? new Date(expiryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Determine status
    const status = market.active && !market.closed ? 'open' : 'closed';

    // Metadata
    const metadata = {
      conditionId: market.conditionId,
      clobTokenIds: market.clobTokenIds,
      liquidity: market.liquidity || market.liquidityNum,
      volume24hr: market.volume24hr || market.volume_24h,
    };

    // Upsert to database
    await db.predictionMarket.upsert({
      where: {
        platform_externalId: {
          platform: 'POLYMARKET',
          externalId,
        },
      },
      create: {
        platform: 'POLYMARKET',
        externalId,
        title,
        category,
        yesPrice,
        noPrice,
        volume,
        status,
        expiresAt,
        metadata,
        outcome: 'PENDING',
      },
      update: {
        yesPrice,
        noPrice,
        volume,
        status,
        updatedAt: new Date(),
        metadata,
      },
    });
  }

  /**
   * Get sync stats
   */
  getStats() {
    return {
      lastSyncTime: this.lastSyncTime,
      totalMarketsSynced: this.totalMarketsSynced,
      syncInProgress: this.syncInProgress,
    };
  }
}

// Export singleton instance
export const polymarketSyncService = new PolymarketSyncService();
