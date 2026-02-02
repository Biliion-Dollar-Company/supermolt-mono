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
 * Extract signer wallet from transaction accounts
 * The first account in most transactions is the signer
 */
function extractSignerWallet(transaction: any): string | null {
  try {
    // Try different locations where the signer might be
    if (transaction.signer) return transaction.signer;
    if (transaction.signers && transaction.signers.length > 0) {
      return transaction.signers[0];
    }
    if (transaction.accounts && transaction.accounts.length > 0) {
      // First account is typically the signer
      const firstAccount = transaction.accounts[0];
      if (typeof firstAccount === 'string') return firstAccount;
      if (firstAccount.pubkey) return firstAccount.pubkey;
    }
    return null;
  } catch (error) {
    console.error('Failed to extract signer:', error);
    return null;
  }
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

    console.log('Creating trade for agent:', {
      agentId: agent.id,
      pubkey: agentUserId,
      outputToken: swapData.outputMint
    });

    // Get token prices from Birdeye
    const inputPrice = await getTokenPrice(swapData.inputMint);
    const outputPrice = await getTokenPrice(swapData.outputMint);

    // Create paper trade record
    const trade = await db.paperTrade.create({
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

    console.log('✅ Trade record created:', {
      tradeId: trade.id,
      agentId: agent.id,
      tokenMint: swapData.outputMint,
      symbol: outputPrice?.symbol,
      amount: swapData.inputAmount,
      dex: swapData.dex,
      signature: swapData.signature
    });

    // Update agent stats
    await db.tradingAgent.update({
      where: { id: agent.id },
      data: {
        totalTrades: {
          increment: 1
        }
      }
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

    // Extract signer wallet from transaction
    const signerWallet = extractSignerWallet(payload);

    // Parse all swaps from transaction
    const swaps = extractSwapsFromTransaction({
      signature: txSignature,
      timestamp: payload.timestamp,
      instructions: payload.instructions || []
    });

    console.log('Webhook processing:', {
      signature: txSignature.slice(0, 16),
      signer: signerWallet?.slice(0, 8),
      swapsFound: swaps.length,
      dexes: swaps.map(s => s.dex)
    });

    // For each swap found, try to create a trade record
    let tradesCreated = 0;
    for (const swap of swaps) {
      try {
        if (signerWallet) {
          console.log('Creating trade for swap:', {
            dex: swap.dex,
            input: swap.inputMint.slice(0, 8),
            output: swap.outputMint.slice(0, 8),
            amount: swap.inputAmount
          });

          // Create trade record for this agent
          await createTradeRecord(signerWallet, swap);
          tradesCreated++;
        } else {
          console.warn('Could not extract signer from transaction');
        }
      } catch (error) {
        console.error('Failed to process swap:', error);
      }
    }

    // Return success (Helius expects 200 response)
    return c.json({
      success: true,
      message: 'Webhook received',
      txSignature,
      signer: signerWallet ? `${signerWallet.slice(0, 8)}...` : null,
      swapsFound: swaps.length,
      tradesCreated,
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
