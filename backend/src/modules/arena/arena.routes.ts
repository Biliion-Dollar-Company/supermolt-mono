/**
 * Arena Routes
 *
 * Public endpoints for the arena page.
 * Mounted at /arena in index.ts.
 *
 * GET /arena/leaderboard
 * GET /arena/trades?limit=N
 * GET /arena/positions
 * GET /arena/conversations
 * GET /arena/conversations/:id/messages
 * GET /arena/votes
 * GET /arena/votes/active
 * GET /arena/votes/:id
 */

import { Hono } from 'hono';
import {
  getLeaderboard,
  getRecentTrades,
  getAllPositions,
  getConversations,
  getConversationMessages,
  getAllVotes,
  getActiveVotes,
  getVoteDetail,
} from './arena.service';

const app = new Hono();

// ── Leaderboard ───────────────────────────────────────────

app.get('/leaderboard', async (c) => {
  try {
    const data = await getLeaderboard();
    return c.json(data);
  } catch (error: any) {
    console.error('Arena leaderboard error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, 500);
  }
});

// ── Trades ────────────────────────────────────────────────

app.get('/trades', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const data = await getRecentTrades(Math.min(limit, 500));
    return c.json(data);
  } catch (error: any) {
    console.error('Arena trades error:', error);
    return c.json({ trades: [] });
  }
});

// ── Positions ─────────────────────────────────────────────

app.get('/positions', async (c) => {
  try {
    const data = await getAllPositions();
    return c.json(data);
  } catch (error: any) {
    console.error('Arena positions error:', error);
    return c.json({ positions: [] });
  }
});

// ── Conversations ─────────────────────────────────────────

app.get('/conversations', async (c) => {
  try {
    const data = await getConversations();
    return c.json(data);
  } catch (error: any) {
    console.error('Arena conversations error:', error);
    return c.json({ conversations: [] });
  }
});

app.get('/conversations/:id/messages', async (c) => {
  try {
    const id = c.req.param('id');
    const data = await getConversationMessages(id);
    if (!data) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
    }
    return c.json(data);
  } catch (error: any) {
    console.error('Arena messages error:', error);
    return c.json({ messages: [] });
  }
});

// ── Votes ─────────────────────────────────────────────────
// IMPORTANT: /votes/active must come BEFORE /votes/:id to avoid
// "active" being captured as an :id parameter.

app.get('/votes/active', async (c) => {
  try {
    const data = await getActiveVotes();
    return c.json(data);
  } catch (error: any) {
    console.error('Arena active votes error:', error);
    return c.json({ votes: [] });
  }
});

app.get('/votes', async (c) => {
  try {
    const data = await getAllVotes();
    return c.json(data);
  } catch (error: any) {
    console.error('Arena all votes error:', error);
    return c.json({ votes: [] });
  }
});

app.get('/votes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const data = await getVoteDetail(id);
    if (!data) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Vote not found' } }, 404);
    }
    return c.json(data);
  } catch (error: any) {
    console.error('Arena vote detail error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, 500);
  }
});

export default app;
