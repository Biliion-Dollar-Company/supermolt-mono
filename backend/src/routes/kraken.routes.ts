/**
 * Kraken Routes
 *
 * REST endpoints for Kraken CLI challenge submission:
 *   GET  /kraken/ticker         — all default pairs
 *   GET  /kraken/ticker/:pair   — single pair (e.g. XBT-USD)
 *   GET  /kraken/balance        — account balances
 *   GET  /kraken/orders         — open orders
 *   POST /kraken/order          — place market order
 *   GET  /kraken/pnl            — realized PnL breakdown (Challenge 1 key endpoint)
 */

import { Hono } from 'hono';
import {
  getTickerData,
  getBalance,
  getOpenOrders,
  placeOrder,
  getPnL,
  KRAKEN_DEFAULT_PAIRS,
  SANDBOX_MODE,
} from '../services/kraken-cli.service';

export const krakenRoutes = new Hono();

krakenRoutes.get('/ticker', async (c) => {
  const pairs = KRAKEN_DEFAULT_PAIRS;
  const data = await getTickerData(pairs);
  return c.json({ pairs: data, sandboxMode: SANDBOX_MODE });
});

krakenRoutes.get('/ticker/:pair', async (c) => {
  // Accept "XBT-USD" or "XBTUSD" from URL — normalize to "XBT/USD"
  const raw = c.req.param('pair').toUpperCase().replace('-', '/');
  const pair = raw.includes('/') ? raw : raw.replace('USD', '/USD').replace('EUR', '/EUR');
  const data = await getTickerData([pair]);
  if (!data.length) return c.json({ error: 'Pair not found' }, 404);
  return c.json(data[0]);
});

krakenRoutes.get('/balance', async (c) => {
  const balances = await getBalance();
  return c.json({ balances, sandboxMode: SANDBOX_MODE });
});

krakenRoutes.get('/orders', async (c) => {
  const orders = await getOpenOrders();
  return c.json({ orders, sandboxMode: SANDBOX_MODE });
});

krakenRoutes.post('/order', async (c) => {
  const body = await c.req.json<{
    pair: string;
    side: 'buy' | 'sell';
    volumeUsd: number;
    currentPrice?: number;
  }>();

  if (!body.pair || !body.side || !body.volumeUsd) {
    return c.json({ error: 'pair, side, and volumeUsd are required' }, 400);
  }

  const result = await placeOrder(body.pair, body.side, body.volumeUsd, body.currentPrice ?? 0);
  return c.json(result);
});

// Challenge 1 key endpoint — returns auditable PnL for leaderboard submission
krakenRoutes.get('/pnl', async (c) => {
  const pnl = await getPnL();
  return c.json({
    ...pnl,
    sandboxMode: SANDBOX_MODE,
    generatedAt: new Date().toISOString(),
  });
});
