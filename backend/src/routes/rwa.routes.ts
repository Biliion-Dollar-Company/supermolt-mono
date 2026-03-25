/**
 * RWA Routes — Real World Asset portfolio management endpoints.
 */

import { Hono } from 'hono';
import { db } from '../lib/db';
import { RwaDataService } from '../services/rwa/rwa-data.service';
import { PythOracleService } from '../services/rwa/pyth-oracle.service';
import { PortfolioManagerService } from '../services/rwa/portfolio-manager.service';
import { JupiterRwaService } from '../services/rwa/jupiter-rwa.service';

const rwa = new Hono();

const rwaData = new RwaDataService();
const pyth = new PythOracleService();
const portfolioManager = new PortfolioManagerService();
const jupiter = new JupiterRwaService();

rwa.get('/tokens', async (c) => {
  const tokens = await rwaData.getTokens();
  return c.json({ tokens, count: tokens.length });
});

rwa.get('/yields', async (c) => {
  const yields = await rwaData.getYieldRates();
  return c.json({ yields });
});

rwa.get('/prices', async (c) => {
  const prices = await pyth.getAllRwaPrices();
  return c.json({ prices, updatedAt: new Date().toISOString() });
});

rwa.get('/asset-classes', async (c) => {
  const breakdown = await rwaData.getAssetClassBreakdown();
  return c.json({ assetClasses: breakdown });
});

rwa.get('/strategies', (c) => {
  return c.json({ strategies: ['conservative', 'balanced', 'aggressive'] });
});

rwa.get('/strategies/:name', (c) => {
  const name = c.req.param('name') as 'conservative' | 'balanced' | 'aggressive';
  if (!['conservative', 'balanced', 'aggressive'].includes(name)) {
    return c.json({ error: 'Unknown strategy. Use: conservative, balanced, aggressive' }, 400);
  }
  const allocation = portfolioManager.generateTargetAllocation(name);
  return c.json({ strategy: name, allocation });
});

// ── Portfolio per agent ──────────────────────────────────────────────

rwa.get('/portfolio/:agentId', async (c) => {
  const agentId = c.req.param('agentId');

  const allocations = await db.portfolioAllocation.findMany({
    where: { agentId },
    orderBy: { weight: 'desc' },
  });

  if (allocations.length === 0) {
    return c.json({ agentId, allocations: [], totalValue: 0, metrics: null });
  }

  // Compute total value
  const totalValue = allocations.reduce((sum, a) => {
    const price = a.currentPrice ?? a.entryPrice;
    return sum + a.quantity * price;
  }, 0);

  // Build current weights as AllocationTargets for metric computation
  const currentAllocation = allocations.map((a) => ({
    symbol: a.symbol,
    assetClass: a.assetClass as 'CRYPTO' | 'TREASURY_BILLS' | 'EQUITIES' | 'GOLD' | 'REAL_ESTATE' | 'FIXED_INCOME' | 'GOVERNMENT_BONDS',
    weight: a.weight * 100,
  }));

  // Synthetic daily returns for demo metrics (slight positive bias)
  const dailyReturns = Array.from({ length: 30 }, () => (Math.random() - 0.45) * 0.02);
  const initialValue = totalValue * 0.95;
  const metrics = portfolioManager.computeMetrics({ totalValue, initialValue, dailyReturns });

  return c.json({
    agentId,
    allocations: allocations.map((a) => ({
      ...a,
      value: a.quantity * (a.currentPrice ?? a.entryPrice),
    })),
    totalValue,
    metrics,
    currentAllocation,
  });
});

// ── Rebalance trigger ────────────────────────────────────────────────

rwa.post('/rebalance/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const body = await c.req.json().catch(() => ({}));
  const strategy = (body.strategy as 'conservative' | 'balanced' | 'aggressive') || 'balanced';

  // Get current portfolio
  const allocations = await db.portfolioAllocation.findMany({ where: { agentId } });
  if (allocations.length === 0) {
    return c.json({ error: 'No portfolio found for this agent' }, 404);
  }

  const totalValue = allocations.reduce((sum, a) => {
    return sum + a.quantity * (a.currentPrice ?? a.entryPrice);
  }, 0);

  const current = allocations.map((a) => ({
    symbol: a.symbol,
    assetClass: a.assetClass as 'CRYPTO' | 'TREASURY_BILLS' | 'EQUITIES' | 'GOLD' | 'REAL_ESTATE' | 'FIXED_INCOME' | 'GOVERNMENT_BONDS',
    weight: a.weight * 100,
  }));

  const target = portfolioManager.generateTargetAllocation(strategy);
  const trades = portfolioManager.calculateRebalanceTrades(current, target, totalValue);

  // Record rebalance events
  const events = [];
  for (const trade of trades) {
    const event = await db.rebalanceEvent.create({
      data: {
        agentId,
        fromToken: trade.fromSymbol,
        toToken: trade.toSymbol,
        fromAmount: trade.amount,
        toAmount: trade.amount * 0.998, // ~0.2% slippage
        status: 'COMPLETED',
        reason: trade.reason,
        txSignature: `mock_rebalance_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    events.push(event);
  }

  return c.json({
    agentId,
    strategy,
    tradesExecuted: trades.length,
    trades,
    events,
    totalValue,
  });
});

export { rwa as rwaRoutes };
