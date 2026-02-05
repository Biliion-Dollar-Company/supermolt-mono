import { Hono } from 'hono';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { extractSwapsFromTransaction } from '../lib/swap-parser';
import { getTokenPrice } from '../lib/birdeye';
import { PositionTracker } from '../services/position-tracker';

const db = new PrismaClient();
const positionTracker = new PositionTracker(db);

export const webhooks = new Hono();

/**
 * Map Helius source to our DEX enum
 */
function mapSourceToDex(source: string): 'jupiter' | 'raydium' | 'pump-fun' | 'unknown' {
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('jupiter') || sourceLower.includes('jup')) return 'jupiter';
  if (sourceLower.includes('raydium')) return 'raydium';
  if (sourceLower.includes('pump')) return 'pump-fun';
  return 'unknown';
}

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
 * Helius sends the signer as the first account in various formats
 */
function extractSignerWallet(transaction: any): string | null {
  try {
    // Try different locations where the signer might be
    if (transaction.signer) return transaction.signer;
    if (transaction.signers && transaction.signers.length > 0) {
      return transaction.signers[0];
    }
    
    // Helius format: accountKeys array with pubkey field
    if (transaction.accountKeys && transaction.accountKeys.length > 0) {
      const firstAccount = transaction.accountKeys[0];
      if (typeof firstAccount === 'string') return firstAccount;
      if (firstAccount && typeof firstAccount === 'object') {
        if (firstAccount.pubkey) return firstAccount.pubkey;
        if (firstAccount.signer) return firstAccount.signer;
      }
    }
    
    // Solana format: accounts array
    if (transaction.accounts && transaction.accounts.length > 0) {
      const firstAccount = transaction.accounts[0];
      if (typeof firstAccount === 'string') return firstAccount;
      if (firstAccount && typeof firstAccount === 'object') {
        if (firstAccount.pubkey) return firstAccount.pubkey;
        if (firstAccount.signer) return firstAccount.signer;
      }
    }
    
    // Transaction object with message
    if (transaction.transaction?.message?.accountKeys && transaction.transaction.message.accountKeys.length > 0) {
      const firstAccount = transaction.transaction.message.accountKeys[0];
      if (typeof firstAccount === 'string') return firstAccount;
      if (firstAccount && typeof firstAccount === 'object') {
        if (firstAccount.pubkey) return firstAccount.pubkey;
      }
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
    let agent = await db.tradingAgent.findFirst({
      where: { userId: agentUserId }
    });

    // If agent doesn't exist, AUTO-CREATE it
    if (!agent) {
      try {
        console.log(`🟡 Agent not found for ${agentUserId}, creating...`);
        
        const agentName = `Agent-${agentUserId.slice(0, 6)}`;
        
        agent = await db.tradingAgent.create({
          data: {
            userId: agentUserId,
            archetypeId: 'default-archetype', // Default archetype for webhook-created agents
            name: agentName,
            status: 'ACTIVE',
            totalTrades: 0,
            winRate: 0,
            totalPnl: 0
            // Note: maxDrawdown, score removed - not in schema yet
          }
        });
        
        console.log(`✅ Created new agent:`, {
          agentId: agent.id,
          pubkey: agentUserId,
          name: agentName
        });
      } catch (createError) {
        console.error(`❌ Failed to create agent:`, {
          pubkey: agentUserId,
          error: createError instanceof Error ? createError.message : String(createError)
        });
        throw createError;
      }
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

    // Update position tracking
    try {
      // Determine if this is a BUY or SELL
      // If input is SOL/USDC (common base currencies), it's a BUY
      // If output is SOL/USDC, it's a SELL
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const USDC_MINT = process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet by default
      const isBaseCurrency = (mint: string) => 
        mint === SOL_MINT || mint === USDC_MINT;

      const isBuy = isBaseCurrency(swapData.inputMint);
      const isSell = isBaseCurrency(swapData.outputMint);

      if (isBuy) {
        // Buying token with SOL/USDC
        await positionTracker.onBuy(
          agent.id,
          swapData.outputMint,
          outputPrice?.symbol || 'UNKNOWN',
          outputPrice?.name || 'Unknown',
          swapData.outputAmount,
          outputPrice?.priceUsd || 0
        );
        console.log('✅ [POSITION] Buy position updated');
      } else if (isSell) {
        // Selling token for SOL/USDC
        await positionTracker.onSell(
          agent.id,
          swapData.inputMint,
          swapData.inputAmount,
          inputPrice?.priceUsd || 0
        );
        console.log('✅ [POSITION] Sell position updated');
      } else {
        // Token-to-token swap - treat as sell input, buy output
        console.log('⚠️ [POSITION] Token-to-token swap detected - tracking both sides');
        await positionTracker.onSell(
          agent.id,
          swapData.inputMint,
          swapData.inputAmount,
          inputPrice?.priceUsd || 0
        );
        await positionTracker.onBuy(
          agent.id,
          swapData.outputMint,
          outputPrice?.symbol || 'UNKNOWN',
          outputPrice?.name || 'Unknown',
          swapData.outputAmount,
          outputPrice?.priceUsd || 0
        );
      }
    } catch (positionError) {
      console.error('❌ [POSITION] Failed to update position:', positionError);
      // Don't throw - position tracking shouldn't block trade recording
    }

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

    console.log('🔔 [WEBHOOK] Helius webhook received', {
      hasSignature: !!signature,
      secretConfigured: !!secret && secret !== 'your-helius-webhook-secret-here',
      bodySize: rawBody.length,
      timestamp: new Date().toISOString()
    });
    
    console.log('🚀🚀🚀 NEW CODE DEPLOYED - FEB 3 11:20 AM - ARRAY FORMAT FIX 🚀🚀🚀');

    // Validate webhook signature IF secret is configured
    // If secret is not configured (placeholder), skip validation
    if (secret && secret !== 'your-helius-webhook-secret-here') {
      if (!signature || !validateHeliusSignature(rawBody, signature, secret)) {
        console.warn('❌ [WEBHOOK] Invalid Helius webhook signature - rejecting');
        return c.json({ error: 'Invalid signature' }, 401);
      }
      console.log('✅ [WEBHOOK] Signature validated successfully');
    } else {
      if (!secret) {
        console.warn('⚠️ [WEBHOOK] No secret configured - validation skipped. Set HELIUS_WEBHOOK_SECRET in .env');
      } else {
        console.warn('⚠️ [WEBHOOK] Secret is placeholder - validation skipped');
      }
    }

    // Parse the payload - Helius enhanced webhooks send ARRAY of transactions
    let parsed = JSON.parse(rawBody);
    
    // Normalize to array format (handle both single object and array)
    const transactions = Array.isArray(parsed) ? parsed : [parsed];
    
    console.log('🎯🎯🎯 ARRAY DETECTION:', {
      isArray: Array.isArray(parsed),
      count: transactions.length,
      firstItemKeys: transactions[0] ? Object.keys(transactions[0]).slice(0, 10) : []
    });
    
    console.log('📊 [WEBHOOK] Received transactions:', {
      count: transactions.length,
      isArray: Array.isArray(parsed)
    });

    let totalSwapsFound = 0;
    let totalTradesCreated = 0;
    const allDexes: string[] = [];

    // Process each transaction in the webhook payload
    for (const transaction of transactions) {
      const txSignature = transaction.signature || transaction.tx || 'unknown';

      console.log('📊 [WEBHOOK] Processing transaction:', {
        signature: typeof txSignature === 'string' ? txSignature.slice(0, 16) + '...' : 'unknown',
        type: transaction.type || 'unknown',
        source: transaction.source || 'unknown',
        hasInstructions: !!(transaction.instructions && transaction.instructions.length > 0),
        instructionCount: transaction.instructions?.length || 0
      });

      // Enhanced webhooks have feePayer as signer
      let signerWallet = transaction.feePayer || transaction.signer;
      
      // Fallback: try to extract from accountData or instructions
      if (!signerWallet) {
        signerWallet = extractSignerWallet(transaction);
      }

      if (!signerWallet) {
        console.warn('⚠️ [WEBHOOK] Could not extract signer for transaction:', txSignature);
        continue;
      }

      console.log('👤 [WEBHOOK] Signer wallet:', signerWallet.slice(0, 8) + '...');

      // Check if this is a SWAP transaction (Helius enhanced format tells us)
      if (transaction.type !== 'SWAP') {
        console.log('⏭️ [WEBHOOK] Skipping non-swap transaction:', transaction.type);
        continue;
      }

      // Extract swap info from Helius enhanced data (already parsed!)
      const tokenTransfers = transaction.tokenTransfers || [];
      const source = transaction.source || 'unknown'; // e.g., "JUPITER", "PUMP_AMM", "RAYDIUM"
      
      console.log('💱 [WEBHOOK] Swap detected:', {
        signature: typeof txSignature === 'string' ? txSignature.slice(0, 16) + '...' : 'unknown',
        signer: signerWallet.slice(0, 8) + '...',
        source,
        tokenTransfers: tokenTransfers.length
      });

      // Build swap object from Helius data
      if (tokenTransfers.length > 0) {
        const swap = {
          dex: mapSourceToDex(source),
          inputMint: tokenTransfers[0]?.mint || 'unknown',
          outputMint: tokenTransfers[tokenTransfers.length - 1]?.mint || 'unknown',
          inputAmount: Number(tokenTransfers[0]?.tokenAmount || 0),
          outputAmount: Number(tokenTransfers[tokenTransfers.length - 1]?.tokenAmount || 0),
          signature: txSignature,
          timestamp: transaction.timestamp
        };

        totalSwapsFound += 1;
        allDexes.push(swap.dex);
        try {
          console.log('💱 [WEBHOOK] Creating trade record for swap:', {
            dex: swap.dex,
            input: swap.inputMint.slice(0, 8) + '...',
            output: swap.outputMint.slice(0, 8) + '...',
            inputAmount: swap.inputAmount,
            signature: typeof txSignature === 'string' ? txSignature.slice(0, 16) + '...' : 'unknown'
          });

          // Create trade record for this agent
          await createTradeRecord(signerWallet, swap);
          totalTradesCreated++;
          console.log('✅ [WEBHOOK] Trade record created successfully');
        } catch (error) {
          console.error('❌ [WEBHOOK] Failed to process swap:', error instanceof Error ? error.message : error);
        }
      } else {
        console.warn('⚠️ [WEBHOOK] No token transfers found in swap');
      }
    }

    // Return success (Helius expects 200 response)
    console.log('📤 [WEBHOOK] Returning response:', {
      success: true,
      transactionsProcessed: transactions.length,
      swapsFound: totalSwapsFound,
      tradesCreated: totalTradesCreated
    });

    return c.json({
      success: true,
      message: 'Webhook received',
      transactionsProcessed: transactions.length,
      swapsFound: totalSwapsFound,
      tradesCreated: totalTradesCreated,
      dexes: allDexes
    }, 200);
  } catch (error) {
    console.error('❌ [WEBHOOK] Processing error:', error);
    console.error('❌ [WEBHOOK] Stack trace:', error instanceof Error ? error.stack : 'no stack');
    return c.json({ 
      success: false,
      error: 'Processing failed',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
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
