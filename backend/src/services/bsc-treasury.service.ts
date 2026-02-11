/**
 * BSC Treasury Service — ERC-20 Reward Distribution on BSC Testnet
 *
 * Mirrors treasury-manager.service.ts for BSC chain.
 * Uses viem for ERC-20 transfers of reward tokens.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ERC20_ABI } from '../lib/token-factory-abi';
import { db } from '../lib/db';

const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const REWARD_TOKEN_ADDRESS = process.env.BSC_REWARD_TOKEN_ADDRESS as Address || '0x64544969ed7EBf5f083679233325356EbE738930'; // Default to verified BSC Testnet USDC

// Rank multipliers (same as Solana treasury)
const RANK_MULTIPLIERS: { [key: number]: number } = {
  1: 2.0,
  2: 1.5,
  3: 1.0,
  4: 0.75,
  5: 0.5,
};

function getPublicClient() {
  return createPublicClient({
    chain: bscTestnet,
    transport: http(BSC_RPC_URL),
  });
}

function getWalletClient() {
  const privateKey = process.env.BSC_TREASURY_PRIVATE_KEY;
  if (!privateKey) throw new Error('BSC_TREASURY_PRIVATE_KEY not set');

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(BSC_RPC_URL),
  });
}

export interface BSCDistributionResult {
  agentId: string;
  agentName: string;
  amount: number;
  txHash: string;
  status: 'success' | 'failed';
  error?: string;
  explorerUrl: string;
}

/**
 * Get reward token balance of treasury wallet
 */
export async function getTreasuryBalance(): Promise<{
  balance: string;
  balanceFormatted: number;
  tokenAddress: string | null;
  treasuryAddress: string | null;
}> {
  if (!REWARD_TOKEN_ADDRESS) {
    return { balance: '0', balanceFormatted: 0, tokenAddress: null, treasuryAddress: null };
  }

  const privateKey = process.env.BSC_TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    return { balance: '0', balanceFormatted: 0, tokenAddress: REWARD_TOKEN_ADDRESS, treasuryAddress: null };
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = getPublicClient();

  try {
    const [balance, decimals] = await Promise.all([
      client.readContract({
        address: REWARD_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }),
      client.readContract({
        address: REWARD_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    const formatted = parseFloat(formatUnits(balance, decimals));

    return {
      balance: balance.toString(),
      balanceFormatted: Math.round(formatted * 100) / 100,
      tokenAddress: REWARD_TOKEN_ADDRESS,
      treasuryAddress: account.address,
    };
  } catch (error) {
    console.error('[BSCTreasury] Failed to get balance:', error);
    return {
      balance: '0',
      balanceFormatted: 0,
      tokenAddress: REWARD_TOKEN_ADDRESS,
      treasuryAddress: account.address,
    };
  }
}

/**
 * Send ERC-20 reward tokens to an agent's EVM address
 */
async function sendRewardToken(recipientAddress: Address, amount: number): Promise<string> {
  if (!REWARD_TOKEN_ADDRESS) throw new Error('BSC_REWARD_TOKEN_ADDRESS not set');

  const client = getPublicClient();
  const wallet = getWalletClient();

  // Get token decimals
  const decimals = await client.readContract({
    address: REWARD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  const amountWei = parseUnits(amount.toString(), decimals);

  // Send ERC-20 transfer
  const hash = await wallet.writeContract({
    address: REWARD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipientAddress, amountWei],
  });

  // Wait for confirmation
  const receipt = await client.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`Transfer failed: tx ${hash} reverted`);
  }

  return hash;
}

/**
 * Calculate BSC USDC allocations for an epoch (preview, no distribution)
 */
export async function calculateBSCAllocations(epochId: string): Promise<Array<{
  agentId: string;
  agentName: string;
  evmAddress: string;
  rank: number;
  usdcAmount: number;
  multiplier: number;
}>> {
  const epoch = await db.scannerEpoch.findUnique({ where: { id: epochId } });
  if (!epoch) throw new Error(`Epoch ${epochId} not found`);

  // Get BSC agents only
  const bscAgents = await db.tradingAgent.findMany({
    where: { chain: 'BSC', status: 'ACTIVE', evmAddress: { not: null } },
  });

  if (bscAgents.length === 0) return [];

  // Get trade counts for ranking
  const agentIds = bscAgents.map((a) => a.id);
  const tradeCounts = await db.agentTrade.groupBy({
    by: ['agentId'],
    where: { agentId: { in: agentIds }, chain: 'BSC' },
    _count: { agentId: true },
  });
  const tradeCountMap = new Map(tradeCounts.map((tc) => [tc.agentId, tc._count.agentId]));

  // Rank agents by trade count
  const ranked = bscAgents
    .map((agent) => ({
      agent,
      tradeCount: tradeCountMap.get(agent.id) || agent.totalTrades,
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount);

  const baseAllocation = Number(epoch.baseAllocation) || 200;

  return ranked.map((item, index) => {
    const rank = index + 1;
    const multiplier = RANK_MULTIPLIERS[rank] || 0.5;
    const performanceAdj = Math.max(0.5, Math.min(1.0, item.tradeCount > 0 ? 0.7 + (item.tradeCount / 50) * 0.3 : 0.5));
    const usdcAmount = Math.round(baseAllocation * multiplier * performanceAdj * 100) / 100;

    return {
      agentId: item.agent.id,
      agentName: item.agent.displayName || item.agent.name,
      evmAddress: item.agent.evmAddress!,
      rank,
      usdcAmount,
      multiplier,
    };
  });
}

/**
 * Distribute BSC reward tokens to top BSC agents for an epoch
 */
export async function distributeBSCRewards(epochId: string): Promise<{
  allocations: BSCDistributionResult[];
  summary: { totalAmount: number; successful: number; failed: number; timestamp: string };
}> {
  const epoch = await db.scannerEpoch.findUnique({ where: { id: epochId } });
  if (!epoch) throw new Error(`Epoch ${epochId} not found`);

  // Get BSC agents sorted by trade activity
  const bscAgents = await db.tradingAgent.findMany({
    where: { chain: 'BSC', status: 'ACTIVE', evmAddress: { not: null } },
  });

  if (bscAgents.length === 0) throw new Error('No active BSC agents found');

  // Get trade counts for ranking
  const agentIds = bscAgents.map((a) => a.id);
  const tradeCounts = await db.agentTrade.groupBy({
    by: ['agentId'],
    where: { agentId: { in: agentIds }, chain: 'BSC' },
    _count: { agentId: true },
  });
  const tradeCountMap = new Map(tradeCounts.map((tc) => [tc.agentId, tc._count.agentId]));

  // Rank agents by trade count
  const ranked = bscAgents
    .map((agent) => ({
      agent,
      tradeCount: tradeCountMap.get(agent.id) || agent.totalTrades,
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount);

  const baseAllocation = Number(epoch.baseAllocation) || 200;
  const results: BSCDistributionResult[] = [];
  let successful = 0;
  let failed = 0;
  let totalAmount = 0;

  for (let i = 0; i < ranked.length; i++) {
    const { agent, tradeCount } = ranked[i];
    const rank = i + 1;
    const multiplier = RANK_MULTIPLIERS[rank] || 0.5;
    const performanceAdj = Math.max(0.5, Math.min(1.0, tradeCount > 0 ? 0.7 + (tradeCount / 50) * 0.3 : 0.5));
    const amount = Math.round(baseAllocation * multiplier * performanceAdj * 100) / 100;

    try {
      const txHash = await sendRewardToken(agent.evmAddress! as Address, amount);

      await db.treasuryAllocation.create({
        data: {
          epochId,
          tradingAgentId: agent.id,
          chain: 'BSC',
          amount,
          performanceScore: tradeCount,
          rank,
          txSignature: txHash,
          status: 'completed',
          completedAt: new Date(),
        },
      });

      results.push({
        agentId: agent.id,
        agentName: agent.displayName || agent.name,
        amount,
        txHash,
        status: 'success',
        explorerUrl: `https://testnet.bscscan.com/tx/${txHash}`,
      });

      successful++;
      totalAmount += amount;
      console.log(`[BSCTreasury] ✅ Sent ${amount} tokens to ${agent.name} (${txHash})`);
    } catch (error: any) {
      console.error(`[BSCTreasury] ❌ Failed to send to ${agent.name}:`, error);

      await db.treasuryAllocation.create({
        data: {
          epochId,
          tradingAgentId: agent.id,
          chain: 'BSC',
          amount,
          performanceScore: tradeCount,
          rank,
          status: 'failed',
        },
      });

      results.push({
        agentId: agent.id,
        agentName: agent.displayName || agent.name,
        amount,
        txHash: '',
        status: 'failed',
        error: error.message,
        explorerUrl: '',
      });

      failed++;
    }
  }

  return {
    allocations: results,
    summary: { totalAmount, successful, failed, timestamp: new Date().toISOString() },
  };
}

/**
 * Get BSC treasury status
 */
export async function getBSCTreasuryStatus() {
  const balance = await getTreasuryBalance();

  const [allocated, distributed] = await Promise.all([
    db.treasuryAllocation.aggregate({
      where: { chain: 'BSC', status: 'pending' },
      _sum: { amount: true },
    }),
    db.treasuryAllocation.aggregate({
      where: { chain: 'BSC', status: 'completed' },
      _sum: { amount: true },
    }),
  ]);

  const totalAllocated = Number(allocated._sum.amount || 0);
  const totalDistributed = Number(distributed._sum.amount || 0);

  return {
    chain: 'BSC Testnet',
    chainId: 97,
    rewardToken: balance.tokenAddress,
    treasuryWallet: balance.treasuryAddress,
    balance: balance.balanceFormatted,
    allocated: Math.round(totalAllocated * 100) / 100,
    distributed: Math.round(totalDistributed * 100) / 100,
    available: Math.round((balance.balanceFormatted - totalAllocated) * 100) / 100,
  };
}
