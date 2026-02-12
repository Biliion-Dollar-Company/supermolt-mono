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
 * GET /arena/conversations/agent/:agentId
 * GET /arena/conversations/:id/messages
 * GET /arena/votes
 * GET /arena/votes/active
 * GET /arena/votes/:id
 */

import { Hono } from 'hono';
import { getLevelName } from '../../services/onboarding.service';
import {
  getLeaderboard,
  getRecentTrades,
  getAllPositions,
  getConversations,
  getConversationMessages,
  getAgentConversations,
  getAllVotes,
  getActiveVotes,
  getVoteDetail,
  getEpochRewards,
  getAgentById,
  getAgentTradesById,
  getAgentPositionsById,
} from './arena.service';
import { db } from '../../lib/db';

const app = new Hono();

// ── Leaderboard ───────────────────────────────────────────

app.get('/leaderboard', async (c) => {
  try {
    const data = await getLeaderboard();
    return c.json(data);
  } catch (error: any) {
    console.error('Arena leaderboard error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load leaderboard' } }, 500);
  }
});

// ── XP Leaderboard ───────────────────────────────────────

app.get('/leaderboard/xp', async (c) => {
  try {
    const agents = await db.tradingAgent.findMany({
      orderBy: { xp: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        displayName: true,
        xp: true,
        level: true,
        totalTrades: true,
      },
    });

    const rankings = agents.map((agent) => ({
      agentId: agent.id,
      name: agent.displayName || agent.name,
      xp: agent.xp,
      level: agent.level,
      levelName: getLevelName(agent.level),
      totalTrades: agent.totalTrades,
    }));

    return c.json({ rankings });
  } catch (error: any) {
    console.error('Arena XP leaderboard error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load XP leaderboard' } }, 500);
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

app.get('/conversations/agent/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const data = await getAgentConversations(agentId);
    return c.json(data);
  } catch (error: any) {
    console.error('Arena agent conversations error:', error);
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

// ── Epoch Rewards ─────────────────────────────────────────

app.get('/epoch/rewards', async (c) => {
  try {
    const data = await getEpochRewards();
    return c.json(data);
  } catch (error: any) {
    console.error('Arena epoch rewards error:', error);
    return c.json({
      epoch: null,
      allocations: [],
      bscAllocations: [],
      treasury: { balance: 0, distributed: 0, available: 0 },
      bscTreasury: { balance: 0, distributed: 0, available: 0 },
      distributions: [],
      bscDistributions: [],
    });
  }
});

// ── Agent Detail (public) ────────────────────────────────

app.get('/agents/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const data = await getAgentById(id);
    if (!data) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } }, 404);
    }
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Arena agent detail error:', error);
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load agent' } }, 500);
  }
});

app.get('/agents/:id/trades', async (c) => {
  try {
    const id = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const data = await getAgentTradesById(id, Math.min(limit, 500));
    return c.json(data);
  } catch (error: any) {
    console.error('Arena agent trades error:', error);
    return c.json({ trades: [] });
  }
});

app.get('/agents/:id/positions', async (c) => {
  try {
    const id = c.req.param('id');
    const data = await getAgentPositionsById(id);
    return c.json(data);
  } catch (error: any) {
    console.error('Arena agent positions error:', error);
    return c.json({ positions: [] });
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
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load vote detail' } }, 500);
  }
});

export default app;
