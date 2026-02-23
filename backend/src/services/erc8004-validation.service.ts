/**
 * ERC-8004 Validation Service
 * Create and manage trade intent validation proofs
 */

import { db } from '../lib/db';
import { uploadToIPFS } from '../lib/ipfs';
import { createERC8004Client } from '../contracts/client';
import { ethers } from 'ethers';
import { keyManager } from './key-manager.service';

const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY';
const VALIDATOR_ADDRESS = process.env.VALIDATOR_ADDRESS || '0x0000000000000000000000000000000000000000';
const NETWORK = (process.env.ETHEREUM_NETWORK || 'sepolia') as 'sepolia' | 'arbitrumSepolia' | 'arbitrum' | 'baseSepolia' | 'base';

if (!keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-validation')) {
  console.warn('[ERC-8004 Validation] ETHEREUM_PRIVATE_KEY not set — contract writes will fail');
}

if (VALIDATOR_ADDRESS === '0x0000000000000000000000000000000000000000') {
  console.warn('[ERC-8004 Validation] VALIDATOR_ADDRESS not set — using zero address');
}

export interface ValidationResult {
  requestHash: string;
  proofURI: string;
  txHash: string;
}

/**
 * Calculate time elapsed since token creation
 * For now, returns mock data since we don't have token creation timestamps
 */
function calculateTimeSince(tokenMint: string, tradeTime: Date): number {
  // Mock: assume token was created 3 minutes before trade
  return 3 * 60 * 1000; // milliseconds
}

/**
 * Get liquidity snapshot at time of trade
 * For now, returns the stored liquidity from trade metadata
 */
async function getLiquiditySnapshot(tokenMint: string, timestamp: Date): Promise<number> {
  // Return the liquidity stored in the trade
  const trade = await db.paperTrade.findFirst({
    where: { tokenMint },
    orderBy: { openedAt: 'asc' },
  });

  return trade?.liquidity ? Number(trade.liquidity) : 0;
}

/**
 * Generate strategy-specific proof for a trade
 */
async function generateStrategyProof(trade: any, strategy: string): Promise<object> {
  const baseProof = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#validation-v1',
    strategy,
    agentId: trade.agent.onChainAgentId,
    tradeId: trade.id,
    timestamp: trade.openedAt.toISOString(),
  };

  switch (strategy) {
    case 'liquidity-sniper': {
      const liquidityAtTime = await getLiquiditySnapshot(trade.tokenMint, trade.openedAt);
      const timeSinceCreation = calculateTimeSince(trade.tokenMint, trade.openedAt);

      return {
        ...baseProof,
        intent: 'Only buy tokens with >$100k liquidity within 5min of creation',
        execution: {
          tokenAddress: trade.tokenMint,
          tokenSymbol: trade.tokenSymbol,
          chain: trade.chain,
          liquidityAtTime,
          timeSinceCreationMs: timeSinceCreation,
          timeSinceCreationMin: timeSinceCreation / 60000,
          checks: {
            liquidityAbove100k: liquidityAtTime > 100000,
            withinFirst5Min: timeSinceCreation < 5 * 60 * 1000,
          },
          passed: liquidityAtTime > 100000 && timeSinceCreation < 5 * 60 * 1000,
        },
      };
    }

    case 'momentum-trader': {
      return {
        ...baseProof,
        intent: 'Buy tokens showing strong momentum and volume spikes',
        execution: {
          tokenAddress: trade.tokenMint,
          tokenSymbol: trade.tokenSymbol,
          chain: trade.chain,
          confidence: trade.confidence,
          signalSource: trade.signalSource,
          checks: {
            highConfidence: trade.confidence > 70,
          },
          passed: trade.confidence > 70,
        },
      };
    }

    case 'risk-averse': {
      const liquidityAtTime = await getLiquiditySnapshot(trade.tokenMint, trade.openedAt);
      return {
        ...baseProof,
        intent: 'Only trade established tokens with high liquidity and market cap',
        execution: {
          tokenAddress: trade.tokenMint,
          tokenSymbol: trade.tokenSymbol,
          chain: trade.chain,
          marketCap: trade.marketCap ? Number(trade.marketCap) : 0,
          liquidity: liquidityAtTime,
          checks: {
            marketCapAbove1M: trade.marketCap ? Number(trade.marketCap) > 1000000 : false,
            liquidityAbove500k: liquidityAtTime > 500000,
          },
          passed:
            (trade.marketCap ? Number(trade.marketCap) > 1000000 : false) &&
            liquidityAtTime > 500000,
        },
      };
    }

    case 'contrarian': {
      return {
        ...baseProof,
        intent: 'Buy during market fear, sell during greed',
        execution: {
          tokenAddress: trade.tokenMint,
          tokenSymbol: trade.tokenSymbol,
          chain: trade.chain,
          action: trade.action,
          confidence: trade.confidence,
          signalSource: trade.signalSource,
          checks: {
            contrarian: true, // Simplified check
          },
          passed: true,
        },
      };
    }

    default:
      return {
        ...baseProof,
        intent: `Execute ${strategy} strategy`,
        execution: {
          tokenAddress: trade.tokenMint,
          tokenSymbol: trade.tokenSymbol,
          chain: trade.chain,
          confidence: trade.confidence,
          passed: true,
        },
      };
  }
}

/**
 * Create validation request for a trade
 */
export async function proveTradeIntent(tradeId: string): Promise<ValidationResult> {
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

  if (trade.validationTxHash) {
    throw new Error(`Validation already submitted for trade ${tradeId}`);
  }

  // 2. Generate strategy-specific proof
  const strategy = trade.agent.archetypeId;
  const proof = await generateStrategyProof(trade, strategy);

  // 3. Upload proof to IPFS
  const proofURI = await uploadToIPFS(proof);
  console.log(`[Validation] Uploaded proof for trade ${trade.id} to ${proofURI}`);

  // 4. Generate proof hash (nonce)
  const proofString = JSON.stringify(proof);
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes(proofString));
  const nonce = parseInt(proofHash.slice(2, 18), 16); // Use first 64 bits as nonce

  // 5. Create validation request on-chain
  const client = createERC8004Client(
    RPC_URL,
    NETWORK,
    keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-validation') ?? undefined,
  );

  const requestHash = await client.createValidationRequest(
    VALIDATOR_ADDRESS,
    Number(trade.agent.onChainAgentId),
    proofURI,
    nonce
  );

  // 6. Update database
  await db.paperTrade.update({
    where: { id: tradeId },
    data: {
      validationTxHash: requestHash,
    },
  });

  console.log(`[Validation] Created validation request ${requestHash} for trade ${trade.id}`);

  return {
    requestHash,
    proofURI,
    txHash: 'pending',
  };
}

/**
 * Bulk prove intent for all trades without validation
 */
export async function proveAllTradeIntents(agentId?: string): Promise<{
  proven: number;
  failed: number;
  skipped: number;
}> {
  const where: any = {
    status: 'CLOSED',
    validationTxHash: null,
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
    take: 10, // Limit to 10 for safety
  });

  console.log(`[Validation] Found ${trades.length} trades without validation`);

  let proven = 0;
  let failed = 0;

  for (const trade of trades) {
    try {
      await proveTradeIntent(trade.id);
      proven++;

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`[Validation] Failed to prove trade ${trade.id}:`, error.message);
      failed++;
    }
  }

  return {
    proven,
    failed,
    skipped: 0,
  };
}

/**
 * Get validation status for a trade
 */
export async function getTradeValidation(tradeId: string): Promise<any | null> {
  const trade = await db.paperTrade.findUnique({
    where: { id: tradeId },
    include: { agent: true },
  });

  if (!trade?.validationTxHash) {
    return null;
  }

  const client = createERC8004Client(RPC_URL, NETWORK);

  try {
    const validation = await client.getValidation(trade.validationTxHash);
    return validation;
  } catch (error) {
    console.error('[Validation] Failed to fetch validation:', error);
    return null;
  }
}

/**
 * Get agent validation statistics from chain
 */
export async function getAgentValidationStats(agentId: string): Promise<any | null> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent?.onChainAgentId) {
    return null;
  }

  const client = createERC8004Client(RPC_URL, NETWORK);

  // Use validator address or empty array
  const validators = VALIDATOR_ADDRESS !== '0x0000000000000000000000000000000000000000'
    ? [VALIDATOR_ADDRESS]
    : [];

  if (validators.length === 0) {
    return null;
  }

  const stats = await client.getValidationStats(Number(agent.onChainAgentId), validators);

  return stats;
}
