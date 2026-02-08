/**
 * Copy-Trade Routes
 * POST /trades/copy — execute a copy-trade
 * GET /trades/copy — list user's copy-trades
 * GET /trades/copy/:id — get single copy-trade details
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { db } from '../lib/db';

const copyTrade = new Hono();

const copyTradeSchema = z.object({
  sourceAgentPubkey: z.string(),
  sourceActivityId: z.string(),
  userPubkey: z.string(),
  userAmount: z.string(), // SOL amount to allocate
});

/**
 * POST /trades/copy
 * Execute a copy-trade (mirror an agent's trade)
 * 
 * Body:
 * {
 *   sourceAgentPubkey: string,
 *   sourceActivityId: string,
 *   userPubkey: string,
 *   userAmount: string (decimal string)
 * }
 */
copyTrade.post('/copy', async (c) => {
  try {
    const body = await c.req.json();
    const { sourceAgentPubkey, sourceActivityId, userPubkey, userAmount } =
      copyTradeSchema.parse(body);

    // Find the source activity
    const sourceActivity = await db.feedActivity.findUnique({
      where: { id: sourceActivityId },
    });

    if (!sourceActivity) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Source activity not found' } },
        404
      );
    }

    // Verify agent pubkey matches
    if (sourceActivity.agentId !== sourceAgentPubkey) {
      return c.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Agent mismatch' } },
        400
      );
    }

    // Create copy-trade record
    const copyTradeRecord = await db.copyTrade.create({
      data: {
        userPubkey,
        agentId: sourceAgentPubkey,
        sourceFeedId: sourceActivityId,
        userAmount: parseFloat(userAmount),
        status: 'PENDING', // Will transition to EXECUTED after onchain confirmation
      },
    });

    // TODO: Build Jupiter swap instruction, get user to sign, execute onchain
    // For now, return the copy-trade ID for client to handle

    return c.json(
      {
        success: true,
        data: {
          copyTradeId: copyTradeRecord.id,
          status: 'PENDING',
          userAmount: parseFloat(userAmount),
          sourceAgentPubkey,
          sourceToken: sourceActivity.tokenSymbol,
          // Next step: client signs + executes Jupiter swap
          message: 'Copy-trade created. Ready for Jupiter swap execution.',
        },
      },
      201
    );
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
    console.error('Copy-trade error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create copy-trade' } },
      500
    );
  }
});

/**
 * GET /trades/copy
 * List user's copy-trades
 */
copyTrade.get('/copy', async (c) => {
  try {
    const userPubkey = c.req.query('userPubkey');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    if (!userPubkey) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_PARAM', message: 'userPubkey query parameter required' },
        },
        400
      );
    }

    const copyTrades = await db.copyTrade.findMany({
      where: { userPubkey },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      success: true,
      data: {
        trades: copyTrades.map((trade) => ({
          id: trade.id,
          agentId: trade.agentId,
          userAmount: parseFloat(trade.userAmount.toString()),
          status: trade.status,
          txSignature: trade.txSignature,
          executedAt: trade.executedAt,
          createdAt: trade.createdAt,
        })),
        total: await db.copyTrade.count({ where: { userPubkey } }),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('List copy-trades error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list copy-trades' } },
      500
    );
  }
});

/**
 * GET /trades/copy/:id
 * Get single copy-trade details
 */
copyTrade.get('/copy/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const copyTradeRecord = await db.copyTrade.findUnique({
      where: { id },
    });

    if (!copyTradeRecord) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Copy-trade not found' } },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        id: copyTradeRecord.id,
        agentId: copyTradeRecord.agentId,
        userPubkey: copyTradeRecord.userPubkey,
        userAmount: parseFloat(copyTradeRecord.userAmount.toString()),
        status: copyTradeRecord.status,
        txSignature: copyTradeRecord.txSignature,
        errorMessage: copyTradeRecord.errorMessage,
        createdAt: copyTradeRecord.createdAt,
        executedAt: copyTradeRecord.executedAt,
      },
    });
  } catch (error) {
    console.error('Get copy-trade error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch copy-trade' } },
      500
    );
  }
});

/**
 * POST /trades/copy/:id/confirm
 * Confirm a copy-trade (after Jupiter execution)
 *
 * Body:
 * {
 *   txSignature: string,
 *   status: 'EXECUTED' | 'FAILED'
 * }
 */
copyTrade.post('/copy/:id/confirm', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { txSignature, status, errorMessage } = body as {
      txSignature?: string;
      status: 'EXECUTED' | 'FAILED';
      errorMessage?: string;
    };

    const copyTradeRecord = await db.copyTrade.update({
      where: { id },
      data: {
        status,
        txSignature: txSignature || null,
        errorMessage: errorMessage || null,
        executedAt: status === 'EXECUTED' ? new Date() : null,
      },
    });

    return c.json({
      success: true,
      data: {
        id: copyTradeRecord.id,
        status: copyTradeRecord.status,
        message: `Copy-trade ${status.toLowerCase()}`,
      },
    });
  } catch (error) {
    console.error('Confirm copy-trade error:', error);
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to confirm copy-trade' } },
      500
    );
  }
});

export { copyTrade };
