/**
 * Auto-Buy Executor — processes pending buy requests from the Trigger Engine.
 *
 * Two execution modes:
 *  1. Direct execution — agent has a configured private key → Jupiter swap
 *  2. Recommendation — push to client via WebSocket for user approval
 *
 * Runs on a 5-second interval, draining the trigger engine queue.
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { keyManager } from './key-manager.service';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hash,
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { db } from '../lib/db';
import { getPendingBuys, evaluateTrendingTriggers, type AutoBuyRequest } from './trigger-engine';
import { createTradingExecutor, type TradingExecutor } from './trading-executor';
import { PositionTracker } from './position-tracker';
import { websocketEvents } from './websocket-events';
import { getTokenPrice } from '../lib/birdeye';
import { getBnbPrice, getBscTokenPrice } from '../lib/bsc-prices';
import { getEthPrice, getBaseTokenPrice } from '../lib/base-prices';
import * as surgeApi from './surge-api.service';
import { privySignAndSendTransaction } from '../lib/privy';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ── BSC Constants ───────────────────────────────────────────
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
const PANCAKE_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;

const PANCAKE_ROUTER_ABI = [
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

// ── Config ───────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000; // 5 seconds
const positionTracker = new PositionTracker(db);

let executor: TradingExecutor | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

// ── Lifecycle ────────────────────────────────────────────

export function startAutoBuyExecutor() {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (rpcUrl) {
    executor = createTradingExecutor(rpcUrl);
    console.log('[AutoBuyExecutor] Jupiter executor ready');
  } else {
    console.log('[AutoBuyExecutor] No HELIUS_RPC_URL — recommendation-only mode');
  }

  intervalId = setInterval(processQueue, POLL_INTERVAL_MS);
  console.log(`[AutoBuyExecutor] Started (poll every ${POLL_INTERVAL_MS / 1000}s)`);
}

export function stopAutoBuyExecutor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  console.log('[AutoBuyExecutor] Stopped');
}

// ── Queue Processor ──────────────────────────────────────

async function processQueue() {
  // Evaluate trending triggers — pushes results into the pending queue
  await evaluateTrendingTriggers().catch((err) =>
    console.error('[AutoBuyExecutor] Trending trigger error:', err),
  );

  const pending = getPendingBuys(); // drains queue
  if (pending.length === 0) return;

  console.log(`[AutoBuyExecutor] Processing ${pending.length} auto-buy request(s)`);

  for (const request of pending) {
    try {
      await processRequest(request);
    } catch (error) {
      console.error(`[AutoBuyExecutor] Failed to process ${request.agentName} → ${request.tokenSymbol}:`, error);
    }
  }
}

async function processRequest(request: AutoBuyRequest) {
  // Base chain direct execution via Surge API
  if (request.chain === 'BASE') {
    const surgeWalletId = await getAgentSurgeWalletId(request.agentId);
    if (surgeWalletId) {
      await executeDirectBuyBase(request, surgeWalletId);
      return;
    }
    // No Surge wallet → fall through to recommendation
  }

  // BSC direct execution via PancakeSwap
  if (request.chain === 'BSC') {
    const account = getBSCAccount(request.agentId);
    if (account) {
      await executeDirectBuyBSC(request, account);
      return;
    }
    // No BSC key → fall through to recommendation
  }

  // Solana direct execution via Jupiter (local keypair)
  if (request.chain === 'SOLANA' && executor) {
    const keypair = getAgentKeypair(request.agentId);
    if (keypair) {
      await executeDirectBuy(request, keypair);
      return;
    }
  }

  // Solana execution via Privy server-side wallet
  if (request.chain === 'SOLANA' && executor) {
    const privyWalletId = await getAgentPrivyWalletId(request.agentId);
    if (privyWalletId) {
      await executeDirectBuyWithPrivy(request, privyWalletId);
      return;
    }
  }

  // Fallback: broadcast as trade recommendation
  await broadcastRecommendation(request);
}

// ── Direct Execution (Jupiter) ───────────────────────────

async function executeDirectBuy(request: AutoBuyRequest, keypair: Keypair) {
  if (!executor) return;

  console.log(`[AutoBuyExecutor] DIRECT BUY: ${request.agentName} → ${request.solAmount} SOL of ${request.tokenSymbol}`);

  try {
    const buyResult = await executor.executeBuy(keypair, request.tokenMint, request.solAmount);

    // Record as AgentTrade
    await db.agentTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'SOLANA',
        tokenAmount: buyResult.tokensReceived,
        solAmount: request.solAmount,
        signature: buyResult.signature,
      },
    });

    // Record PaperTrade
    const solPriceData = await getTokenPrice(SOL_MINT).catch(() => null);
    const solPrice = solPriceData?.priceUsd ?? 0;
    await db.paperTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'SOLANA',
        entryPrice: solPrice,
        amount: request.solAmount,
        tokenAmount: buyResult.tokensReceived,
        signalSource: request.triggeredBy,
        confidence: 100,
        metadata: {
          source: 'auto-buy-executor',
          trigger: request.triggeredBy,
          sourceWallet: request.sourceWallet,
          reason: request.reason,
        } as Record<string, string | number | boolean>,
      },
    });

    // Update position
    await positionTracker.onBuy(
      request.agentId,
      request.tokenMint,
      request.tokenSymbol,
      request.tokenSymbol,
      buyResult.tokensReceived,
      0 // token price USD — will be fetched by position tracker
    );

    // Increment trade count
    await db.tradingAgent.update({
      where: { id: request.agentId },
      data: { totalTrades: { increment: 1 } },
    });

    // Broadcast to agent's subscribers
    websocketEvents.broadcastAgentActivity(request.agentId, {
      agentId: request.agentId,
      action: 'TRADE',
      data: {
        type: 'auto_buy_executed',
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        solAmount: request.solAmount,
        signature: buyResult.signature,
        trigger: request.triggeredBy,
        sourceWallet: request.sourceWallet,
        reason: request.reason,
        executionMs: buyResult.executionMs,
      },
    });

    console.log(`[AutoBuyExecutor] EXECUTED: ${request.agentName} bought ${buyResult.tokensReceived} ${request.tokenSymbol} for ${request.solAmount} SOL (${buyResult.executionMs}ms)`);
  } catch (error: any) {
    console.error(`[AutoBuyExecutor] Direct execution failed for ${request.agentName}:`, error.message);
    // Fall back to recommendation
    await broadcastRecommendation(request);
  }
}

// ── Direct Execution (BSC / PancakeSwap V2) ────────────

async function executeDirectBuyBSC(
  request: AutoBuyRequest,
  account: ReturnType<typeof privateKeyToAccount>,
) {
  const startTime = Date.now();
  const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';

  console.log(`[AutoBuyExecutor] BSC BUY: ${request.agentName} → ${request.solAmount} BNB of ${request.tokenSymbol}`);

  try {
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(BSC_RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http(BSC_RPC_URL),
    });

    const bnbAmountWei = parseEther(request.solAmount.toString());
    const tokenAddress = request.tokenMint as Address;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

    // Get expected output (for min amount with 5% slippage)
    let amountOutMin = 0n;
    try {
      const amounts = await publicClient.readContract({
        address: PANCAKE_V2_ROUTER,
        abi: PANCAKE_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [bnbAmountWei, [WBNB_ADDRESS, tokenAddress]],
      });
      // Apply 5% slippage tolerance
      amountOutMin = (amounts[1] * 95n) / 100n;
    } catch {
      // If getAmountsOut fails (no pair), set to 0 (accept any amount)
      console.log('[AutoBuyExecutor] BSC getAmountsOut failed — using 0 min');
    }

    // Execute swap
    const txHash = await walletClient.writeContract({
      address: PANCAKE_V2_ROUTER,
      abi: PANCAKE_ROUTER_ABI,
      functionName: 'swapExactETHForTokens',
      args: [amountOutMin, [WBNB_ADDRESS, tokenAddress], account.address, deadline],
      value: bnbAmountWei,
    });

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });

    const executionMs = Date.now() - startTime;

    if (receipt.status !== 'success') {
      throw new Error(`BSC transaction reverted: ${txHash}`);
    }

    // Estimate tokens received from transfer events
    let tokensReceived = 0;
    const tokenPrice = await getBscTokenPrice(request.tokenMint).catch(() => null);
    if (tokenPrice && tokenPrice.priceBnb > 0) {
      tokensReceived = request.solAmount / tokenPrice.priceBnb;
    }

    // Get BNB price in USD for the PaperTrade entryPrice field
    const bnbPriceUsd = await getBnbPrice().catch(() => 0);

    // Record as AgentTrade
    await db.agentTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'BSC',
        tokenAmount: tokensReceived,
        solAmount: request.solAmount, // BNB amount
        signature: txHash,
      },
    });

    // Record PaperTrade
    await db.paperTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'BSC',
        entryPrice: bnbPriceUsd, // BNB price in USD
        amount: request.solAmount,
        tokenAmount: tokensReceived,
        tokenPrice: tokenPrice?.priceUsd ?? null,
        signalSource: request.triggeredBy,
        confidence: 100,
        metadata: {
          source: 'auto-buy-executor-bsc',
          trigger: request.triggeredBy,
          sourceWallet: request.sourceWallet,
          reason: request.reason,
          txHash,
        } as Record<string, string | number | boolean>,
      },
    });

    // Update position
    await positionTracker.onBuy(
      request.agentId,
      request.tokenMint,
      request.tokenSymbol,
      request.tokenSymbol,
      tokensReceived,
      tokenPrice?.priceUsd ?? 0,
    );

    // Increment trade count
    await db.tradingAgent.update({
      where: { id: request.agentId },
      data: { totalTrades: { increment: 1 } },
    });

    // Broadcast
    websocketEvents.broadcastAgentActivity(request.agentId, {
      agentId: request.agentId,
      action: 'TRADE',
      data: {
        type: 'auto_buy_executed',
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        bnbAmount: request.solAmount,
        chain: 'BSC',
        txHash,
        trigger: request.triggeredBy,
        sourceWallet: request.sourceWallet,
        reason: request.reason,
        executionMs,
      },
    });

    console.log(`[AutoBuyExecutor] BSC EXECUTED: ${request.agentName} bought ~${tokensReceived.toFixed(2)} ${request.tokenSymbol} for ${request.solAmount} BNB (${executionMs}ms)`);
    console.log(`   BscScan: https://bscscan.com/tx/${txHash}`);
  } catch (error: any) {
    console.error(`[AutoBuyExecutor] BSC execution failed for ${request.agentName}:`, error.message);
    // Fall back to recommendation
    await broadcastRecommendation(request);
  }
}

// ── Direct Execution (Privy Server-Side Wallet) ──────────

async function getAgentPrivyWalletId(agentId: string): Promise<string | null> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
    select: { privyWalletId: true },
  });
  return agent?.privyWalletId ?? null;
}

async function executeDirectBuyWithPrivy(request: AutoBuyRequest, privyWalletId: string) {
  if (!executor) return;

  console.log(`[AutoBuyExecutor] PRIVY BUY: ${request.agentName} → ${request.solAmount} SOL of ${request.tokenSymbol}`);

  try {
    const lamports = Math.floor(request.solAmount * 1e9);
    const slippageBps = 100; // 1%

    // 1. Get Jupiter quote
    const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${request.tokenMint}&amount=${lamports}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) throw new Error(`Jupiter quote failed: ${await quoteRes.text()}`);
    const quote = await quoteRes.json();

    // Get the Privy wallet address for the swap transaction
    const agent = await db.tradingAgent.findUnique({
      where: { id: request.agentId },
      select: { config: true },
    });
    const config = (agent?.config as Record<string, any>) || {};
    const walletAddress = config.privyWalletAddress;
    if (!walletAddress) throw new Error('Privy wallet address not found in agent config');

    // 2. Build swap transaction (unsigned, for Privy to sign)
    const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletAddress,
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
    });
    if (!swapRes.ok) throw new Error(`Jupiter swap build failed: ${await swapRes.text()}`);
    const swapData = await swapRes.json();

    // 3. Send to Privy for signing and broadcasting
    const startTime = Date.now();
    const signature = await privySignAndSendTransaction(privyWalletId, swapData.swapTransaction);
    const executionMs = Date.now() - startTime;

    const tokensReceived = parseFloat(quote.outAmount);

    // Record as AgentTrade
    await db.agentTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'SOLANA',
        tokenAmount: tokensReceived,
        solAmount: request.solAmount,
        signature,
      },
    });

    // Record PaperTrade
    const solPriceData = await getTokenPrice(SOL_MINT).catch(() => null);
    const solPrice = solPriceData?.priceUsd ?? 0;
    await db.paperTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'SOLANA',
        entryPrice: solPrice,
        amount: request.solAmount,
        tokenAmount: tokensReceived,
        signalSource: request.triggeredBy,
        confidence: 100,
        metadata: {
          source: 'auto-buy-executor-privy',
          trigger: request.triggeredBy,
          sourceWallet: request.sourceWallet,
          reason: request.reason,
        } as Record<string, string | number | boolean>,
      },
    });

    // Update position
    await positionTracker.onBuy(
      request.agentId,
      request.tokenMint,
      request.tokenSymbol,
      request.tokenSymbol,
      tokensReceived,
      0,
    );

    // Increment trade count
    await db.tradingAgent.update({
      where: { id: request.agentId },
      data: { totalTrades: { increment: 1 } },
    });

    // Broadcast to agent's subscribers
    websocketEvents.broadcastAgentActivity(request.agentId, {
      agentId: request.agentId,
      action: 'TRADE',
      data: {
        type: 'auto_buy_executed',
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        solAmount: request.solAmount,
        signature,
        trigger: request.triggeredBy,
        sourceWallet: request.sourceWallet,
        reason: request.reason,
        executionMs,
        signingMethod: 'privy',
      },
    });

    console.log(`[AutoBuyExecutor] PRIVY EXECUTED: ${request.agentName} bought ${tokensReceived} ${request.tokenSymbol} for ${request.solAmount} SOL (${executionMs}ms)`);
  } catch (error: any) {
    console.error(`[AutoBuyExecutor] Privy execution failed for ${request.agentName}:`, error.message);
    // Fall back to recommendation
    await broadcastRecommendation(request);
  }
}

// ── Direct Execution (Base / Surge API) ──────────────────

async function getAgentSurgeWalletId(agentId: string): Promise<string | null> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
    select: { config: true },
  });
  const config = (agent?.config as Record<string, any>) || {};
  return config.surgeWalletId ?? null;
}

async function executeDirectBuyBase(request: AutoBuyRequest, surgeWalletId: string) {
  const startTime = Date.now();

  console.log(`[AutoBuyExecutor] BASE BUY: ${request.agentName} → ${request.solAmount} ETH of ${request.tokenSymbol}`);

  try {
    const result = await surgeApi.buyToken(surgeApi.SURGE_CHAIN_ID_BASE, surgeWalletId, request.tokenMint, request.solAmount.toString());
    const executionMs = Date.now() - startTime;

    // Estimate tokens received
    let tokensReceived = 0;
    const tokenPrice = await getBaseTokenPrice(request.tokenMint).catch(() => null);
    if (tokenPrice && tokenPrice.priceEth > 0) {
      tokensReceived = request.solAmount / tokenPrice.priceEth;
    }

    // Get ETH price in USD for PaperTrade entryPrice
    const ethPriceUsd = await getEthPrice().catch(() => 0);

    // Record as AgentTrade
    await db.agentTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'BASE',
        tokenAmount: tokensReceived,
        solAmount: request.solAmount, // ETH amount
        signature: result.txHash,
        executionMs,
      },
    });

    // Record PaperTrade
    await db.paperTrade.create({
      data: {
        agentId: request.agentId,
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        tokenName: request.tokenSymbol,
        action: 'BUY',
        chain: 'BASE',
        entryPrice: ethPriceUsd, // ETH price in USD
        amount: request.solAmount,
        tokenAmount: tokensReceived,
        tokenPrice: tokenPrice?.priceUsd ?? null,
        signalSource: request.triggeredBy,
        confidence: 100,
        metadata: {
          source: 'auto-buy-executor-base',
          trigger: request.triggeredBy,
          sourceWallet: request.sourceWallet,
          reason: request.reason,
          txHash: result.txHash,
        } as Record<string, string | number | boolean>,
      },
    });

    // Update position
    await positionTracker.onBuy(
      request.agentId,
      request.tokenMint,
      request.tokenSymbol,
      request.tokenSymbol,
      tokensReceived,
      tokenPrice?.priceUsd ?? 0,
    );

    // Increment trade count
    await db.tradingAgent.update({
      where: { id: request.agentId },
      data: { totalTrades: { increment: 1 } },
    });

    // Broadcast
    websocketEvents.broadcastAgentActivity(request.agentId, {
      agentId: request.agentId,
      action: 'TRADE',
      data: {
        type: 'auto_buy_executed',
        tokenMint: request.tokenMint,
        tokenSymbol: request.tokenSymbol,
        ethAmount: request.solAmount,
        chain: 'BASE',
        txHash: result.txHash,
        trigger: request.triggeredBy,
        sourceWallet: request.sourceWallet,
        reason: request.reason,
        executionMs,
      },
    });

    console.log(`[AutoBuyExecutor] BASE EXECUTED: ${request.agentName} bought ~${tokensReceived.toFixed(2)} ${request.tokenSymbol} for ${request.solAmount} ETH (${executionMs}ms)`);
    console.log(`   BaseScan: https://basescan.org/tx/${result.txHash}`);
  } catch (error: any) {
    console.error(`[AutoBuyExecutor] BASE execution failed for ${request.agentName}:`, error.message);
    // Fall back to recommendation
    await broadcastRecommendation(request);
  }
}

// ── Trade Recommendation (WebSocket push) ────────────────

async function broadcastRecommendation(request: AutoBuyRequest) {
  console.log(`[AutoBuyExecutor] RECOMMENDATION: ${request.agentName} → ${request.solAmount} SOL of ${request.tokenSymbol}`);

  websocketEvents.broadcastAgentActivity(request.agentId, {
    agentId: request.agentId,
    action: 'TRADE',
    data: {
      type: 'trade_recommendation',
      tokenMint: request.tokenMint,
      tokenSymbol: request.tokenSymbol,
      suggestedAmount: request.solAmount,
      chain: request.chain,
      trigger: request.triggeredBy,
      sourceWallet: request.sourceWallet,
      reason: request.reason,
    },
  });
}

// ── Agent Key Lookup ─────────────────────────────────────

function getBSCAccount(agentId: string): ReturnType<typeof privateKeyToAccount> | null {
  return keyManager.getAgentBscAccount(agentId, 'auto-buy-executor');
}

function getAgentKeypair(agentId: string): Keypair | null {
  return keyManager.getAgentSolanaKeypair(agentId, 'SOLANA_DEPLOYER_PRIVATE_KEY', 'auto-buy-executor');
}
