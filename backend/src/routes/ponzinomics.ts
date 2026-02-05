/**
 * Ponzinomics Routes
 * Frontend/Mobile interface to Ponzinomics analytics and trading
 */

import { Hono } from 'hono';
import { ponzinomics } from '../lib/ponzinomics';
import { authMiddleware } from '../middleware/auth';

export const ponzinomicsRoutes = new Hono();

// Public routes (no auth required)
ponzinomicsRoutes.get('/tokens/trending', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 10;
    const tokens = await ponzinomics.getTrendingTokens(limit);
    return c.json({ success: true, data: tokens });
  } catch (error: any) {
    return c.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    );
  }
});

ponzinomicsRoutes.get('/tokens/:mint', async (c) => {
  try {
    const mint = c.req.param('mint');
    const [metadata, signal, analytics] = await Promise.all([
      ponzinomics.getTokenMetadata(mint),
      ponzinomics.getTokenSignal(mint),
      ponzinomics.getTokenAnalytics(mint),
    ]);

    return c.json({
      success: true,
      data: { metadata, signal, analytics },
    });
  } catch (error: any) {
    return c.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    );
  }
});

ponzinomicsRoutes.get('/signals/all', async (c) => {
  try {
    const signal = c.req.query('signal') as any;
    const limit = Number(c.req.query('limit')) || 20;

    if (!signal) {
      return c.json(
        {
          success: false,
          error: { message: 'signal query param required' },
        },
        { status: 400 }
      );
    }

    const tokens = await ponzinomics.getTokensBySignal(signal, limit);
    return c.json({ success: true, data: tokens });
  } catch (error: any) {
    return c.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    );
  }
});

// Protected routes (JWT required)
ponzinomicsRoutes.get(
  '/trades/history',
  authMiddleware,
  async (c) => {
    try {
      const walletAddress = c.req.header('X-Wallet-Address');
      if (!walletAddress) {
        return c.json(
          {
            success: false,
            error: { message: 'X-Wallet-Address header required' },
          },
          { status: 400 }
        );
      }

      const limit = Number(c.req.query('limit')) || 50;
      const history = await ponzinomics.getTradeHistory(walletAddress, limit);

      return c.json({ success: true, data: history });
    } catch (error: any) {
      return c.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }
  }
);

ponzinomicsRoutes.post(
  '/trades/copy',
  authMiddleware,
  async (c) => {
    try {
      const { fromAgent, tradeId, scalePercent } = await c.req.json();
      const walletAddress = c.req.header('X-Wallet-Address');

      if (!walletAddress || !fromAgent || !tradeId) {
        return c.json(
          {
            success: false,
            error: { message: 'walletAddress, fromAgent, tradeId required' },
          },
          { status: 400 }
        );
      }

      const execution = await ponzinomics.copyTrade(
        fromAgent,
        walletAddress,
        tradeId,
        scalePercent || 100
      );

      return c.json({ success: true, data: execution });
    } catch (error: any) {
      return c.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }
  }
);

ponzinomicsRoutes.post(
  '/trades/execute',
  authMiddleware,
  async (c) => {
    try {
      const { mint, amount, slippage } = await c.req.json();
      const walletAddress = c.req.header('X-Wallet-Address');

      if (!walletAddress || !mint || !amount) {
        return c.json(
          {
            success: false,
            error: { message: 'walletAddress, mint, amount required' },
          },
          { status: 400 }
        );
      }

      const execution = await ponzinomics.executeSwap(
        walletAddress,
        mint,
        amount,
        slippage || 5
      );

      return c.json({ success: true, data: execution });
    } catch (error: any) {
      return c.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }
  }
);

ponzinomicsRoutes.get('/arbitrage/opportunities', async (c) => {
  try {
    const opportunities = await ponzinomics.getArbitrageOpportunities();
    return c.json({ success: true, data: opportunities });
  } catch (error: any) {
    return c.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    );
  }
});
