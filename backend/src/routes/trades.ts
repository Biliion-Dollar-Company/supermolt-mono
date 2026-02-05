import { Hono } from 'hono';
import { z } from 'zod';
import * as tradeService from '../services/trade.service';
import * as feedbackService from '../services/feedback.service';
import { authMiddleware } from '../middleware/auth';

const trades = new Hono();

// All routes require auth
trades.use('*', authMiddleware);

const feedbackSchema = z.object({
  rating: z.enum(['GOOD', 'BAD', 'SKIP']),
  tags: z.array(z.string()).optional(),
  note: z.string().max(500).optional(),
});

// GET /trades/:agentId — list trades for an agent
trades.get('/:agentId', async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');
    const status = c.req.query('status') as 'OPEN' | 'CLOSED' | 'CANCELLED' | undefined;
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const result = await tradeService.getAgentTrades(agentId, userId, { status, limit, offset });

    return c.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get trades';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

// GET /trades/:agentId/:tradeId — get single trade
trades.get('/:agentId/:tradeId', async (c) => {
  try {
    const userId = c.get('userId');
    const tradeId = c.req.param('tradeId');

    const trade = await tradeService.getTrade(tradeId, userId);

    return c.json({ success: true, data: trade });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trade not found';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

// POST /trades/:agentId/:tradeId/feedback — submit feedback on a trade
trades.post('/:agentId/:tradeId/feedback', async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');
    const tradeId = c.req.param('tradeId');
    const body = await c.req.json();
    const { rating, tags, note } = feedbackSchema.parse(body);

    const feedback = await feedbackService.submitFeedback({
      tradeId,
      agentId,
      userId,
      rating,
      tags,
      note,
    });

    return c.json({ success: true, data: feedback });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to submit feedback';
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

// GET /trades/:agentId/feedback/stats — feedback summary for agent
trades.get('/:agentId/feedback/stats', async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');

    const stats = await feedbackService.getAgentFeedbackStats(agentId, userId);

    return c.json({ success: true, data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get feedback stats';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

export { trades };
