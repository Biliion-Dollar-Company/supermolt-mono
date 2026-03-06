/**
 * Polymarket BTC Latency Arbitrage Scanner
 *
 * Strategy: Polymarket updates BTC contract prices 2-5s slower than Binance.
 * When Binance moves >0.3% and Polymarket hasn't caught up, edge exists.
 *
 * - Binance WebSocket: real-time BTC price
 * - Polymarket CLOB: polled every 500ms for BTC 5-min Up/Down market prices
 * - When lag detected: log opportunity + create agentPrediction record
 */

import WebSocket from 'ws';
import { polymarketClient } from './polymarket.client';
import { db } from '../../lib/db';

interface BinanceTradeMsg {
  e: string; // event type
  s: string; // symbol
  p: string; // price
  T: number; // trade time
}

interface LatencyOpportunity {
  btcPrice: number;
  polyYesPrice: number;
  polyNoPrice: number;
  impliedProbability: number;
  polyProbability: number;
  edgePct: number;
  side: 'YES' | 'NO';
  detectedAt: Date;
}

export class PolymarketLatencyScanner {
  readonly EDGE_THRESHOLD = 0.003; // 0.3%
  readonly POLL_INTERVAL_MS = 500;
  readonly BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';

  private ws: WebSocket | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  // Binance state
  private btcPrice = 0;
  private btcLastUpdate = 0;
  private btcPriceHistory: { price: number; ts: number }[] = [];

  // Stats
  private scansRun = 0;
  private lagDetected = 0;
  private lagTimesMs: number[] = [];
  private lastScanAt: Date | null = null;

  // BTC market tracking
  private btcMarketId: string | null = null;
  private btcMarketDbId: string | null = null;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.connectBinance();
    await this.findBtcMarket();
    this.startPolling();

    console.log('[PolymarketLatency] Scanner started');
  }

  stop(): void {
    this.running = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[PolymarketLatency] Scanner stopped');
  }

  private connectBinance(): void {
    this.ws = new WebSocket(this.BINANCE_WS_URL);

    this.ws.on('open', () => {
      console.log('[PolymarketLatency] Binance WebSocket connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const trade: BinanceTradeMsg = JSON.parse(data.toString());
        this.btcPrice = parseFloat(trade.p);
        this.btcLastUpdate = Date.now();

        // Keep 60s of price history for momentum calculation
        this.btcPriceHistory.push({ price: this.btcPrice, ts: this.btcLastUpdate });
        const cutoff = this.btcLastUpdate - 60_000;
        while (this.btcPriceHistory.length > 0 && this.btcPriceHistory[0].ts < cutoff) {
          this.btcPriceHistory.shift();
        }
      } catch {
        // ignore malformed messages
      }
    });

    this.ws.on('close', () => {
      console.log('[PolymarketLatency] Binance WebSocket closed');
      if (this.running) {
        setTimeout(() => this.connectBinance(), 3000);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[PolymarketLatency] Binance WebSocket error:', err.message);
    });
  }

  private async findBtcMarket(): Promise<void> {
    try {
      const markets = await polymarketClient.getMarkets(500);
      // Look for BTC 5-min Up/Down style markets
      const btcMarket = markets.find((m) => {
        if (!m?.question) return false;
        const q = m.question.toLowerCase();
        return (
          (q.includes('btc') || q.includes('bitcoin')) &&
          (q.includes('up') || q.includes('down') || q.includes('price') || q.includes('above') || q.includes('below'))
        );
      });

      if (btcMarket) {
        this.btcMarketId = String(btcMarket.id);
        console.log(`[PolymarketLatency] Found BTC market: "${btcMarket.question}" (${this.btcMarketId})`);

        // Ensure market exists in DB
        const dbMarket = await db.predictionMarket.upsert({
          where: {
            platform_externalId: {
              platform: 'POLYMARKET',
              externalId: this.btcMarketId,
            },
          },
          create: {
            platform: 'POLYMARKET',
            externalId: this.btcMarketId,
            title: btcMarket.question,
            category: btcMarket.category || 'Crypto',
            yesPrice: 0.5,
            noPrice: 0.5,
            volume: Number(btcMarket.volume ?? 0),
            expiresAt: btcMarket.end_date
              ? new Date(btcMarket.end_date)
              : new Date(Date.now() + 86400000),
            status: 'open',
            outcome: 'PENDING',
            metadata: { scanner: 'latency-arb' },
          },
          update: {
            volume: Number(btcMarket.volume ?? 0),
          },
        });
        this.btcMarketDbId = dbMarket.id;
      } else {
        console.warn('[PolymarketLatency] No BTC market found, will retry on next poll cycle');
      }
    } catch (err: any) {
      console.error('[PolymarketLatency] Error finding BTC market:', err.message);
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.scan().catch((err) => {
        console.error('[PolymarketLatency] Scan error:', err.message);
      });
    }, this.POLL_INTERVAL_MS);
  }

  private async scan(): Promise<void> {
    this.scansRun++;
    this.lastScanAt = new Date();

    // Need both Binance price and a BTC market
    if (this.btcPrice === 0 || !this.btcMarketId) {
      // Retry finding market every 100 scans (~50s)
      if (this.scansRun % 100 === 0) {
        await this.findBtcMarket();
      }
      return;
    }

    // Calculate recent BTC momentum (5s window)
    const now = Date.now();
    const fiveSecsAgo = this.btcPriceHistory.find((p) => p.ts >= now - 5000);
    if (!fiveSecsAgo) return;

    const priceDelta = (this.btcPrice - fiveSecsAgo.price) / fiveSecsAgo.price;

    // Only trigger if Binance moved > threshold
    if (Math.abs(priceDelta) < this.EDGE_THRESHOLD) return;

    // Fetch Polymarket prices for the BTC market
    try {
      const markets = await polymarketClient.getMarkets(500);
      const btcMarket = markets.find((m) => String(m.id) === this.btcMarketId);
      if (!btcMarket) return;

      const yesPrice = typeof btcMarket.outcomePrices === 'string'
        ? Number(JSON.parse(btcMarket.outcomePrices)[0])
        : Number((btcMarket as any).yes_price ?? btcMarket.outcomePrices?.[0] ?? 0);
      const noPrice = typeof btcMarket.outcomePrices === 'string'
        ? Number(JSON.parse(btcMarket.outcomePrices)[1])
        : Number((btcMarket as any).no_price ?? btcMarket.outcomePrices?.[1] ?? 0);

      if (!yesPrice || !noPrice) return;

      // Binance implies direction
      // If BTC pumping (priceDelta > 0), YES on "BTC up" should be higher
      // If BTC dumping (priceDelta < 0), NO on "BTC up" should be higher
      const bullish = priceDelta > 0;
      const impliedProb = bullish ? Math.min(0.95, yesPrice + Math.abs(priceDelta)) : Math.max(0.05, yesPrice - Math.abs(priceDelta));
      const currentPolyProb = yesPrice;
      const edge = Math.abs(impliedProb - currentPolyProb);

      if (edge < this.EDGE_THRESHOLD) return;

      // Lag detected
      this.lagDetected++;
      const lagMs = now - this.btcLastUpdate;
      this.lagTimesMs.push(lagMs);
      // Keep only last 1000 lag measurements
      if (this.lagTimesMs.length > 1000) this.lagTimesMs.shift();

      const side: 'YES' | 'NO' = bullish ? 'YES' : 'NO';
      const edgePct = (edge * 100).toFixed(2);

      console.log(
        `[PolymarketLatency] LAG DETECTED: BTC $${this.btcPrice.toFixed(2)}, ` +
        `Poly implies ${(currentPolyProb * 100).toFixed(1)}%, ` +
        `actual ${(impliedProb * 100).toFixed(1)}%, ` +
        `edge ${edgePct}%, side=${side}`
      );

      // Update market prices in DB
      if (this.btcMarketDbId) {
        await db.predictionMarket.update({
          where: { id: this.btcMarketDbId },
          data: { yesPrice, noPrice },
        });

        // Record opportunity
        await db.agentPrediction.create({
          data: {
            agentId: 'latency-scanner',
            marketId: this.btcMarketDbId,
            side,
            confidence: Math.min(99, Math.round(edge * 100 * 10)),
            reasoning: `latency-arb:${side.toLowerCase()}`,
            contracts: 1,
            avgPrice: side === 'YES' ? yesPrice : noPrice,
            totalCost: side === 'YES' ? yesPrice : noPrice,
            outcome: 'PENDING',
            realOrder: false,
          },
        });
      }
    } catch (err: any) {
      // Silently skip on fetch errors — high frequency polling
    }
  }

  getStats() {
    const avgLagMs =
      this.lagTimesMs.length > 0
        ? Math.round(this.lagTimesMs.reduce((a, b) => a + b, 0) / this.lagTimesMs.length)
        : 0;

    return {
      scansRun: this.scansRun,
      lagDetected: this.lagDetected,
      avgLagMs,
      lastScanAt: this.lastScanAt,
      btcPrice: this.btcPrice,
      btcMarketId: this.btcMarketId,
      running: this.running,
    };
  }
}

export const polymarketLatencyScanner = new PolymarketLatencyScanner();
