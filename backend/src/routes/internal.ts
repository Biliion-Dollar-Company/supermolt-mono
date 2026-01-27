import { Hono } from 'hono';
import { z } from 'zod';
import { internalAuthMiddleware } from '../middleware/internal';
import * as tradeService from '../services/trade.service';

const internal = new Hono();

// All internal routes require API key
internal.use('*', internalAuthMiddleware);

const createTradeSchema = z.object({
  agentId: z.string().min(1),
  tokenMint: z.string().min(1),
  tokenSymbol: z.string().min(1),
  tokenName: z.string().min(1),
  action: z.enum(['BUY', 'SELL']),
  entryPrice: z.number().positive(),
  amount: z.number().positive(),
  tokenAmount: z.number().positive().optional(),
  signalSource: z.string().min(1),
  confidence: z.number().int().min(0).max(100),
  marketCap: z.number().positive().optional(),
  liquidity: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const closeTradeSchema = z.object({
  tradeId: z.string().min(1),
  exitPrice: z.number().positive(),
  pnl: z.number(),
  pnlPercent: z.number(),
});

// POST /internal/trades — DevPrint creates a paper trade
internal.post('/trades', async (c) => {
  try {
    const body = await c.req.json();
    const input = createTradeSchema.parse(body);

    const trade = await tradeService.createPaperTrade(input);

    return c.json({ success: true, data: trade }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to create trade';
    console.error('Internal create trade error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// POST /internal/trades/close — DevPrint closes a paper trade
internal.post('/trades/close', async (c) => {
  try {
    const body = await c.req.json();
    const input = closeTradeSchema.parse(body);

    const trade = await tradeService.closePaperTrade(input);

    return c.json({ success: true, data: trade });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to close trade';
    console.error('Internal close trade error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

export { internal };
