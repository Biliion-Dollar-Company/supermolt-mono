/**
 * ERC-8004 Reputation Service
 * Submit and manage trade feedback on-chain
 */

import { db } from '../lib/db';
import { uploadToIPFS } from '../lib/ipfs';
import { createERC8004Client } from '../contracts/client';
import { keyManager } from './key-manager.service';

const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY';
const NETWORK = (process.env.ETHEREUM_NETWORK || 'sepolia') as 'sepolia' | 'arbitrumSepolia' | 'arbitrum' | 'baseSepolia' | 'base';

if (!keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-reputation')) {
  console.warn('[ERC-8004 Reputation] ETHEREUM_PRIVATE_KEY not set — contract writes will fail');
}

export interface TradeFeedbackResult {
  feedbackIndex: number;
  feedbackURI: string;
  txHash: string;
  score: number;
}

/**
 * Calculate trade performance score (0-100)
 * Returns 100 for profitable trades, scaled down for losses
 */
function calculateTradeScore(trade: any): number {
  if (!trade.pnl || !trade.pnlPercent) {
    return 50; // Neutral score for incomplete trades
  }

  const pnl = Number(trade.pnl);
  const pnlPercent = Number(trade.pnlPercent);

  if (pnl > 0) {
    // Profitable: 60-100 based on % gain
    // 10% gain = 70, 50% gain = 85, 100%+ gain = 100
    const score = Math.min(100, 60 + Math.min(pnlPercent / 2.5, 40));
    return Math.round(score);
  } else if (pnl < 0) {
    // Loss: 0-40 based on % loss
    // -10% = 30, -50% = 10, -100% = 0
    const score = Math.max(0, 40 + Math.max(pnlPercent / 2.5, -40));
    return Math.round(score);
  }

  return 50; // Break-even
}

/**
 * Submit trade feedback on-chain
 */
export async function submitTradeFeedback(tradeId: string): Promise<TradeFeedbackResult> {
  // 1. Fetch trade with agent
  const trade = await db.paperTrade.findUnique({
    where: { id: tradeId },
    include: { agent: true },
  });

  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`);
  }

  if (!trade.agent.onChainAgentId) {
    throw new Error(`Agent ${trade.agent.name} not registered on-chain. Register first.`);
  }

  if (trade.feedbackTxHash) {
    throw new Error(`Feedback already submitted for trade ${tradeId}`);
  }

  if (trade.status !== 'CLOSED') {
    throw new Error(`Trade ${tradeId} is not closed yet (status: ${trade.status})`);
  }

  // 2. Calculate performance score
  const score = calculateTradeScore(trade);

  // 3. Build feedback data for IPFS
  const feedbackData = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#feedback-v1',
    agentId: trade.agent.onChainAgentId,
    tradeId: trade.id,
    tokenMint: trade.tokenMint,
    tokenSymbol: trade.tokenSymbol,
    tokenName: trade.tokenName,
    chain: trade.chain,
    side: trade.action,
    entryPrice: trade.entryPrice.toString(),
    exitPrice: trade.exitPrice?.toString(),
    amount: trade.amount.toString(),
    pnl: trade.pnl?.toString(),
    pnlPercent: trade.pnlPercent?.toString(),
    score,
    timestamp: trade.closedAt?.toISOString() || trade.openedAt.toISOString(),
    openedAt: trade.openedAt.toISOString(),
    closedAt: trade.closedAt?.toISOString(),
  };

  // 4. Upload to IPFS
  const feedbackURI = await uploadToIPFS(feedbackData);
  console.log(`[Reputation] Uploaded feedback for trade ${trade.id} to ${feedbackURI}`);

  // 5. Submit feedback on-chain
  const client = createERC8004Client(
    RPC_URL,
    NETWORK,
    keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-reputation') ?? undefined,
  );
  
  const feedbackIndex = await client.giveFeedback(
    Number(trade.agent.onChainAgentId),
    score,
    0, // valueDecimals (score is 0-100, no decimals)
    'trade', // tag1
    trade.action.toLowerCase(), // tag2: 'buy' or 'sell'
    feedbackURI
  );

  // 6. Update database with feedback tx hash stored directly on the column
  await db.paperTrade.update({
    where: { id: tradeId },
    data: {
      feedbackTxHash: 'pending', // We don't have tx hash in current flow
      metadata: {
        ...(typeof trade.metadata === 'object' && trade.metadata !== null ? trade.metadata as Record<string, unknown> : {}),
        feedbackIndex,
      },
    },
  });

  console.log(`[Reputation] Submitted feedback index ${feedbackIndex} for trade ${trade.id}`);

  return {
    feedbackIndex,
    feedbackURI,
    txHash: 'pending',
    score,
  };
}

/**
 * Bulk submit feedback for all closed trades without feedback
 */
export async function submitAllTradeFeedback(agentId?: string): Promise<{
  submitted: number;
  failed: number;
  skipped: number;
}> {
  // Filter directly on the feedbackTxHash column — only fetch trades not yet submitted.
  const where: any = {
    status: 'CLOSED',
    feedbackTxHash: null,
    agent: {
      onChainAgentId: { not: null },
    },
  };

  if (agentId) {
    where.agentId = agentId;
  }

  const trades = await db.paperTrade.findMany({
    where,
    include: { agent: true },
  });

  console.log(`[Reputation] Found ${trades.length} trades without feedback`);

  let submitted = 0;
  let failed = 0;

  for (const trade of trades) {
    try {
      await submitTradeFeedback(trade.id);
      submitted++;

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`[Reputation] Failed to submit feedback for trade ${trade.id}:`, error.message);
      failed++;
    }
  }

  return {
    submitted,
    failed,
    skipped: 0,
  };
}

/**
 * Get agent reputation summary from chain
 */
export async function getAgentReputation(agentId: string): Promise<{
  totalFeedback: number;
  averageScore: number;
  totalValue: string;
} | null> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent?.onChainAgentId) {
    return null;
  }

  const ethereumPrivateKey = keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-reputation');
  const client = createERC8004Client(RPC_URL, NETWORK, ethereumPrivateKey ?? undefined);

  // Get summary from all clients (use deployer address as default)
  let clients: string[] = [];
  if (ethereumPrivateKey) {
    const signer = client.identityRegistry.runner;
    if (signer && 'getAddress' in signer) {
      clients = [await (signer as any).getAddress()];
    }
  }

  if (clients.length === 0) {
    return null;
  }

  const summary = await client.getReputationSummary(
    Number(agent.onChainAgentId),
    clients
  );

  return {
    totalFeedback: summary.count,
    averageScore: Number(summary.averageValue),
    totalValue: summary.totalValue.toString(),
  };
}

/**
 * Get trade-specific feedback from chain
 */
export async function getTradeFeedback(tradeId: string): Promise<any | null> {
  const trade = await db.paperTrade.findUnique({
    where: { id: tradeId },
    include: { agent: true },
  });

  if (!trade?.feedbackTxHash || !trade?.agent.onChainAgentId) {
    return null;
  }

  // Note: We'd need to store the feedback index to retrieve specific feedback
  // For now, return null as we don't have a way to map trade -> feedback index
  // This could be enhanced by storing feedbackIndex in the database
  
  return null;
}
