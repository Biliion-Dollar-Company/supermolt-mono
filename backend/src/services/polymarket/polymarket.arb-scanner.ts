/**
 * Polymarket Structural Arbitrage Scanner
 *
 * On binary Polymarket markets, YES + NO prices must sum to ~$1.
 * When the combined price drops below ARB_THRESHOLD, both sides are
 * mispriced — buy both YES and NO, one settles at $1, spread is profit.
 */

import { polymarketClient } from './polymarket.client';
import { polymarketOrderClient } from './polymarket.order-client';
import { db } from '../../lib/db';

const REAL_ORDERS_ENABLED = process.env.POLYMARKET_REAL_ORDERS === 'true';

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
      const prices = typeof m.outcomePrices === 'string'
        ? JSON.parse(m.outcomePrices) as string[]
        : null;
      const yes = prices ? Number(prices[0]) : (m.probability ?? 0);
      const no = prices ? Number(prices[1]) : (1 - (m.probability ?? 0));

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

      // Attempt real orders when enabled and a Polygon private key is configured
      let realOrder = false;
      let yesOrderId: string | undefined;
      let noOrderId: string | undefined;

      if (REAL_ORDERS_ENABLED && polymarketOrderClient.isConfigured() && m.clobTokenIds) {
        const tokenIds = m.clobTokenIds.split(',').map((t) => t.trim());
        if (tokenIds.length >= 2) {
          const [yesTokenId, noTokenId] = tokenIds;
          const BUY_AMOUNT_USDC = Number(process.env.POLYMARKET_ARB_SIZE_USDC || '1');
          try {
            const [yesResult, noResult] = await Promise.all([
              polymarketOrderClient.placeMarketBuy(yesTokenId, BUY_AMOUNT_USDC, yesPrice),
              polymarketOrderClient.placeMarketBuy(noTokenId, BUY_AMOUNT_USDC, noPrice),
            ]);
            yesOrderId = yesResult.orderId;
            noOrderId = noResult.orderId;
            realOrder = true;
            console.log(`[PolymarketArb] Real orders placed: YES=${yesOrderId} NO=${noOrderId}`);
          } catch (err: any) {
            console.warn(`[PolymarketArb] Real order failed: ${err.message} — recording as paper`);
          }
        }
      }

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
          expiresAt: m.endDate ? new Date(m.endDate) : m.end_date ? new Date(m.end_date) : new Date(Date.now() + 86400000),
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
          realOrder,
          orderId: yesOrderId || null,
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
          realOrder,
          orderId: noOrderId || null,
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
