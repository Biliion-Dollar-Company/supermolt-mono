/**
 * Tasks Routes
 *
 * Public endpoints for arena task queries.
 * Mounted at /arena/tasks in index.ts.
 *
 * GET /arena/tasks                    -> List tasks (?tokenMint=, ?status=, ?limit=)
 * GET /arena/tasks/leaderboard        -> XP rankings by agent
 * GET /arena/tasks/stats              -> Task summary stats
 * GET /arena/tasks/token/:tokenMint   -> Tasks for a specific token
 * GET /arena/tasks/agent/:agentId     -> Completions for an agent
 * GET /arena/tasks/:taskId            -> Single task with completions
 */

import { Hono } from 'hono';
import {
  listTasks,
  getTasksForToken,
  getAgentCompletions,
  getTaskDetail,
  getTaskLeaderboard,
  getTaskStats,
} from './tasks.service';

const app = new Hono();

// Task stats (must come before /:taskId)
app.get('/stats', async (c) => {
  try {
    const stats = await getTaskStats();
    return c.json(stats);
  } catch (error: any) {
    console.error('Task stats error:', error);
    return c.json({ total: 0, active: 0, completed: 0, expired: 0, totalXPAwarded: 0 });
  }
});

// XP leaderboard (must come before /:taskId)
app.get('/leaderboard', async (c) => {
  try {
    const leaderboard = await getTaskLeaderboard();
    return c.json({ leaderboard });
  } catch (error: any) {
    console.error('Task leaderboard error:', error);
    return c.json({ leaderboard: [] });
  }
});

// Tasks for a specific token (must come before /:taskId)
app.get('/token/:tokenMint', async (c) => {
  try {
    const tokenMint = c.req.param('tokenMint');
    const tasks = await getTasksForToken(tokenMint);
    return c.json({ tasks });
  } catch (error: any) {
    console.error('Tasks by token error:', error);
    return c.json({ tasks: [] });
  }
});

// Completions for an agent (must come before /:taskId)
app.get('/agent/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const completions = await getAgentCompletions(agentId);
    return c.json({ completions });
  } catch (error: any) {
    console.error('Agent completions error:', error);
    return c.json({ completions: [] });
  }
});

// List tasks with optional filters
app.get('/', async (c) => {
  try {
    const tokenMint = c.req.query('tokenMint') || undefined;
    const status = c.req.query('status') || undefined;
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const tasks = await listTasks({ tokenMint, status, limit: Math.min(limit, 200) });
    return c.json({ tasks });
  } catch (error: any) {
    console.error('List tasks error:', error);
    return c.json({ tasks: [] });
  }
});

// Single task detail
app.get('/:taskId', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    const task = await getTaskDetail(taskId);
    if (!task) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
    }
    return c.json({ task });
  } catch (error: any) {
    console.error('Task detail error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, 500);
  }
});

export default app;
