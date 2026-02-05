/**
 * Position Routes
 * GET /positions/agents/:wallet/positions - Get agent's current holdings
 * GET /positions/all - Get all agents' positions (for coordination)
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { PositionTracker } from '../services/position-tracker';

const positions = new Hono();
const db = new PrismaClient();
const positionTracker = new PositionTracker(db);

/**
 * GET /positions/agents/:wallet/positions
 * Returns current holdings for a specific agent
 */
positions.get('/agents/:wallet/positions', async (c) => {
  try {
    const wallet = c.req.param('wallet');

    // Find agent by userId (wallet pubkey)
    const agent = await db.tradingAgent.findFirst({
      where: { userId: wallet },
    });

    if (!agent) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Agent not found' },
        },
        404
      );
    }

    const positions = await positionTracker.getAgentPositions(agent.id);

    return c.json({
      success: true,
      data: {
        agentId: agent.id,
        wallet: agent.userId,
        positions: positions.map((pos) => ({
          token: pos.tokenSymbol,
          tokenMint: pos.tokenMint,
          tokenName: pos.tokenName,
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          currentValue: pos.currentValue,
          pnl: pos.pnl,
          pnlPercent: pos.pnlPercent,
          openedAt: pos.openedAt,
          updatedAt: pos.updatedAt,
        })),
        totalPositions: positions.length,
      },
    });
  } catch (error) {
    console.error('Get agent positions error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch positions' },
      },
      500
    );
  }
});

/**
 * GET /positions/all
 * Returns all agents' positions (for coordination)
 */
positions.get('/all', async (c) => {
  try {
    const allPositions = await positionTracker.getAllPositions();

    // Group by agent
    const positionsByAgent = new Map<string, any[]>();

    for (const pos of allPositions) {
      if (!positionsByAgent.has(pos.agentId)) {
        positionsByAgent.set(pos.agentId, []);
      }
      positionsByAgent.get(pos.agentId)!.push({
        token: pos.tokenSymbol,
        tokenMint: pos.tokenMint,
        tokenName: pos.tokenName,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        currentValue: pos.currentValue,
        pnl: pos.pnl,
        pnlPercent: pos.pnlPercent,
        openedAt: pos.openedAt,
        updatedAt: pos.updatedAt,
      });
    }

    // Get agent details
    const agentIds = Array.from(positionsByAgent.keys());
    const agents = await db.tradingAgent.findMany({
      where: { id: { in: agentIds } },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    // Build response
    const result = Array.from(positionsByAgent.entries()).map(([agentId, positions]) => {
      const agent = agentMap.get(agentId);
      return {
        agentId,
        agentName: agent?.name || 'Unknown',
        wallet: agent?.userId || 'Unknown',
        positions,
        totalPositions: positions.length,
      };
    });

    return c.json({
      success: true,
      data: {
        agents: result,
        totalAgents: result.length,
        totalPositions: allPositions.length,
      },
    });
  } catch (error) {
    console.error('Get all positions error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch positions' },
      },
      500
    );
  }
});

export { positions };
