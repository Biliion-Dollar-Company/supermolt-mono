import { Hono } from 'hono';
import { z } from 'zod';
import * as agentService from '../services/agent.service';
import { authMiddleware } from '../middleware/auth';

const agent = new Hono();

// All routes require auth
agent.use('*', authMiddleware);

const createAgentSchema = z.object({
  archetypeId: z.string().min(1),
  name: z.string().min(1).max(32),
});

const updateStatusSchema = z.object({
  status: z.enum(['TRAINING', 'ACTIVE', 'PAUSED']),
});

// GET /agents — list user's agents
agent.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const agents = await agentService.getUserAgents(userId);

    return c.json({ success: true, data: agents });
  } catch (error) {
    console.error('List agents error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list agents' } },
      500
    );
  }
});

// POST /agents — create a new agent
agent.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { archetypeId, name } = createAgentSchema.parse(body);

    const newAgent = await agentService.createAgent(userId, archetypeId, name);

    return c.json({ success: true, data: newAgent }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to create agent';
    const status = message.includes('already have') ? 409 : 500;
    return c.json(
      { success: false, error: { code: status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR', message } },
      status
    );
  }
});

// GET /agents/:id — get agent details
agent.get('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('id');
    const result = await agentService.getAgent(agentId, userId);

    return c.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get agent';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

// PATCH /agents/:id/status — update agent status
agent.patch('/:id/status', async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('id');
    const body = await c.req.json();
    const { status } = updateStatusSchema.parse(body);

    const updated = await agentService.updateAgentStatus(agentId, userId, status);

    return c.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.errors } },
        400
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to update status';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

// DELETE /agents/:id — delete an agent
agent.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('id');
    await agentService.deleteAgent(agentId, userId);

    return c.json({ success: true, data: { deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete agent';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

export { agent };
