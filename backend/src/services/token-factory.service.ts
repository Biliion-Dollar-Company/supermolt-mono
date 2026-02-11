/**
 * Token Factory Service — BSC Token Deployment via Four.Meme
 *
 * Deploys tokens on BSC via Four.Meme's TokenManager2, giving them
 * instant bonding curve trading and automatic PancakeSwap graduation at ~24 BNB.
 *
 * Flow: API auth → image upload → prepareCreate → on-chain createToken → DB record
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  decodeEventLog,
  type Address,
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { FOUR_MEME_TOKEN_MANAGER_ABI, ERC20_ABI } from '../lib/token-factory-abi';
import { getFourMemeClient, DEFAULT_IMAGE_URL } from './fourmeme-api.service';
import { db } from '../lib/db';

// Four.Meme TokenManager2 on BSC Mainnet
const FOUR_MEME_CONTRACT = '0x5c952063c7fc8610FFDB798152D69F0B9550762b' as Address;

const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';

// Clients (lazy init)
let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: bsc,
      transport: http(BSC_RPC_URL),
    });
  }
  return publicClient;
}

function getWalletClient() {
  const privateKey = process.env.BSC_TREASURY_PRIVATE_KEY;
  if (!privateKey) throw new Error('BSC_TREASURY_PRIVATE_KEY not set');

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: bsc,
    transport: http(BSC_RPC_URL),
  });
}

export interface TokenDeploymentResult {
  tokenAddress: string;
  txHash: string;
  name: string;
  symbol: string;
  totalSupply: string;
  creator: string;
  explorerUrl: string;
  fourMemeUrl: string;
  bondingCurveUrl: string;
  graduationTarget: string;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  description?: string;
  label?: string;
  imageUrl?: string;
  presaleBNB?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

/**
 * Deploy a new token via Four.Meme
 *
 * 1. Authenticate with Four.Meme API (cached)
 * 2. Upload image (download URL → re-upload to Four.Meme CDN)
 * 3. Call prepareCreate → get createArg + signature
 * 4. On-chain createToken(createArg, signature) with value = launchFee + presaleBNB
 * 5. Decode TokenCreate event → token address
 * 6. Save TokenDeployment record
 */
export async function createTokenForAgent(
  agentId: string,
  params: CreateTokenParams
): Promise<TokenDeploymentResult> {
  const fourMeme = getFourMemeClient();
  const client = getPublicClient();
  const wallet = getWalletClient();

  console.log(`[TokenFactory] Deploying ${params.name} (${params.symbol}) for agent ${agentId} via Four.Meme...`);

  // Step 1: Upload image
  let imgUrl: string;
  if (params.imageUrl) {
    imgUrl = await fourMeme.uploadImage(params.imageUrl);
  } else {
    // Use default placeholder — download and re-upload
    try {
      imgUrl = await fourMeme.uploadImage(DEFAULT_IMAGE_URL);
    } catch {
      // If placeholder download fails, try with a simple buffer
      const placeholderBuffer = createPlaceholderImage();
      imgUrl = await fourMeme.uploadImage(placeholderBuffer);
    }
  }

  // Step 2: Prepare creation via API
  const prepared = await fourMeme.prepareCreate({
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    label: params.label,
    imgUrl,
    presaleBNB: params.presaleBNB,
    twitterUrl: params.twitter,
    telegramUrl: params.telegram,
    webUrl: params.website,
  });

  // Step 3: Calculate value to send
  // createFeeWei (0.01 BNB) + presaleWei (optional initial buy)
  const value = prepared.createFeeWei + prepared.presaleWei;

  console.log(`[TokenFactory] Sending createToken tx (value: ${formatEther(value)} BNB)...`);

  // Step 4: On-chain createToken
  const hash = await wallet.writeContract({
    address: FOUR_MEME_CONTRACT,
    abi: FOUR_MEME_TOKEN_MANAGER_ABI,
    functionName: 'createToken',
    args: [prepared.createArg as `0x${string}`, prepared.signature as `0x${string}`],
    value,
  });

  console.log(`[TokenFactory] Tx submitted: ${hash}`);

  // Step 5: Wait for confirmation
  const receipt = await client.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`Token deployment failed: tx ${hash} reverted`);
  }

  // Step 6: Decode TokenCreate event to get token address
  let tokenAddress: string | null = null;

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: FOUR_MEME_TOKEN_MANAGER_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'TokenCreate') {
        tokenAddress = (decoded.args as any).token as string;
        break;
      }
    } catch {
      // Not our event, skip
    }
  }

  if (!tokenAddress) {
    throw new Error('TokenCreate event not found in receipt');
  }

  tokenAddress = tokenAddress.toLowerCase();

  // Step 7: Build social links JSON
  const socialLinks: Record<string, string> = {};
  if (params.twitter) socialLinks.twitter = params.twitter;
  if (params.telegram) socialLinks.telegram = params.telegram;
  if (params.website) socialLinks.website = params.website;

  // Step 8: Record in database
  await db.tokenDeployment.create({
    data: {
      agentId,
      tokenAddress,
      tokenName: params.name,
      tokenSymbol: params.symbol,
      totalSupply: '1000000000', // Four.Meme fixed at 1B
      factoryTxHash: hash,
      chain: 'BSC',
      imageUrl: imgUrl,
      description: params.description || null,
      label: params.label || null,
      presaleBNB: params.presaleBNB || null,
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
    },
  });

  const explorerUrl = `https://bscscan.com/tx/${hash}`;
  const fourMemeUrl = `https://four.meme/token/${tokenAddress}`;

  console.log(`[TokenFactory] Token deployed at ${tokenAddress}`);
  console.log(`[TokenFactory] Four.Meme: ${fourMemeUrl}`);
  console.log(`[TokenFactory] Explorer: ${explorerUrl}`);

  return {
    tokenAddress,
    txHash: hash,
    name: params.name,
    symbol: params.symbol,
    totalSupply: '1000000000',
    creator: wallet.account.address,
    explorerUrl,
    fourMemeUrl,
    bondingCurveUrl: fourMemeUrl,
    graduationTarget: '24 BNB',
  };
}

/**
 * Get all tokens deployed by an agent
 */
export async function getAgentTokens(agentId: string) {
  const deployments = await db.tokenDeployment.findMany({
    where: { agentId },
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
    label: d.label,
    presaleBNB: d.presaleBNB,
    socialLinks: d.socialLinks,
    bondingCurveGraduated: d.bondingCurveGraduated,
    graduationTxHash: d.graduationTxHash,
    graduationTime: d.graduationTime?.toISOString() || null,
    fourMemeUrl: `https://four.meme/token/${d.tokenAddress}`,
    explorerUrl: `https://bscscan.com/address/${d.tokenAddress}`,
    txExplorerUrl: `https://bscscan.com/tx/${d.factoryTxHash}`,
    createdAt: d.createdAt.toISOString(),
  }));
}

/**
 * Get Four.Meme factory info
 */
export async function getFactoryInfo() {
  const client = getPublicClient();

  try {
    const launchFee = await client.readContract({
      address: FOUR_MEME_CONTRACT,
      abi: FOUR_MEME_TOKEN_MANAGER_ABI,
      functionName: '_launchFee',
    }) as bigint;

    const totalDeployments = await db.tokenDeployment.count({
      where: { chain: 'BSC' },
    });

    return {
      configured: true,
      platform: 'Four.Meme',
      address: FOUR_MEME_CONTRACT,
      chain: 'BSC Mainnet',
      chainId: 56,
      launchFee: formatEther(launchFee),
      launchFeeWei: launchFee.toString(),
      totalDeployments,
      graduationTarget: '24 BNB',
      explorerUrl: `https://bscscan.com/address/${FOUR_MEME_CONTRACT}`,
      fourMemeUrl: 'https://four.meme',
    };
  } catch (error) {
    console.error('[TokenFactory] Failed to read factory info:', error);
    return {
      configured: true,
      platform: 'Four.Meme',
      address: FOUR_MEME_CONTRACT,
      chain: 'BSC Mainnet',
      launchFee: null,
      error: 'Failed to read contract',
    };
  }
}

/**
 * Get ERC-20 token balance for an address
 */
export async function getTokenBalance(tokenAddress: Address, holderAddress: Address): Promise<string> {
  const client = getPublicClient();
  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [holderAddress],
  });
  return balance.toString();
}

/**
 * Create a minimal 1x1 PNG buffer as placeholder
 */
function createPlaceholderImage(): Buffer {
  // Minimal valid 1x1 purple PNG
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d76360f86f0000000201017798cc370000000049454e44ae426082',
    'hex'
  );
  return png;
}
