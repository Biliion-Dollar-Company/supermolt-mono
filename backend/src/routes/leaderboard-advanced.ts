/**
 * Advanced Leaderboard Routes
 * Real-time rankings with comprehensive metrics
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { createLeaderboardService } from '../services/leaderboard-ranking';
import { websocketEvents } from '../services/websocket-events';

export function createLeaderboardAdvanced(db: PrismaClient) {
  const routes = new Hono();
  const rankingService = createLeaderboardService(db);

  /**
   * GET /leaderboard-advanced?limit=100&sort=sortino
   * Returns ranked agents with full metrics
   */
  routes.get('/', async (c) => {
    try {
      const limit = Math.min(Number(c.req.query('limit')) || 100, 1000);
      const sort = c.req.query('sort') || 'score'; // score, sortino, winRate, pnl

      const ranked = await rankingService.rankAllAgents();

      // Sort by requested metric
      if (sort === 'sortino') {
        ranked.sort((a, b) => b.sortino - a.sortino);
      } else if (sort === 'winRate') {
        ranked.sort((a, b) => b.winRate - a.winRate);
      } else if (sort === 'pnl') {
        ranked.sort((a, b) => b.totalPnL - a.totalPnL);
      }
      // Default to score

      const formatted = ranked.slice(0, limit).map((m) => rankingService.formatMetrics(m));

      return c.json({
        success: true,
        data: {
          count: formatted.length,
          agents: formatted,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[Leaderboard Advanced] Error:', error);
      return c.json(
        {
          success: false,
          error: { message: error.message },
        },
        { status: 500 }
      );
    }
  });

  /**
   * GET /leaderboard-advanced/:agentId
   * Returns detailed metrics for single agent
   */
  routes.get('/:agentId', async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const metrics = await rankingService.calculateAgentMetrics(agentId);

      if (!metrics) {
        return c.json(
          {
            success: false,
            error: { message: 'Agent not found' },
          },
          { status: 404 }
        );
      }

      // Get rank by calculating all
      const ranked = await rankingService.rankAllAgents();
      const agent = ranked.find((m) => m.agentId === agentId);

      return c.json({
        success: true,
        data: rankingService.formatMetrics(agent || metrics),
      });
    } catch (error: any) {
      console.error('[Leaderboard Advanced] Error:', error);
      return c.json(
        {
          success: false,
          error: { message: error.message },
        },
        { status: 500 }
      );
    }
  });

  /**
   * GET /leaderboard-advanced/stats/summary
   * Returns aggregate statistics
   */
  routes.get('/stats/summary', async (c) => {
    try {
      const ranked = await rankingService.rankAllAgents();

      if (ranked.length === 0) {
        return c.json({
          success: true,
          data: {
            totalAgents: 0,
            avgWinRate: 0,
            avgSortino: 0,
            topAgentScore: 0,
            totalTrades: 0,
            totalPnL: 0,
          },
        });
      }

      const avgWinRate = ranked.reduce((sum, m) => sum + m.winRate, 0) / ranked.length;
      const avgSortino = ranked.reduce((sum, m) => sum + m.sortino, 0) / ranked.length;
      const totalTrades = ranked.reduce((sum, m) => sum + m.trades, 0);
      const totalPnL = ranked.reduce((sum, m) => sum + m.totalPnL, 0);

      return c.json({
        success: true,
        data: {
          totalAgents: ranked.length,
          activeAgents: ranked.filter((m) => m.status === 'ACTIVE').length,
          avgWinRate: parseFloat((avgWinRate * 100).toFixed(2)),
          avgSortino: parseFloat(avgSortino.toFixed(2)),
          topAgentScore: parseFloat(ranked[0]?.score.toFixed(2) || '0'),
          totalTrades,
          totalPnL: parseFloat(totalPnL.toFixed(4)),
          topAgents: ranked.slice(0, 10).map((m) => ({
            rank: m.rank,
            name: m.name,
            score: parseFloat(m.score.toFixed(2)),
            sortino: parseFloat(m.sortino.toFixed(2)),
            trades: m.trades,
            winRate: parseFloat((m.winRate * 100).toFixed(1)),
          })),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[Leaderboard Stats] Error:', error);
      return c.json(
        {
          success: false,
          error: { message: error.message },
        },
        { status: 500 }
      );
    }
  });

  /**
   * POST /leaderboard-advanced/broadcast/:agentId
   * Broadcast update for specific agent (admin only)
   */
  routes.post('/broadcast/:agentId', async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const metrics = await rankingService.calculateAgentMetrics(agentId);

      if (!metrics) {
        return c.json(
          {
            success: false,
            error: { message: 'Agent not found' },
          },
          { status: 404 }
        );
      }

      // Broadcast via WebSocket
      websocketEvents.broadcastLeaderboardUpdate({
        agentId: metrics.agentId,
        rank: metrics.rank,
        sortino: metrics.sortino,
        pnl: metrics.totalPnL,
      });

      return c.json({
        success: true,
        data: { message: 'Update broadcast' },
      });
    } catch (error: any) {
      console.error('[Leaderboard Broadcast] Error:', error);
      return c.json(
        {
          success: false,
          error: { message: error.message },
        },
        { status: 500 }
      );
    }
  });

  /**
   * GET /leaderboard-advanced/websocket/info
   * Returns WebSocket connection info
   */
  routes.get('/websocket/info', async (c) => {
    return c.json({
      success: true,
      data: {
        connectedClients: websocketEvents.getConnectedClientsCount(),
        activeRooms: websocketEvents.getActiveRooms(),
        supportedEvents: [
          'agent:activity',
          'leaderboard:update',
          'price:update',
          'signal:alert',
        ],
      },
    });
  });

  return routes;
}
