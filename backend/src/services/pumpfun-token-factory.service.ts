/**
 * Pump.fun Token Factory Service — Solana Token Deployment
 *
 * Deploys tokens on Solana via pump.fun, giving them instant
 * bonding curve trading and automatic PumpSwap graduation at ~85 SOL.
 *
 * Mirrors token-factory.service.ts (BSC/Four.Meme) for Solana.
 *
 * Flow: IPFS upload → PumpPortal tx build → sign locally → send → DB record
 */

import { db } from '../lib/db';
import { getPumpFunClient, type PumpFunCreateParams } from './pumpfun-api.service';
import { PUMP_TOTAL_SUPPLY, PUMP_GRADUATION_SOL } from '../lib/pumpfun-constants';

export interface SolanaTokenDeploymentResult {
  tokenAddress: string;
  txSignature: string;
  name: string;
  symbol: string;
  totalSupply: string;
  creator: string;
  pumpFunUrl: string;
  explorerUrl: string;
  metadataUri: string;
  graduationTarget: string;
}

export interface CreateSolanaTokenParams {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  initialBuySol?: number;
  twitter?: string;
  telegram?: string;
  website?: string;
}

/**
 * Deploy a new token via pump.fun
 *
 * 1. Upload metadata to pump.fun IPFS
 * 2. Build create tx via PumpPortal
 * 3. Sign with wallet + mint keypair
 * 4. Send to Solana
 * 5. Save TokenDeployment record
 */
export async function createSolanaTokenForAgent(
  agentId: string,
  params: CreateSolanaTokenParams
): Promise<SolanaTokenDeploymentResult> {
  const client = getPumpFunClient();

  console.log(`[PumpFunFactory] Deploying ${params.name} (${params.symbol}) for agent ${agentId}...`);

  // Deploy via pump.fun
  const result = await client.createToken({
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageUrl: params.imageUrl,
    initialBuySol: params.initialBuySol,
    twitter: params.twitter,
    telegram: params.telegram,
    website: params.website,
  });

  // Build social links
  const socialLinks: Record<string, string> = {};
  if (params.twitter) socialLinks.twitter = params.twitter;
  if (params.telegram) socialLinks.telegram = params.telegram;
  if (params.website) socialLinks.website = params.website;

  // Save to database
  await db.tokenDeployment.create({
    data: {
      agentId,
      tokenAddress: result.mintAddress,
      tokenName: params.name,
      tokenSymbol: params.symbol,
      totalSupply: String(PUMP_TOTAL_SUPPLY),
      factoryTxHash: result.txSignature,
      chain: 'SOLANA',
      imageUrl: params.imageUrl || null,
      description: params.description || null,
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
    },
  });

  console.log(`[PumpFunFactory] Token deployed: ${result.mintAddress}`);
  console.log(`[PumpFunFactory] Pump.fun: ${result.pumpFunUrl}`);

  return {
    tokenAddress: result.mintAddress,
    txSignature: result.txSignature,
    name: params.name,
    symbol: params.symbol,
    totalSupply: String(PUMP_TOTAL_SUPPLY),
    creator: client.walletAddress,
    pumpFunUrl: result.pumpFunUrl,
    explorerUrl: result.explorerUrl,
    metadataUri: result.metadataUri,
    graduationTarget: `${PUMP_GRADUATION_SOL} SOL`,
  };
}

/**
 * Get all Solana tokens deployed by an agent
 */
export async function getAgentSolanaTokens(agentId: string) {
  const deployments = await db.tokenDeployment.findMany({
    where: { agentId, chain: 'SOLANA' },
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
    imageUrl: d.imageUrl,
    description: d.description,
    socialLinks: d.socialLinks,
    bondingCurveGraduated: d.bondingCurveGraduated,
    graduationTxHash: d.graduationTxHash,
    graduationTime: d.graduationTime?.toISOString() || null,
    pumpFunUrl: `https://pump.fun/coin/${d.tokenAddress}`,
    explorerUrl: `https://solscan.io/account/${d.tokenAddress}`,
    txExplorerUrl: `https://solscan.io/tx/${d.factoryTxHash}`,
    createdAt: d.createdAt.toISOString(),
  }));
}

/**
 * Get pump.fun platform info
 */
export function getPumpFunInfo() {
  const hasKey = !!(process.env.SOLANA_DEPLOYER_PRIVATE_KEY || process.env.TREASURY_PRIVATE_KEY);

  return {
    configured: hasKey,
    platform: 'Pump.fun',
    chain: 'Solana Mainnet',
    creationFee: 'Free (+ network gas ~0.025 SOL)',
    totalSupply: `${PUMP_TOTAL_SUPPLY} (fixed)`,
    tradableSupply: '793,100,000 (~79.3%)',
    graduationTarget: `${PUMP_GRADUATION_SOL} SOL raised → PumpSwap listing`,
    tradingFee: '1.25% (0.95% protocol + 0.30% creator)',
    pumpFunUrl: 'https://pump.fun',
  };
}
