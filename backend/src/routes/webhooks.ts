import { Hono } from 'hono';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { extractSwapsFromTransaction } from '../lib/swap-parser';
import { getTokenPrice } from '../lib/birdeye';
import { PositionTracker } from '../services/position-tracker';
import { isSuperRouter, handleSuperRouterTrade } from '../services/superrouter-observer';
import { closePaperTrade } from '../services/trade.service';

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

// ── Constants for BUY/SELL detection ─────────────────────

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const isBaseCurrency = (mint: string) => mint === SOL_MINT || mint === USDC_MINT;

/**
 * Create AgentTrade record (real on-chain trade with signature).
 * Silently skips duplicates (P2002 = unique constraint on signature).
 */
async function safeCreateAgentTrade(agentId: string, data: {
  tokenMint: string; tokenSymbol: string; tokenName: string;
  action: string; tokenAmount: number; solAmount: number; signature: string;
}) {
  try {
    await db.agentTrade.create({ data: { agentId, ...data } });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      console.log(`[AGENT_TRADE] Duplicate sig ${data.signature.slice(0, 16)}... — skipped`);
    } else {
      console.error('[AGENT_TRADE] Failed to create:', e);
    }
  }
}

/**
 * Close all OPEN PaperTrades for an agent+token when the position is fully exited.
 * Distributes sale proceeds proportionally across trades by cost basis.
 * Uses closePaperTrade() for atomic agent stats recalculation.
 */
async function closeMatchingPaperTrades(
  agentId: string,
  tokenMint: string,
  solReceived: number,
  currentSolPrice: number
) {
  const openTrades = await db.paperTrade.findMany({
    where: { agentId, tokenMint, status: 'OPEN' },
    orderBy: { openedAt: 'asc' },
  });

  if (openTrades.length === 0) {
    console.log(`[PNL] No OPEN PaperTrades found for ${tokenMint.slice(0, 8)}... — skipping`);
    return;
  }

  console.log(`[PNL] Closing ${openTrades.length} PaperTrades for ${tokenMint.slice(0, 8)}...`);

  // Calculate total cost basis across all open trades for proportional split
  const totalCostBasis = openTrades.reduce((sum, t) => {
    const solSpent = parseFloat(t.amount.toString());
    const solPriceAtBuy = parseFloat(t.entryPrice.toString());
    return sum + solSpent * solPriceAtBuy;
  }, 0);

  for (const trade of openTrades) {
    const solSpent = parseFloat(trade.amount.toString());
    const solPriceAtBuy = parseFloat(trade.entryPrice.toString());
    const costBasisUSD = solSpent * solPriceAtBuy;

    let pnl = 0;
    let pnlPercent = 0;
    const exitPrice = currentSolPrice;

    if (costBasisUSD > 0 && solReceived > 0 && currentSolPrice > 0 && totalCostBasis > 0) {
      const share = costBasisUSD / totalCostBasis;
      const proceedsUSD = solReceived * currentSolPrice * share;
      pnl = proceedsUSD - costBasisUSD;
      pnlPercent = (pnl / costBasisUSD) * 100;
    }

    try {
      await closePaperTrade({ tradeId: trade.id, exitPrice, pnl, pnlPercent });
      console.log(`  [PNL] Closed ${trade.id.slice(0, 8)}: PnL $${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%)`);
    } catch (e) {
      console.error(`  [PNL] Failed to close trade ${trade.id}:`, e);
    }
  }
}

/**
 * Create trade record in database.
 * Detects BUY vs SELL from base-currency check, creates proper PaperTrade + AgentTrade,
 * and closes PaperTrades with PnL when positions fully exit.
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
        console.log(`[AGENT] Not found for ${agentUserId}, creating...`);
        const agentName = `Agent-${agentUserId.slice(0, 6)}`;
        agent = await db.tradingAgent.create({
          data: {
            userId: agentUserId,
            archetypeId: 'default-archetype',
            name: agentName,
            status: 'ACTIVE',
            totalTrades: 0,
            winRate: 0,
            totalPnl: 0
          }
        });
        console.log(`[AGENT] Created: ${agent.id} for ${agentUserId.slice(0, 8)}...`);
      } catch (createError) {
        console.error(`[AGENT] Failed to create for ${agentUserId}:`, createError instanceof Error ? createError.message : String(createError));
        throw createError;
      }
    }

    // Get token prices from Birdeye
    const inputPrice = await getTokenPrice(swapData.inputMint);
    const outputPrice = await getTokenPrice(swapData.outputMint);

    // Detect BUY vs SELL
    const isBuy = isBaseCurrency(swapData.inputMint);
    const isSell = isBaseCurrency(swapData.outputMint);

    if (isBuy) {
      // ── BUY: SOL/USDC → Token ──────────────────────────
      const tokenMint = swapData.outputMint;
      const tokenSymbol = outputPrice?.symbol || 'UNKNOWN';
      const tokenName = outputPrice?.name || 'Unknown';

      console.log(`[TRADE] BUY ${tokenSymbol} for agent ${agent.id.slice(0, 8)}...`);

      // Create OPEN PaperTrade
      await db.paperTrade.create({
        data: {
          agentId: agent.id,
          tokenMint,
          tokenSymbol,
          tokenName,
          action: 'BUY',
          entryPrice: inputPrice?.priceUsd || 0,   // SOL price USD at buy time
          amount: swapData.inputAmount || 0,         // SOL spent
          tokenAmount: swapData.outputAmount,        // Tokens received
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
          confidence: 100,
        }
      });

      // Create AgentTrade (real on-chain record)
      await safeCreateAgentTrade(agent.id, {
        tokenMint,
        tokenSymbol,
        tokenName,
        action: 'BUY',
        tokenAmount: swapData.outputAmount || 0,
        solAmount: swapData.inputAmount || 0,
        signature: swapData.signature,
      });

      // Update position
      await positionTracker.onBuy(
        agent.id, tokenMint, tokenSymbol, tokenName,
        swapData.outputAmount, outputPrice?.priceUsd || 0
      );

      console.log(`[TRADE] BUY recorded: ${swapData.inputAmount} SOL → ${swapData.outputAmount} ${tokenSymbol}`);

    } else if (isSell) {
      // ── SELL: Token → SOL/USDC ─────────────────────────
      const tokenMint = swapData.inputMint;
      const tokenSymbol = inputPrice?.symbol || 'UNKNOWN';
      const tokenName = inputPrice?.name || 'Unknown';
      const solReceived = swapData.outputAmount || 0;
      const currentSolPrice = outputPrice?.priceUsd || 0;

      console.log(`[TRADE] SELL ${tokenSymbol} for agent ${agent.id.slice(0, 8)}...`);

      // Create AgentTrade
      await safeCreateAgentTrade(agent.id, {
        tokenMint,
        tokenSymbol,
        tokenName,
        action: 'SELL',
        tokenAmount: swapData.inputAmount || 0,
        solAmount: solReceived,
        signature: swapData.signature,
      });

      // Update position FIRST (may delete if fully closed)
      await positionTracker.onSell(
        agent.id, tokenMint, swapData.inputAmount, inputPrice?.priceUsd || 0
      );

      // Check if position is now fully closed
      const positionStillExists = await db.agentPosition.findUnique({
        where: { agentId_tokenMint: { agentId: agent.id, tokenMint } }
      });

      if (!positionStillExists) {
        // Position fully closed — close all OPEN PaperTrades for this token with PnL
        await closeMatchingPaperTrades(agent.id, tokenMint, solReceived, currentSolPrice);
      } else {
        console.log(`[TRADE] Partial sell — position still open for ${tokenMint.slice(0, 8)}...`);
      }

      console.log(`[TRADE] SELL recorded: ${swapData.inputAmount} ${tokenSymbol} → ${solReceived} SOL`);

    } else {
      // ── Token-to-Token: Token A → Token B ──────────────
      const inputMint = swapData.inputMint;
      const outputMint = swapData.outputMint;
      const inputSymbol = inputPrice?.symbol || 'UNKNOWN';
      const outputSymbol = outputPrice?.symbol || 'UNKNOWN';
      const outputName = outputPrice?.name || 'Unknown';

      console.log(`[TRADE] Token-to-token: ${inputSymbol} → ${outputSymbol} for agent ${agent.id.slice(0, 8)}...`);

      // Create AgentTrade for the BUY side (output token)
      await safeCreateAgentTrade(agent.id, {
        tokenMint: outputMint,
        tokenSymbol: outputSymbol,
        tokenName: outputName,
        action: 'BUY',
        tokenAmount: swapData.outputAmount || 0,
        solAmount: swapData.inputAmount || 0,
        signature: swapData.signature,
      });

      // Sell side: update position
      await positionTracker.onSell(
        agent.id, inputMint, swapData.inputAmount, inputPrice?.priceUsd || 0
      );

      // Check if input token position is fully closed
      const inputPosExists = await db.agentPosition.findUnique({
        where: { agentId_tokenMint: { agentId: agent.id, tokenMint: inputMint } }
      });
      if (!inputPosExists) {
        // Close PaperTrades for the sold token (no SOL proceeds — token-to-token)
        await closeMatchingPaperTrades(agent.id, inputMint, 0, 0);
      }

      // Buy side: create PaperTrade for output token + update position
      await db.paperTrade.create({
        data: {
          agentId: agent.id,
          tokenMint: outputMint,
          tokenSymbol: outputSymbol,
          tokenName: outputName,
          action: 'BUY',
          entryPrice: outputPrice?.priceUsd || 0,
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
          confidence: 100,
        }
      });

      await positionTracker.onBuy(
        agent.id, outputMint, outputSymbol, outputName,
        swapData.outputAmount, outputPrice?.priceUsd || 0
      );

      console.log(`[TRADE] Token-to-token recorded: ${inputSymbol} → ${outputSymbol}`);
    }
  } catch (error) {
    console.error('[TRADE] Failed to create trade record:', error);
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

      // 🎯 CHECK IF THIS IS SUPERROUTER
      if (isSuperRouter(signerWallet)) {
        console.log('🎯🎯🎯 SUPERROUTER DETECTED! 🎯🎯🎯');
        console.log('Triggering observer agent analysis...');
      }

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

          // 🎯 SUPERROUTER OBSERVER: Trigger analysis if this is SuperRouter
          if (isSuperRouter(signerWallet)) {
            console.log('\n🤖 TRIGGERING OBSERVER AGENT ANALYSIS 🤖\n');
            
            // Determine BUY or SELL action
            const isBuy = swap.inputMint === 'So11111111111111111111111111111111111111112'; // SOL mint
            const action: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';

            // Build trade event for observers
            const tradeEvent = {
              signature: swap.signature,
              walletAddress: signerWallet,
              tokenMint: isBuy ? swap.outputMint : swap.inputMint,
              tokenSymbol: undefined as string | undefined,
              tokenName: undefined as string | undefined,
              action,
              amount: isBuy ? swap.inputAmount : swap.outputAmount,
              timestamp: new Date(swap.timestamp || Date.now())
            };

            // Fire and forget - don't block webhook response
            handleSuperRouterTrade(tradeEvent).catch((err) => {
              console.error('❌ Observer analysis failed:', err);
            });
          }
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
 * POST /webhooks/task-validation
 * Validates agent task submissions from Ponzinomics
 * Called by Ponzinomics gamification API when agent submits proof
 */
webhooks.post('/task-validation', async (c) => {
  try {
    const { taskId, agentId, proof } = await c.req.json();
    
    console.log(`\n📋 Task validation request: ${taskId} from ${agentId.substring(0, 12)}...`);
    
    const { AgentTaskManager } = await import('../services/agent-task-manager.service');
    const taskManager = new AgentTaskManager();
    
    const validation = await taskManager.validateSubmission(taskId, agentId, proof);
    
    return c.json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('❌ Task validation error:', error);
    return c.json(
      { 
        success: false, 
        error: error.message || 'Validation failed'
      },
      500
    );
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
