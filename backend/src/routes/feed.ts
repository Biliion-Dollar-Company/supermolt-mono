/**
 * Feed Routes - Leaderboard & Activity Feed
 * GET /feed/trending — get trending tokens
 * GET /feed/leaderboard — get agent leaderboard (sorted by Sortino)
 * GET /feed/agents/{pubkey}/stats — get agent stats
 * GET /feed/activity — get recent activity
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const feed = new Hono();
const db = new PrismaClient();

// Leaderboard entry (agent + stats)
interface LeaderboardEntry {
  agentId: string;
  pubkey: string;
  name: string;
  status: string;
  sortinoRatio: number;
  winRate: number;
  maxDrawdown: number;
  totalPnl: number;
  totalTrades: number;
  rank: number;
}

/**
 * GET /feed/leaderboard
 * Returns all agents ranked by Sortino Ratio (descending)
 */
feed.get('/leaderboard', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Get agents with their stats, sorted by Sortino
    const agents = await db.tradingAgent.findMany({
      include: {
        // Will join with agent_stats if we add the relation
      },
      take: limit,
      skip: offset,
      orderBy: {
        totalPnl: 'desc', // TODO: replace with sortino_ratio when AgentStats is linked
      },
    });

    // Map to leaderboard format with rankings
    const leaderboard: LeaderboardEntry[] = agents.map((agent, index) => ({
      agentId: agent.id,
      pubkey: agent.userId,
      name: agent.name,
      status: agent.status,
      sortinoRatio: 0, // TODO: fetch from AgentStats table
      winRate: parseFloat(agent.winRate.toString()),
      maxDrawdown: 0, // TODO: calculate or fetch
      totalPnl: parseFloat(agent.totalPnl.toString()),
      totalTrades: agent.totalTrades,
      rank: offset + index + 1,
    }));

    return c.json({
      success: true,
      data: {
        leaderboard,
        total: await db.tradingAgent.count(),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch leaderboard' } },
      500
    );
  }
});

/**
 * GET /feed/trending
 * Returns trending tokens (by volume)
 */
feed.get('/trending', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10', 10);

    // Get most active tokens from feed activities
    const activities = await db.feedActivity.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
      },
      select: {
        tokenMint: true,
        tokenSymbol: true,
        amount: true,
      },
      take: limit,
      orderBy: {
        amount: 'desc',
      },
    });

    const tokenMap = new Map<string, { symbol: string; volume: number }>();

    activities.forEach((activity) => {
      const existing = tokenMap.get(activity.tokenMint);
      const volume = parseFloat(activity.amount.toString());
      tokenMap.set(activity.tokenMint, {
        symbol: activity.tokenSymbol,
        volume: existing ? existing.volume + volume : volume,
      });
    });

    const trending = Array.from(tokenMap.entries())
      .map(([mint, data]) => ({
        mint,
        symbol: data.symbol,
        volume: data.volume,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);

    return c.json({ success: true, data: trending });
  } catch (error) {
    console.error('Trending error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trending' } },
      500
    );
  }
});

/**
 * GET /feed/agents/:pubkey/stats
 * Returns stats for a specific agent
 */
feed.get('/agents/:pubkey/stats', async (c) => {
  try {
    const pubkey = c.req.param('pubkey');

    const agent = await db.tradingAgent.findFirst({
      where: { userId: pubkey },
      include: {
        paperTrades: {
          take: 100,
          orderBy: { openedAt: 'desc' },
        },
      },
    });

    if (!agent) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        agentId: agent.id,
        pubkey: agent.userId,
        name: agent.name,
        status: agent.status,
        paperBalance: parseFloat(agent.paperBalance.toString()),
        totalTrades: agent.totalTrades,
        winRate: parseFloat(agent.winRate.toString()),
        totalPnl: parseFloat(agent.totalPnl.toString()),
        recentTrades: agent.paperTrades.map((trade) => ({
          id: trade.id,
          token: trade.tokenSymbol,
          action: trade.action,
          amount: parseFloat(trade.amount.toString()),
          entryPrice: parseFloat(trade.entryPrice.toString()),
          pnl: trade.pnl ? parseFloat(trade.pnl.toString()) : null,
          timestamp: trade.openedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Agent stats error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch agent stats' } },
      500
    );
  }
});

/**
 * GET /feed/activity
 * Returns recent trades/activity
 */
feed.get('/activity', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const activities = await db.feedActivity.findMany({
      take: limit,
      skip: offset,
      orderBy: { timestamp: 'desc' },
    });

    return c.json({
      success: true,
      data: {
        activities: activities.map((activity) => ({
          id: activity.id,
          agentId: activity.agentId,
          action: activity.action,
          token: activity.tokenSymbol,
          amount: parseFloat(activity.amount.toString()),
          pnl: activity.pnl ? parseFloat(activity.pnl.toString()) : null,
          dex: activity.dex,
          timestamp: activity.timestamp,
        })),
        total: await db.feedActivity.count(),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Activity error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity' } },
      500
    );
  }
});

export { feed };
