import { Hono } from 'hono';
import { z } from 'zod';
import * as agentService from '../services/agent.service';
import { authMiddleware } from '../middleware/auth';

const agent = new Hono();

// All routes require auth
agent.use('*', authMiddleware);

const updateConfigSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  maxPositionSize: z.number().min(0.01).max(100).optional(),
  stopLoss: z.number().min(1).max(100).optional(),
  takeProfit: z.number().min(1).max(1000).optional(),
  allowedTokens: z.array(z.string()).optional(),
  tradingHours: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

// GET /agent/state
agent.get('/state', async (c) => {
  try {
    const userId = c.get('userId');
    const state = await agentService.getAgentState(userId);

    return c.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Get agent state error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get agent state',
        },
      },
      500
    );
  }
});

// POST /agent/start
agent.post('/start', async (c) => {
  try {
    const userId = c.get('userId');
    const state = await agentService.startAgent(userId);

    return c.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Start agent error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start agent',
        },
      },
      500
    );
  }
});

// POST /agent/stop
agent.post('/stop', async (c) => {
  try {
    const userId = c.get('userId');
    const state = await agentService.stopAgent(userId);

    return c.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Stop agent error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to stop agent',
        },
      },
      500
    );
  }
});

// POST /agent/pause
agent.post('/pause', async (c) => {
  try {
    const userId = c.get('userId');
    const state = await agentService.pauseAgent(userId);

    return c.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Pause agent error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to pause agent',
        },
      },
      500
    );
  }
});

// PUT /agent/config
agent.put('/config', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const config = updateConfigSchema.parse(body);

    const state = await agentService.updateAgentConfig(userId, config);

    return c.json({
      success: true,
      data: state,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          },
        },
        400
      );
    }

    console.error('Update config error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update config',
        },
      },
      500
    );
  }
});

export { agent };
