import { Hono } from 'hono';
import crypto from 'crypto';
import { extractSwapsFromTransaction } from '../lib/swap-parser';
import { getTokenPrice } from '../lib/birdeye';
import { PositionTracker } from '../services/position-tracker';
import { isSuperRouter, handleSuperRouterTrade } from '../services/superrouter-observer';
// closePaperTrade/recalculateAgentStats now handled inline in closePaperTradesForSell $transaction
import { autoCompleteOnboardingTask } from '../services/onboarding.service';
import { evaluateTriggers, type DetectedTrade } from '../services/trigger-engine';
import { webhookQueue } from '../services/webhook-queue.service';
import { agentSignalReactor } from '../services/agent-signal-reactor';
import { db } from '../lib/db';
const positionTracker = new PositionTracker(db);

// ── God wallet cache (refreshed every 5 min) ─────────────
/**
 * God wallets are stored in the DevPrint database (not in our tracked_wallets table).
 * We cache the list from the DevPrint API and use it to detect god wallet swaps.
 */
interface GodWalletEntry {
  address: string;
  label: string | null;
}
let godWalletCache: GodWalletEntry[] = [];
let godWalletCacheExpiry = 0;
const DEVPRINT_BASE_URL = process.env.DEVPRINT_API_URL || 'https://devprint-v2-production.up.railway.app';

async function refreshGodWalletCache(): Promise<void> {
  try {
    const res = await fetch(`${DEVPRINT_BASE_URL}/api/wallets`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const json = await res.json() as any;
    const wallets: any[] = Array.isArray(json) ? json : (json.data?.wallets ?? json.wallets ?? []);
    godWalletCache = wallets
      .filter((w) => w.is_god_wallet || w.isGodWallet)
      .map((w) => ({ address: w.address, label: w.label ?? null }));
    godWalletCacheExpiry = Date.now() + 5 * 60 * 1000; // 5 min TTL
    console.log(`[GodWalletCache] Refreshed: ${godWalletCache.length} god wallets from DevPrint`);
  } catch (err) {
    console.warn('[GodWalletCache] Failed to refresh from DevPrint:', err);
  }
}

async function isGodWallet(address: string): Promise<boolean> {
  if (Date.now() > godWalletCacheExpiry) {
    await refreshGodWalletCache();
  }
  return godWalletCache.some((w) => w.address === address);
}

async function getGodWalletLabel(address: string): Promise<string | null> {
  if (Date.now() > godWalletCacheExpiry) {
    await refreshGodWalletCache();
  }
  return godWalletCache.find((w) => w.address === address)?.label ?? null;
}

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
 * FIFO partial close: close PaperTrades proportionally for any sell (partial or full).
 * Wrapped in a Prisma $transaction so partial failures don't leave inconsistent state.
 * Walks OPEN PaperTrades in FIFO order (oldest first), consuming tokens sold.
 * - Fully consumed trades: closed with PnL
 * - Partially consumed trades: split — original reduced, new CLOSED trade created
 */
async function closePaperTradesForSell(
  agentId: string,
  tokenMint: string,
  tokensSold: number,
  solReceived: number,
  currentSolPrice: number
): Promise<void> {
  if (tokensSold <= 0) {
    console.log(`[PNL] tokensSold is 0 — skipping`);
    return;
  }

  const openTrades = await db.paperTrade.findMany({
    where: { agentId, tokenMint, status: 'OPEN' },
    orderBy: { openedAt: 'asc' },
  });

  if (openTrades.length === 0) {
    console.log(`[PNL] No OPEN PaperTrades found for ${tokenMint.slice(0, 8)}... — skipping`);
    return;
  }

  console.log(`[PNL] FIFO closing ${tokensSold} tokens across ${openTrades.length} PaperTrades for ${tokenMint.slice(0, 8)}...`);

  // Run the entire FIFO close in a single Prisma transaction for atomicity
  await db.$transaction(async (tx) => {
    let remaining = tokensSold;

    for (const trade of openTrades) {
      if (remaining <= 0) break;

      const tradeTokens = parseFloat((trade.tokenAmount ?? 0).toString());
      if (tradeTokens <= 0) continue; // skip junk trades with no token amount

      const tokensToClose = Math.min(remaining, tradeTokens);
      const fraction = tokensToClose / tradeTokens;

      // PnL calculation
      const solSpent = parseFloat(trade.amount.toString());
      const solPriceAtBuy = parseFloat(trade.entryPrice.toString());
      const costBasisUSD = solSpent * fraction * solPriceAtBuy;
      const fractionOfSell = tokensSold > 0 ? tokensToClose / tokensSold : 0;
      const proceedsUSD = solReceived * fractionOfSell * currentSolPrice;
      const pnl = costBasisUSD > 0 ? proceedsUSD - costBasisUSD : 0;
      const pnlPercent = costBasisUSD > 0 ? (pnl / costBasisUSD) * 100 : 0;

      if (fraction >= 0.999) {
        // ── Full close: consume entire PaperTrade ──
        await tx.paperTrade.update({
          where: { id: trade.id },
          data: {
            exitPrice: currentSolPrice,
            pnl,
            pnlPercent,
            status: 'CLOSED',
            closedAt: new Date(),
          },
        });
        console.log(`  [PNL] Fully closed ${trade.id.slice(0, 8)}: PnL $${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%)`);
      } else {
        // ── Partial close: split the PaperTrade ──
        // 1. Reduce original trade to remainder
        const remainderFraction = 1 - fraction;
        await tx.paperTrade.update({
          where: { id: trade.id },
          data: {
            tokenAmount: tradeTokens * remainderFraction,
            amount: solSpent * remainderFraction,
          },
        });

        // 2. Create new CLOSED PaperTrade for the sold portion
        await tx.paperTrade.create({
          data: {
            agentId: trade.agentId,
            tokenMint: trade.tokenMint,
            tokenSymbol: trade.tokenSymbol,
            tokenName: trade.tokenName,
            action: trade.action,
            entryPrice: parseFloat(trade.entryPrice.toString()),
            amount: solSpent * fraction,
            tokenAmount: tokensToClose,
            exitPrice: currentSolPrice,
            pnl,
            pnlPercent,
            status: 'CLOSED',
            closedAt: new Date(),
            openedAt: trade.openedAt,
            signalSource: trade.signalSource,
            confidence: trade.confidence,
            marketCap: trade.marketCap ? parseFloat(trade.marketCap.toString()) : null,
            liquidity: trade.liquidity ? parseFloat(trade.liquidity.toString()) : null,
            metadata: (trade.metadata ?? {}) as Record<string, string | number | boolean | null>,
          },
        });

        console.log(`  [PNL] Split ${trade.id.slice(0, 8)}: closed ${tokensToClose.toFixed(2)} tokens, PnL $${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%), ${(tradeTokens * remainderFraction).toFixed(2)} remaining`);
      }

      remaining -= tokensToClose;
    }

    // Recalculate agent stats once at the end of the transaction
    const closedTradeFilter = { agentId, status: 'CLOSED' as const };
    const stats = await tx.paperTrade.aggregate({
      where: closedTradeFilter,
      _count: true,
      _sum: { pnl: true },
    });
    const winCount = await tx.paperTrade.count({
      where: { ...closedTradeFilter, pnl: { gt: 0 } },
    });
    const totalTrades = stats._count;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    await tx.tradingAgent.update({
      where: { id: agentId },
      data: {
        totalTrades,
        winRate,
        totalPnl: stats._sum.pnl ?? 0,
      },
    });

    if (remaining > 0) {
      console.warn(`[PNL] ${remaining.toFixed(2)} tokens sold but no matching OPEN PaperTrades — possible data gap`);
    }
  });
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
          tokenPrice: outputPrice?.priceUsd || null, // Actual token price USD at entry
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

      // Auto-complete FIRST_TRADE onboarding task (fire-and-forget)
      autoCompleteOnboardingTask(agent.id, 'FIRST_TRADE', { tradeId: swapData.signature, tokenSymbol }).catch(() => {});

      // Evaluate buy triggers for agents tracking this wallet (fire-and-forget)
      evaluateTriggers({
        walletAddress: agentUserId,
        tokenMint,
        tokenSymbol,
        action: 'BUY',
        amount: swapData.inputAmount || 0,
        chain: 'SOLANA',
        signature: swapData.signature,
        liquidity: outputPrice?.liquidity,
        marketCap: outputPrice?.marketCap,
      }).catch((err) => console.error('[TriggerEngine] Evaluation failed:', err));

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

      // Update position (may delete if fully closed)
      await positionTracker.onSell(
        agent.id, tokenMint, swapData.inputAmount, inputPrice?.priceUsd || 0
      );

      // FIFO close PaperTrades proportionally (works for both partial and full sells)
      await closePaperTradesForSell(
        agent.id, tokenMint,
        swapData.inputAmount,   // tokens sold
        solReceived, currentSolPrice
      );

      console.log(`[TRADE] SELL recorded: ${swapData.inputAmount} ${tokenSymbol} → ${solReceived} SOL`);

    } else {
      // ── Token-to-Token: Token A → Token B ──────────────
      const inputMint = swapData.inputMint;
      const outputMint = swapData.outputMint;
      const inputSymbol = inputPrice?.symbol || 'UNKNOWN';
      const inputName = inputPrice?.name || 'Unknown';
      const outputSymbol = outputPrice?.symbol || 'UNKNOWN';
      const outputName = outputPrice?.name || 'Unknown';

      console.log(`[TRADE] Token-to-token: ${inputSymbol} → ${outputSymbol} for agent ${agent.id.slice(0, 8)}...`);

      // Estimate the USD value of the swap for PnL tracking
      // Use input token price * input amount to get approximate USD value
      const inputValueUSD = (inputPrice?.priceUsd || 0) * (swapData.inputAmount || 0);
      // Convert to SOL-equivalent for consistent PnL with SOL trades
      const solPrice = await getTokenPrice(SOL_MINT);
      const solPriceUSD = solPrice?.priceUsd || 1;
      const solEquivalent = solPriceUSD > 0 ? inputValueUSD / solPriceUSD : 0;

      // Create AgentTrade for SELL side (input token)
      await safeCreateAgentTrade(agent.id, {
        tokenMint: inputMint,
        tokenSymbol: inputSymbol,
        tokenName: inputName,
        action: 'SELL',
        tokenAmount: swapData.inputAmount || 0,
        solAmount: solEquivalent,
        signature: swapData.signature,
      });

      // Create AgentTrade for the BUY side (output token)
      await safeCreateAgentTrade(agent.id, {
        tokenMint: outputMint,
        tokenSymbol: outputSymbol,
        tokenName: outputName,
        action: 'BUY',
        tokenAmount: swapData.outputAmount || 0,
        solAmount: solEquivalent,
        signature: `${swapData.signature}-buy`, // Unique sig for buy side
      });

      // Sell side: update position
      await positionTracker.onSell(
        agent.id, inputMint, swapData.inputAmount, inputPrice?.priceUsd || 0
      );

      // FIFO close PaperTrades for the sold token with estimated SOL value
      await closePaperTradesForSell(
        agent.id, inputMint,
        swapData.inputAmount,  // tokens sold
        solEquivalent,         // estimated SOL-equivalent received
        solPriceUSD            // current SOL price for PnL calc
      );

      // Buy side: create PaperTrade for output token + update position
      // entryPrice = SOL/USD price (consistent with BUY path above)
      await db.paperTrade.create({
        data: {
          agentId: agent.id,
          tokenMint: outputMint,
          tokenSymbol: outputSymbol,
          tokenName: outputName,
          action: 'BUY',
          entryPrice: solPriceUSD,
          tokenPrice: outputPrice?.priceUsd || null, // Actual token price USD at entry
          amount: solEquivalent,
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

function getDedupeKey(rawBody: string, signature?: string): string {
  if (signature && signature.length > 0) return signature;
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

async function markWebhookProcessed(heliusSignature: string, processed: boolean) {
  try {
    await db.webhookEvent.update({
      where: { heliusSignature },
      data: { processed },
    });
  } catch (error) {
    console.error('[WEBHOOK] Failed to update processed status:', error);
  }
}

async function processSolanaWebhookPayload(rawBody: string, heliusSignature: string) {
  // Parse the payload - Helius enhanced webhooks send ARRAY of transactions
  const parsed = JSON.parse(rawBody);

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

    // Check if this is a SWAP transaction (Helius enhanced format tells us).
    // Allow undefined type through (raw format) — only skip if explicitly a non-SWAP type.
    if (transaction.type && transaction.type !== 'SWAP') {
      console.log('⏭️ [WEBHOOK] Skipping non-swap transaction:', transaction.type);
      continue;
    }

    // Extract swap info from Helius enhanced data (already parsed)
    const tokenTransfers = transaction.tokenTransfers || [];
    const source = transaction.source || 'unknown';

    console.log('💱 [WEBHOOK] Swap detected:', {
      signature: typeof txSignature === 'string' ? txSignature.slice(0, 16) + '...' : 'unknown',
      signer: signerWallet.slice(0, 8) + '...',
      source,
      tokenTransfers: tokenTransfers.length
    });

    if (tokenTransfers.length === 0) {
      console.warn('⚠️ [WEBHOOK] No token transfers found in swap');
      continue;
    }

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
      await createTradeRecord(signerWallet, swap);
      totalTradesCreated++;

      if (isSuperRouter(signerWallet)) {
        const isBuy = swap.inputMint === SOL_MINT;
        const action: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';

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

        handleSuperRouterTrade(tradeEvent).catch((err) => {
          console.error('❌ Observer analysis failed:', err);
        });
      }

      // ── God wallet agent reactor ──────────────────────────
      // If the signer is a tracked god wallet, fire agent reactions so the
      // arena comes alive with real-time commentary on every god wallet move.
      const godWallet = await isGodWallet(signerWallet).catch(() => false);
      if (godWallet) {
        const isBuySwap = isBaseCurrency(swap.inputMint);
        const isSellSwap = isBaseCurrency(swap.outputMint);
        const godEventType = isBuySwap ? 'god_wallet_buy_detected' : (isSellSwap ? 'god_wallet_sell_detected' : null);

        if (godEventType) {
          const walletLabel = await getGodWalletLabel(signerWallet);
          const tokenMint = isBuySwap ? swap.outputMint : swap.inputMint;
          const solAmount = isBuySwap ? swap.inputAmount : swap.outputAmount;

          console.log(`🐋 [WEBHOOK] God wallet ${signerWallet.slice(0, 8)}… ${isBuySwap ? 'BUY' : 'SELL'} → firing agent reactor`);

          agentSignalReactor.react(godEventType, {
            walletAddress: signerWallet,
            walletLabel: walletLabel ?? signerWallet.slice(0, 8),
            tokenMint,
            amount: solAmount,
            action: isBuySwap ? 'BUY' : 'SELL',
            type: godEventType,
            signature: swap.signature,
          }).catch((err) => console.error('[WEBHOOK] God wallet reactor failed:', err));
        }
      }
    } catch (error) {
      console.error('❌ [WEBHOOK] Failed to process swap:', error instanceof Error ? error.message : error);
    }
  }

  console.log('📤 [WEBHOOK] Processing complete:', {
    transactionsProcessed: transactions.length,
    swapsFound: totalSwapsFound,
    tradesCreated: totalTradesCreated,
    dexes: allDexes,
  });

  await markWebhookProcessed(heliusSignature, true);
}

// Register Redis/memory queue processor once at module load.
// In multi-replica deployments, each replica can host workers safely when Redis mode is enabled.
const enableWebhookWorker = (
  process.env.ENABLE_WEBHOOK_WORKER
  ?? process.env.ENABLE_BACKGROUND_WORKERS
  ?? 'true'
).toLowerCase() === 'true';
if (enableWebhookWorker) {
  webhookQueue.registerSolanaProcessor(async ({ rawBody, heliusSignature }) => {
    try {
      await processSolanaWebhookPayload(rawBody, heliusSignature);
    } catch (error) {
      console.error('❌ [WEBHOOK_QUEUE] Processing error:', error);
      await markWebhookProcessed(heliusSignature, false);
    }
  }).catch((error) => {
    console.error('[WEBHOOK_QUEUE] Failed to register processor:', error);
  });
} else {
  console.log('[WEBHOOK_QUEUE] Worker disabled on this replica (ENABLE_WEBHOOK_WORKER=false)');
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

    // Helius sends auth via Authorization header (configured as "Authentication Header" in dashboard)
    const authHeader = c.req.header('Authorization');
    const heliusAuthToken = process.env.HELIUS_WEBHOOK_SECRET || '';

    console.log('🔔 [WEBHOOK] Helius webhook received', {
      hasSignature: !!signature,
      hasAuthHeader: !!authHeader,
      secretConfigured: !!heliusAuthToken && heliusAuthToken !== 'your-helius-webhook-secret-here',
      bodySize: rawBody.length,
      timestamp: new Date().toISOString()
    });

    // Webhook auth: Helius can authenticate via either:
    // 1. Authorization header (set as "Authentication Header" in Helius dashboard)
    // 2. X-Helius-Signature HMAC (legacy approach)
    const secretMissing = !heliusAuthToken || heliusAuthToken === 'your-helius-webhook-secret-here';

    if (!secretMissing) {
      const authValid = authHeader === heliusAuthToken
        || (signature && validateHeliusSignature(rawBody, signature, heliusAuthToken));

      if (!authValid) {
        console.warn('❌ [WEBHOOK] Invalid Helius webhook auth - rejecting');
        return c.json({ error: 'Invalid authentication' }, 401);
      }
      console.log('✅ [WEBHOOK] Auth validated successfully');
    } else {
      console.warn('⚠️ [WEBHOOK] No secret configured - auth skipped. Set HELIUS_WEBHOOK_SECRET in env');
    }

    const heliusSignature = getDedupeKey(rawBody, signature);

    try {
      await db.webhookEvent.create({
        data: {
          heliusSignature,
          eventType: 'solana_webhook',
          agentPubkey: 'unknown',
          payload: {
            receivedAt: new Date().toISOString(),
            bodySize: rawBody.length,
          },
          processed: false,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return c.json({
          success: true,
          message: 'Duplicate webhook ignored',
        }, 200);
      }
      throw error;
    }

    const accepted = await webhookQueue.enqueueSolanaWebhook({
      rawBody,
      heliusSignature,
    });

    if (!accepted) {
      await db.webhookEvent.update({
        where: { heliusSignature },
        data: {
          payload: {
            droppedAt: new Date().toISOString(),
            reason: 'queue_full',
          },
          processed: false,
        },
      }).catch(() => {});

      return c.json({
        success: false,
        error: 'Webhook queue is full',
      }, 503);
    }

    return c.json({
      success: true,
      message: 'Webhook accepted for async processing',
      queue: await webhookQueue.getStats(),
    }, 200);
  } catch (error) {
    console.error('❌ [WEBHOOK] Processing error:', error);
    console.error('❌ [WEBHOOK] Stack trace:', error instanceof Error ? error.stack : 'no stack');
    return c.json({
      success: false,
      error: 'Processing failed',
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
    const body = await c.req.json();
    const { taskId, agentId, proof } = body;

    if (!taskId || !agentId || typeof taskId !== 'string' || typeof agentId !== 'string') {
      return c.json({ success: false, error: 'Missing required fields: taskId, agentId' }, 400);
    }

    console.log(`\n📋 Task validation request: ${taskId} from ${agentId.substring(0, 12)}...`);
    
    const { AgentTaskManager } = await import('../services/agent-task-manager.service');
    const taskManager = new AgentTaskManager();
    
    const validation = await taskManager.submitProof(taskId, agentId, proof);
    
    return c.json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('❌ Task validation error:', error);
    return c.json(
      {
        success: false,
        error: 'Validation failed',
      },
      500
    );
  }
});

/**
 * GET /webhooks/health
 * Health check endpoint
 */
webhooks.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    service: 'Helius Webhook Handler',
    queue: await webhookQueue.getStats(),
    timestamp: new Date().toISOString()
  });
});
