/**
 * Surge Routes — Base chain trading via Surge OpenClaw API
 *
 * POST /surge/wallet/create          — Create Surge wallet for agent
 * GET  /surge/wallet/:agentId/balance — Get agent's Base wallet balance
 * POST /surge/buy                     — Buy token via Surge
 * POST /surge/sell                    — Sell token via Surge
 * POST /surge/quote                   — Get price quote
 * GET  /surge/token-status/:address   — Check bonding curve phase
 * GET  /surge/history/:agentId        — Agent's Surge trade history
 * GET  /surge/treasury/status         — Base treasury balance
 * POST /surge/treasury/distribute     — Distribute epoch rewards on Base
 */

import { Hono } from 'hono';
import * as jwt from 'jose';
import { z } from 'zod';
import { db } from '../lib/db';
import * as surgeApi from '../services/surge-api.service';
import { getEthPrice, getBaseTokenPrice } from '../lib/base-prices';
import { treasuryManagerBase } from '../services/treasury-manager-base.service';
import { PositionTracker } from '../services/position-tracker';
import { websocketEvents } from '../services/websocket-events';

export const surgeRoutes = new Hono();

const JWT_SECRET = process.env.JWT_SECRET;
const positionTracker = new PositionTracker(db);

// Simple JWT auth middleware
async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwt.jwtVerify(token, secret);

    if (payload.type !== 'agent') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    c.set('agentId', payload.agentId as string);
    c.set('agentSub', payload.sub as string);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// ── Wallet Operations ───────────────────────────────────

// POST /surge/wallet/create
const createWalletSchema = z.object({
  agentId: z.string().min(1),
});

surgeRoutes.post('/wallet/create', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { agentId } = createWalletSchema.parse(body);

    // Verify agent belongs to user
    const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== (c as any).get('agentSub')) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Check if agent already has a Surge wallet
    const config = (agent.config as Record<string, any>) || {};
    if (config.surgeWalletId) {
      return c.json({
        success: true,
        data: { walletId: config.surgeWalletId, address: config.surgeWalletAddress },
        message: 'Wallet already exists',
      });
    }

    const wallet = await surgeApi.createWallet();

    // Store in agent config
    await db.tradingAgent.update({
      where: { id: agentId },
      data: {
        evmAddress: wallet.address,
        config: {
          ...config,
          surgeWalletId: wallet.walletId,
          surgeWalletAddress: wallet.address,
        },
      },
    });

    // Fund wallet (non-blocking)
    surgeApi.fundWallet(wallet.walletId).catch((err) => {
      console.warn(`[Surge] Failed to fund wallet:`, err.message);
    });

    return c.json({ success: true, data: wallet });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[Surge] Wallet creation failed:', error);
    return c.json({ error: error.message || 'Wallet creation failed' }, 500);
  }
});

// GET /surge/wallet/:agentId/balance
surgeRoutes.get('/wallet/:agentId/balance', requireAuth, async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== (c as any).get('agentSub')) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const config = (agent.config as Record<string, any>) || {};
    if (!config.surgeWalletId) {
      return c.json({ error: 'No Surge wallet configured' }, 400);
    }

    const balance = await surgeApi.getWalletBalance(config.surgeWalletId);
    return c.json({ success: true, data: balance });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ── Trading Operations ──────────────────────────────────

// POST /surge/buy
const buySchema = z.object({
  agentId: z.string().min(1),
  tokenAddress: z.string().min(1),
  ethAmount: z.string().min(1),
  tokenSymbol: z.string().optional().default('UNKNOWN'),
});

surgeRoutes.post('/buy', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { agentId, tokenAddress, ethAmount, tokenSymbol } = buySchema.parse(body);

    const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== (c as any).get('agentSub')) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const config = (agent.config as Record<string, any>) || {};
    if (!config.surgeWalletId) {
      return c.json({ error: 'No Surge wallet configured' }, 400);
    }

    const startTime = Date.now();
    const result = await surgeApi.buyToken(surgeApi.SURGE_CHAIN_ID_BASE, config.surgeWalletId, tokenAddress, ethAmount);
    const executionMs = Date.now() - startTime;

    // Get prices for recording
    const [ethPriceUsd, tokenPrice] = await Promise.all([
      getEthPrice().catch(() => 0),
      getBaseTokenPrice(tokenAddress).catch(() => null),
    ]);

    const ethAmountNum = parseFloat(ethAmount);
    let tokensReceived = 0;
    if (tokenPrice && tokenPrice.priceEth > 0) {
      tokensReceived = ethAmountNum / tokenPrice.priceEth;
    }

    // Record AgentTrade + PaperTrade
    await db.agentTrade.create({
      data: {
        agentId,
        tokenMint: tokenAddress,
        tokenSymbol,
        tokenName: tokenSymbol,
        action: 'BUY',
        chain: 'BASE',
        tokenAmount: tokensReceived,
        solAmount: ethAmountNum,
        signature: result.txHash,
        executionMs,
      },
    });

    await db.paperTrade.create({
      data: {
        agentId,
        tokenMint: tokenAddress,
        tokenSymbol,
        tokenName: tokenSymbol,
        action: 'BUY',
        chain: 'BASE',
        entryPrice: ethPriceUsd,
        amount: ethAmountNum,
        tokenAmount: tokensReceived,
        tokenPrice: tokenPrice?.priceUsd ?? null,
        signalSource: 'manual',
        confidence: 100,
        metadata: { source: 'surge-route', txHash: result.txHash } as Record<string, string>,
      },
    });

    await positionTracker.onBuy(agentId, tokenAddress, tokenSymbol, tokenSymbol, tokensReceived, tokenPrice?.priceUsd ?? 0);

    await db.tradingAgent.update({
      where: { id: agentId },
      data: { totalTrades: { increment: 1 } },
    });

    websocketEvents.broadcastAgentActivity(agentId, {
      agentId,
      action: 'TRADE',
      data: {
        type: 'buy_executed',
        chain: 'BASE',
        tokenAddress,
        tokenSymbol,
        ethAmount,
        txHash: result.txHash,
        executionMs,
      },
    });

    return c.json({
      success: true,
      data: {
        txHash: result.txHash,
        tokensReceived,
        ethAmount: ethAmountNum,
        executionMs,
        basescan: `https://basescan.org/tx/${result.txHash}`,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[Surge] Buy failed:', error);
    return c.json({ error: error.message || 'Buy failed' }, 500);
  }
});

// POST /surge/sell
const sellSchema = z.object({
  agentId: z.string().min(1),
  tokenAddress: z.string().min(1),
  tokenAmount: z.string().min(1),
  tokenSymbol: z.string().optional().default('UNKNOWN'),
});

surgeRoutes.post('/sell', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { agentId, tokenAddress, tokenAmount, tokenSymbol } = sellSchema.parse(body);

    const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== (c as any).get('agentSub')) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const config = (agent.config as Record<string, any>) || {};
    if (!config.surgeWalletId) {
      return c.json({ error: 'No Surge wallet configured' }, 400);
    }

    const startTime = Date.now();
    const result = await surgeApi.sellToken(surgeApi.SURGE_CHAIN_ID_BASE, config.surgeWalletId, tokenAddress, tokenAmount);
    const executionMs = Date.now() - startTime;

    const tokenAmountNum = parseFloat(tokenAmount);
    const tokenPrice = await getBaseTokenPrice(tokenAddress).catch(() => null);
    const ethPriceUsd = await getEthPrice().catch(() => 0);

    let ethReceived = 0;
    if (tokenPrice && tokenPrice.priceEth > 0) {
      ethReceived = tokenAmountNum * tokenPrice.priceEth;
    }

    await db.agentTrade.create({
      data: {
        agentId,
        tokenMint: tokenAddress,
        tokenSymbol,
        tokenName: tokenSymbol,
        action: 'SELL',
        chain: 'BASE',
        tokenAmount: tokenAmountNum,
        solAmount: ethReceived,
        signature: result.txHash,
        executionMs,
      },
    });

    await positionTracker.onSell(agentId, tokenAddress, tokenAmountNum, tokenPrice?.priceUsd ?? 0);

    websocketEvents.broadcastAgentActivity(agentId, {
      agentId,
      action: 'TRADE',
      data: {
        type: 'sell_executed',
        chain: 'BASE',
        tokenAddress,
        tokenSymbol,
        tokenAmount,
        txHash: result.txHash,
        executionMs,
      },
    });

    return c.json({
      success: true,
      data: {
        txHash: result.txHash,
        ethReceived,
        executionMs,
        basescan: `https://basescan.org/tx/${result.txHash}`,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[Surge] Sell failed:', error);
    return c.json({ error: error.message || 'Sell failed' }, 500);
  }
});

// POST /surge/quote
const quoteSchema = z.object({
  tokenAddress: z.string().min(1),
  amount: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  chainId: z.string().optional(),
});

surgeRoutes.post('/quote', async (c) => {
  try {
    const body = await c.req.json();
    const { tokenAddress, amount, side, chainId } = quoteSchema.parse(body);
    const quote = await surgeApi.getQuote(chainId ?? surgeApi.SURGE_CHAIN_ID_BASE, tokenAddress, amount, side);
    return c.json({ success: true, data: quote });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    return c.json({ error: error.message }, 500);
  }
});

// GET /surge/token-status/:address
surgeRoutes.get('/token-status/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const chainId = c.req.query('chainId') ?? surgeApi.SURGE_CHAIN_ID_BASE;
    const status = await surgeApi.getTokenStatus(chainId, address);
    return c.json({ success: true, data: status });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// GET /surge/history/:agentId
surgeRoutes.get('/history/:agentId', requireAuth, async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== (c as any).get('agentSub')) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const config = (agent.config as Record<string, any>) || {};
    if (!config.surgeWalletId) {
      return c.json({ error: 'No Surge wallet configured' }, 400);
    }

    const history = await surgeApi.getTradeHistory(config.surgeWalletId);
    return c.json({ success: true, data: history });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ── Treasury ────────────────────────────────────────────

// GET /surge/treasury/status
surgeRoutes.get('/treasury/status', async (c) => {
  try {
    const status = await treasuryManagerBase.getTreasuryStatus();
    return c.json({ success: true, data: status });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// POST /surge/treasury/distribute
const distributeSchema = z.object({
  epochId: z.string().min(1),
});

surgeRoutes.post('/treasury/distribute', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { epochId } = distributeSchema.parse(body);
    const result = await treasuryManagerBase.distributeAgentRewards(epochId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', issues: error.issues }, 400);
    }
    console.error('[Surge] Distribution failed:', error);
    return c.json({ error: error.message || 'Distribution failed' }, 500);
  }
});
