import { Hono } from 'hono';
import { z } from 'zod';
import * as agentService from '../services/agent.service';
import { authMiddleware } from '../middleware/auth';
import { getAllArchetypes } from '../lib/archetypes';
import { issueAgentTokens } from '../services/agent-session.service';

const agent = new Hono();

// All routes require auth
agent.use('*', authMiddleware);

const createAgentSchema = z.object({
  archetypeId: z.string().min(1),
  name: z.string().min(1).max(32),
  chain: z.enum(['SOLANA', 'BSC', 'BASE']).optional(),
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

// GET /agents/archetypes — list all available archetypes (must be before /:id)
agent.get('/archetypes', async (c) => {
  const archetypes = getAllArchetypes();
  return c.json({ success: true, data: archetypes });
});

// POST /agents — create a new agent
agent.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { archetypeId, name, chain } = createAgentSchema.parse(body);

    const newAgent = await agentService.createAgent(userId, archetypeId, name, chain);

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

// POST /agents/:id/switch — switch active agent, issue new JWT
agent.post('/:id/switch', async (c) => {
  try {
    const user = c.get('user');
    const userId = c.get('userId');
    const agentId = c.req.param('id');

    // Validate agent belongs to user
    const targetAgent = await agentService.getAgent(agentId, userId);

    // Issue new JWT for the target agent (include privyId and wallet for compatibility)
    const { token, refreshToken, expiresIn } = await issueAgentTokens(
      targetAgent.id,
      userId,
      user.privyId,
      user.wallet ?? undefined,
    );

    return c.json({
      success: true,
      data: {
        agent: targetAgent,
        tokens: {
          accessToken: token,
          refreshToken,
        },
        expiresIn,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to switch agent';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

export { agent };
