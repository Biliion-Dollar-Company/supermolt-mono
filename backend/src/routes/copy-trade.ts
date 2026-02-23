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
        status: 'PENDING',
      },
    });

    // Build Jupiter swap transaction for the client to sign
    // Uses the same Jupiter Lite API flow as the auto-buy executor
    const solAmountFloat = parseFloat(userAmount);
    const lamports = Math.floor(solAmountFloat * 1e9);
    const slippageBps = 100; // 1%
    const tokenMint = sourceActivity.tokenMint;
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    let jupiterQuote: Record<string, unknown> | null = null;
    let swapTransaction: string | null = null;
    let jupiterError: string | null = null;

    try {
      // 1. Get Jupiter quote
      const quoteUrl =
        `https://lite-api.jup.ag/swap/v1/quote` +
        `?inputMint=${SOL_MINT}` +
        `&outputMint=${tokenMint}` +
        `&amount=${lamports}` +
        `&slippageBps=${slippageBps}` +
        `&restrictIntermediateTokens=true`;

      const quoteRes = await fetch(quoteUrl, { signal: AbortSignal.timeout(10_000) });
      if (!quoteRes.ok) {
        throw new Error(`Jupiter quote failed (${quoteRes.status}): ${await quoteRes.text()}`);
      }
      jupiterQuote = await quoteRes.json() as Record<string, unknown>;

      // 2. Build swap transaction (unsigned — user signs on client)
      const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: jupiterQuote,
          userPublicKey: userPubkey,
          wrapUnwrapSOL: true,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 100_000,
              priorityLevel: 'low',
            },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!swapRes.ok) {
        throw new Error(`Jupiter swap build failed (${swapRes.status}): ${await swapRes.text()}`);
      }
      const swapData = await swapRes.json() as Record<string, unknown>;
      swapTransaction = swapData.swapTransaction as string;
    } catch (err: any) {
      jupiterError = err.message;
      console.error('[CopyTrade] Jupiter build error:', err.message);
      // Mark record as failed if we cannot build the swap
      await db.copyTrade.update({
        where: { id: copyTradeRecord.id },
        data: { status: 'FAILED', errorMessage: jupiterError },
      });
    }

    if (jupiterError || !swapTransaction) {
      return c.json(
        {
          success: false,
          error: {
            code: 'JUPITER_ERROR',
            message: jupiterError || 'Failed to build swap transaction',
          },
        },
        502
      );
    }

    return c.json(
      {
        success: true,
        data: {
          copyTradeId: copyTradeRecord.id,
          status: 'PENDING',
          userAmount: solAmountFloat,
          sourceAgentPubkey,
          sourceToken: sourceActivity.tokenSymbol,
          tokenMint,
          // Base64-encoded VersionedTransaction for the client to sign and broadcast
          swapTransaction,
          // Estimated output from Jupiter quote
          estimatedOutput: jupiterQuote
            ? (jupiterQuote as any).outAmount
            : null,
          message: 'Copy-trade ready. Sign swapTransaction and POST to /trades/copy/:id/confirm.',
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
