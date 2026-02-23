/**
 * Clanker SDK v4 API Client — Base Chain Token Deployer
 *
 * Thin wrapper around the clanker-sdk v4 for deploying tokens on Base
 * via Clanker's Uniswap v4 hook contracts.
 *
 * SDK: npm i clanker-sdk
 * Docs: https://clanker.gitbook.io/clanker-documentation/sdk/v4.0.0
 */

import { Clanker } from 'clanker-sdk/v4';
import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { keyManager } from './key-manager.service';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

export interface ClankerDeployParams {
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  devBuyEth?: number;
  vaultPercentage?: number;
  vaultLockupDays?: number;
}

export interface ClankerDeployResult {
  tokenAddress: string;
  txHash: string;
}

// Lazy-init
let account: PrivateKeyAccount | null = null;
let clankerInstance: InstanceType<typeof Clanker> | null = null;

function getAccount(): PrivateKeyAccount {
  if (!account) {
    account = keyManager.requireEvmAccount('BASE_DEPLOYER_PRIVATE_KEY', 'clanker-api');
  }
  return account;
}

function getClanker(): InstanceType<typeof Clanker> {
  if (!clankerInstance) {
    const acct = getAccount();
    const pubClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });
    const wallet = createWalletClient({
      account: acct,
      chain: base,
      transport: http(BASE_RPC_URL),
    });
    // Cast needed: viem generic mismatch between project viem and SDK's expected types
    clankerInstance = new Clanker({
      publicClient: pubClient as any,
      wallet: wallet as any,
    });
  }
  return clankerInstance;
}

/**
 * Deploy a token on Base via Clanker v4 (Uniswap v4 hooks)
 */
export async function deployToken(params: ClankerDeployParams): Promise<ClankerDeployResult> {
  const clanker = getClanker();
  const acct = getAccount();

  console.log(`[Clanker] Deploying ${params.name} (${params.symbol}) on Base...`);

  const deployArgs = {
    name: params.name,
    symbol: params.symbol,
    tokenAdmin: acct.address,
    ...(params.image ? { image: params.image } : {}),
    ...(params.description ? { metadata: { description: params.description } } : {}),
    ...(params.devBuyEth ? { devBuy: { ethAmount: params.devBuyEth } } : {}),
    ...(params.vaultPercentage ? {
      vault: {
        percentage: params.vaultPercentage,
        lockupDuration: (params.vaultLockupDays ?? 7) * 86400,
        vestingDuration: (params.vaultLockupDays ?? 7) * 86400,
      },
    } : {}),
  };

  const { txHash, waitForTransaction, error } = await clanker.deploy(deployArgs);

  if (error) {
    throw new Error(`Clanker deploy failed: ${error}`);
  }

  console.log(`[Clanker] Tx submitted: ${txHash}`);

  const result = await waitForTransaction();

  console.log(`[Clanker] Token deployed at ${result.address}`);

  return {
    tokenAddress: (result.address ?? '').toLowerCase(),
    txHash,
  };
}

export function getDeployerAddress(): string {
  return getAccount().address;
}
