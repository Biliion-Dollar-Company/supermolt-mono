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
import { createSortinoService } from '../services/sortino.service';

const feed = new Hono();
const db = new PrismaClient();
const sortinoService = createSortinoService(db);

// Leaderboard entry (agent + stats)
interface LeaderboardEntry {
  agentId: string;
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

    // Get leaderboard from Sortino service
    const metrics = await sortinoService.getLeaderboard(limit);

    // Map to leaderboard format with rankings
    const leaderboard: LeaderboardEntry[] = metrics.map((m, index) => ({
      agentId: m.agentId,
      sortinoRatio: m.sortinoRatio,
      winRate: m.winRate,
      maxDrawdown: m.maxDrawdown,
      totalPnl: m.totalPnl,
      totalTrades: m.totalTrades,
      rank: index + 1,
    }));

    return c.json({
      success: true,
      data: {
        leaderboard,
        total: leaderboard.length,
        timestamp: new Date().toISOString(),
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
 * GET /feed/agents/:agentId/stats
 * Returns stats for a specific agent (agentId = pubkey)
 */
feed.get('/agents/:agentId/stats', async (c) => {
  try {
    const agentId = c.req.param('agentId');

    // Get stats from Sortino service
    const stats = await sortinoService.getAgentStats(agentId);

    if (!stats) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } },
        404
      );
    }

    // Get recent trades
    const recentTrades = await db.feedActivity.findMany({
      where: { agentId },
      take: 100,
      orderBy: { timestamp: 'desc' },
    });

    return c.json({
      success: true,
      data: {
        agentId: stats.agentId,
        sortinoRatio: stats.sortinoRatio,
        winRate: stats.winRate,
        maxDrawdown: stats.maxDrawdown,
        totalPnl: stats.totalPnl,
        totalTrades: stats.totalTrades,
        averageReturn: stats.averageReturn,
        recentTrades: recentTrades.map((trade) => ({
          id: trade.id,
          token: trade.tokenSymbol,
          action: trade.action,
          amount: parseFloat(trade.amount.toString()),
          entryPrice: parseFloat(trade.entryPrice.toString()),
          exitPrice: trade.exitPrice ? parseFloat(trade.exitPrice.toString()) : null,
          pnl: trade.pnl ? parseFloat(trade.pnl.toString()) : null,
          pnlPercent: trade.pnlPercent ? parseFloat(trade.pnlPercent.toString()) : null,
          dex: trade.dex,
          timestamp: trade.timestamp,
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
