/**
 * Clanker Token Factory Service — Base Chain Token Deployment
 *
 * Orchestrates token deployment on Base via Clanker SDK v4,
 * records TokenDeployment in DB, and returns enriched result.
 *
 * Flow: Clanker SDK deploy -> waitForTransaction -> DB record -> result
 */

import { db } from '../lib/db';
import { deployToken, getDeployerAddress, type ClankerDeployParams } from './clanker-api.service';

export interface ClankerCreateTokenParams {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  devBuyEth?: number;
  vaultPercentage?: number;
  vaultLockupDays?: number;
}

export interface ClankerTokenDeploymentResult {
  tokenAddress: string;
  txHash: string;
  name: string;
  symbol: string;
  creator: string;
  explorerUrl: string;
  clankerUrl: string;
}

/**
 * Deploy a new token on Base via Clanker and record in DB
 */
export async function createTokenOnBase(
  agentId: string,
  params: ClankerCreateTokenParams
): Promise<ClankerTokenDeploymentResult> {
  console.log(`[ClankerFactory] Deploying ${params.name} (${params.symbol}) for agent ${agentId}...`);

  const result = await deployToken({
    name: params.name,
    symbol: params.symbol,
    image: params.imageUrl,
    description: params.description,
    devBuyEth: params.devBuyEth,
    vaultPercentage: params.vaultPercentage,
    vaultLockupDays: params.vaultLockupDays,
  });

  const creator = getDeployerAddress();

  await db.tokenDeployment.create({
    data: {
      agentId,
      tokenAddress: result.tokenAddress,
      tokenName: params.name,
      tokenSymbol: params.symbol,
      totalSupply: '1000000000',
      factoryTxHash: result.txHash,
      chain: 'BASE',
      platform: 'clanker',
      imageUrl: params.imageUrl || null,
      description: params.description || null,
    },
  });

  const explorerUrl = `https://basescan.org/tx/${result.txHash}`;
  const clankerUrl = `https://clanker.world/clanker/${result.tokenAddress}`;

  console.log(`[ClankerFactory] Token deployed at ${result.tokenAddress}`);
  console.log(`[ClankerFactory] Clanker: ${clankerUrl}`);
  console.log(`[ClankerFactory] Explorer: ${explorerUrl}`);

  return {
    tokenAddress: result.tokenAddress,
    txHash: result.txHash,
    name: params.name,
    symbol: params.symbol,
    creator,
    explorerUrl,
    clankerUrl,
  };
}

/**
 * Get all Base tokens deployed by an agent
 */
export async function getAgentBaseTokens(agentId: string) {
  const deployments = await db.tokenDeployment.findMany({
    where: { agentId, chain: 'BASE' },
    orderBy: { createdAt: 'desc' },
  });

  return deployments.map((d) => ({
    id: d.id,
    tokenAddress: d.tokenAddress,
    tokenName: d.tokenName,
    tokenSymbol: d.tokenSymbol,
    totalSupply: d.totalSupply,
    factoryTxHash: d.factoryTxHash,
    chain: d.chain,
    platform: d.platform || 'clanker',
    imageUrl: d.imageUrl,
    description: d.description,
    clankerUrl: `https://clanker.world/clanker/${d.tokenAddress}`,
    explorerUrl: `https://basescan.org/address/${d.tokenAddress}`,
    txExplorerUrl: `https://basescan.org/tx/${d.factoryTxHash}`,
    createdAt: d.createdAt.toISOString(),
  }));
}
