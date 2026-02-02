import { Hono } from 'hono';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

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
 * Parse Solana transaction and extract swap information
 */
function parseSwapTransaction(
  transaction: any
): {
  fromToken?: string;
  toToken?: string;
  amount?: number;
  swapType?: string;
} | null {
  try {
    // For now, return a basic structure
    // We'll enhance this in Days 5-6 with full swap parser
    return {
      fromToken: undefined,
      toToken: undefined,
      amount: undefined,
      swapType: undefined
    };
  } catch (error) {
    console.error('Failed to parse swap transaction:', error);
    return null;
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
    const instructions = payload.instructions || [];

    // Try to find swap instruction
    let swapFound = false;

    for (const instruction of instructions) {
      // Look for swap instructions (Jupiter, Raydium, Pump.fun, etc.)
      const program = instruction.programId || '';
      const parsed = instruction.parsed || {};

      // Jupiter Program ID: JUP4Fb2cqiRUcaTHdrPC8h2gNsYZgUjCFnJ1r7p7Kho
      // Raydium Program IDs: ...
      // Pump.fun Program ID: ...

      if (program.includes('JUP') || parsed.type === 'swap') {
        swapFound = true;
        console.log('Found swap instruction:', {
          program,
          type: parsed.type
        });

        // Parse swap details
        const swapData = parseSwapTransaction(instruction);

        if (swapData) {
          // TODO: In Days 5-6, we'll query Birdeye for price and create trade record
          console.log('Parsed swap:', swapData);
        }
      }
    }

    if (!swapFound) {
      console.log('No swap instruction found in transaction');
    }

    // Return success (Helius expects 200 response)
    return c.json({
      success: true,
      message: 'Webhook received',
      txSignature,
      swapFound
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
