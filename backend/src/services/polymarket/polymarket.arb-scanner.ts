/**
 * Polymarket Structural Arbitrage Scanner
 *
 * On binary Polymarket markets, YES + NO prices must sum to ~$1.
 * When the combined price drops below ARB_THRESHOLD, both sides are
 * mispriced — buy both YES and NO, one settles at $1, spread is profit.
 */

import { polymarketClient } from './polymarket.client';
import { db } from '../../lib/db';

export class PolymarketArbScanner {
  readonly ARB_THRESHOLD = 0.985;

  private scansRun = 0;
  private opportunitiesFound = 0;
  private lastScanAt: Date | null = null;

  async scan(): Promise<void> {
    this.scansRun++;
    this.lastScanAt = new Date();

    const markets = await polymarketClient.getMarkets(500);
    if (!Array.isArray(markets) || markets.length === 0) return;

    const cryptoKeywords = ['btc', 'bitcoin', 'crypto', 'price'];

    const candidates = markets.filter((m) => {
      if (!m || !m.question) return false;
      const q = m.question.toLowerCase();
      return cryptoKeywords.some((kw) => q.includes(kw));
    });

    for (const m of candidates) {
      const yes = typeof m.outcomePrices === 'string'
        ? JSON.parse(m.outcomePrices)[0]
        : Number(m.yes_price ?? m.outcomePrices?.[0] ?? 0);
      const no = typeof m.outcomePrices === 'string'
        ? JSON.parse(m.outcomePrices)[1]
        : Number(m.no_price ?? m.outcomePrices?.[1] ?? 0);

      const yesPrice = Number(yes);
      const noPrice = Number(no);
      if (!yesPrice || !noPrice) continue;

      const combined = yesPrice + noPrice;
      if (combined >= this.ARB_THRESHOLD) continue;

      const spread = (1 - combined).toFixed(4);
      this.opportunitiesFound++;

      console.log(
        `[PolymarketArb] ${m.question} | YES=${yesPrice} NO=${noPrice} combined=${combined.toFixed(4)} spread=${spread}`,
      );

      // Upsert market
      const market = await db.predictionMarket.upsert({
        where: {
          platform_externalId: {
            platform: 'POLYMARKET',
            externalId: String(m.id),
          },
        },
        create: {
          platform: 'POLYMARKET',
          externalId: String(m.id),
          title: m.question,
          category: m.category || 'Crypto',
          yesPrice,
          noPrice,
          volume: Number(m.volume ?? 0),
          expiresAt: m.end_date_iso ? new Date(m.end_date_iso) : new Date(Date.now() + 86400000),
          status: 'open',
          outcome: 'PENDING',
          metadata: { arbSpread: spread },
        },
        update: {
          yesPrice,
          noPrice,
          volume: Number(m.volume ?? 0),
          metadata: { arbSpread: spread },
        },
      });

      // Record YES side prediction
      await db.agentPrediction.create({
        data: {
          agentId: 'arb-scanner',
          marketId: market.id,
          side: 'YES',
          confidence: 99,
          reasoning: 'structural-arb:yes',
          contracts: 1,
          avgPrice: yesPrice,
          totalCost: yesPrice,
          outcome: 'PENDING',
          realOrder: false,
        },
      });

      // Record NO side prediction
      await db.agentPrediction.create({
        data: {
          agentId: 'arb-scanner',
          marketId: market.id,
          side: 'NO',
          confidence: 99,
          reasoning: 'structural-arb:no',
          contracts: 1,
          avgPrice: noPrice,
          totalCost: noPrice,
          outcome: 'PENDING',
          realOrder: false,
        },
      });
    }
  }

  getStats() {
    return {
      scansRun: this.scansRun,
      opportunitiesFound: this.opportunitiesFound,
      lastScanAt: this.lastScanAt,
    };
  }
}

export const polymarketArbScanner = new PolymarketArbScanner();
