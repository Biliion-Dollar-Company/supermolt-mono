import { Hono } from 'hono';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { extractSwapsFromTransaction } from '../lib/swap-parser';
import { getTokenPrice } from '../lib/birdeye';

const db = new PrismaClient();

export const webhooks = new Hono();

/**
 * Validate Helius webhook signature
 * Helius sends HMAC-SHA256 signature in X-Helius-Signature header
 */
function validateHeliusSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

/**
 * Create trade record in database
 */
async function createTradeRecord(
  agentUserId: string,
  swapData: any
): Promise<void> {
  try {
    // Find the agent by userId (pubkey)
    const agent = await db.tradingAgent.findFirst({
      where: { userId: agentUserId }
    });

    if (!agent) {
      console.warn(`Agent not found for userId: ${agentUserId}`);
      return;
    }

    // Get token prices from Birdeye
    const inputPrice = await getTokenPrice(swapData.inputMint);
    const outputPrice = await getTokenPrice(swapData.outputMint);

    // Create paper trade record
    await db.paperTrade.create({
      data: {
        agentId: agent.id,
        tokenMint: swapData.outputMint,
        tokenSymbol: outputPrice?.symbol || 'UNKNOWN',
        tokenName: outputPrice?.name || 'Unknown',
        action: 'BUY', // Simplified - could detect BUY vs SELL from input/output
        entryPrice: inputPrice?.priceUsd || 0,
        amount: swapData.inputAmount || 0,
        tokenAmount: swapData.outputAmount,
        marketCap: outputPrice?.marketCap,
        liquidity: outputPrice?.liquidity,
        metadata: {
          dex: swapData.dex,
          signature: swapData.signature,
          inputMint: swapData.inputMint,
          outputMint: swapData.outputMint,
          source: 'helius-webhook'
        },
        signalSource: swapData.dex || 'unknown',
        confidence: 100
      }
    });

    console.log('Trade record created:', {
      agentId: agent.id,
      tokenMint: swapData.outputMint,
      amount: swapData.inputAmount,
      dex: swapData.dex
    });
  } catch (error) {
    console.error('Failed to create trade record:', error);
  }
}

/**
 * POST /webhooks/solana
 * Helius webhook endpoint for Solana transactions
 *
 * Expected payload:
 * {
 *   "transaction": { ...tx data... },
 *   "timestamp": "2026-02-02T11:00:00Z",
 *   "signature": "...",
 * }
 */
webhooks.post('/solana', async (c) => {
  try {
    // Get the raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.req.header('X-Helius-Signature');
    const secret = process.env.HELIUS_WEBHOOK_SECRET || '';

    // Validate webhook signature
    if (!signature || !validateHeliusSignature(rawBody, signature, secret)) {
      console.warn('Invalid Helius webhook signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);

    console.log('Received Helius webhook:', {
      signature: payload.signature?.slice(0, 20),
      timestamp: payload.timestamp,
      instructionCount: payload.instructions?.length || 0
    });

    // Extract transaction details
    const txSignature = payload.signature;

    // Parse all swaps from transaction
    const swaps = extractSwapsFromTransaction({
      signature: txSignature,
      timestamp: payload.timestamp,
      instructions: payload.instructions || []
    });

    console.log('Extracted swaps:', {
      count: swaps.length,
      dexes: swaps.map(s => s.dex)
    });

    // For each swap found, try to create a trade record
    // In production, we'd identify which agent this is by wallet address
    // For now, we'll just log the swap data
    for (const swap of swaps) {
      try {
        console.log('Processing swap:', {
          dex: swap.dex,
          input: swap.inputMint.slice(0, 8),
          output: swap.outputMint.slice(0, 8),
          amount: swap.inputAmount
        });

        // TODO: Extract wallet address from transaction to identify agent
        // Once we have the agent's wallet, we can create the trade record:
        // await createTradeRecord(agentWallet, swap);
      } catch (error) {
        console.error('Failed to process swap:', error);
      }
    }

    // Return success (Helius expects 200 response)
    return c.json({
      success: true,
      message: 'Webhook received',
      txSignature,
      swapsFound: swaps.length,
      dexes: swaps.map(s => s.dex)
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

/**
 * GET /webhooks/health
 * Health check endpoint
 */
webhooks.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'Helius Webhook Handler',
    timestamp: new Date().toISOString()
  });
});
