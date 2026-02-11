#!/usr/bin/env bun
/**
 * Generate Onchain Proof for Hackathon Submission
 *
 * Deploys a token via Four.Meme on BSC Mainnet, giving it a bonding curve
 * and discoverability on the Four.Meme platform. Outputs proof.json
 * with contract addresses, tx hashes, and Four.Meme URLs.
 *
 * Requirements:
 *   BSC_TREASURY_PRIVATE_KEY=0x...  (wallet with BNB for launch fee)
 *   BSC_RPC_URL (optional, defaults to BSC mainnet)
 *
 * Usage:
 *   bun run scripts/generate-onchain-proof.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  decodeEventLog,
  type Address,
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { FOUR_MEME_TOKEN_MANAGER_ABI, ERC20_ABI } from '../src/lib/token-factory-abi';
import { FourMemeClient } from '../src/services/fourmeme-api.service';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ─────────────────────────────────────────────────

const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
const FOUR_MEME_CONTRACT = '0x5c952063c7fc8610FFDB798152D69F0B9550762b' as Address;
const PRIVATE_KEY = process.env.BSC_TREASURY_PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error('Error: BSC_TREASURY_PRIVATE_KEY env var required');
  console.error('  This wallet needs BNB for the Four.Meme launch fee (~0.01 BNB)');
  process.exit(1);
}

// ── Clients ────────────────────────────────────────────────

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC_URL) });
const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC_URL) });

// ── Helpers ────────────────────────────────────────────────

function explorerTx(hash: string) {
  return `https://bscscan.com/tx/${hash}`;
}
function explorerAddr(addr: string) {
  return `https://bscscan.com/address/${addr}`;
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('==================================================');
  console.log('  Generating Onchain Proof — BSC via Four.Meme');
  console.log('==================================================');
  console.log(`  Deployer: ${account.address}`);
  console.log(`  Factory:  ${FOUR_MEME_CONTRACT}`);
  console.log(`  RPC:      ${BSC_RPC_URL}`);
  console.log('');

  // Check BNB balance
  const balance = await publicClient.getBalance({ address: account.address });
  const balanceBnb = parseFloat(formatUnits(balance, 18));
  console.log(`  BNB Balance: ${balanceBnb.toFixed(4)} BNB`);
  if (balanceBnb < 0.02) {
    console.error('  Insufficient BNB balance. Need at least 0.02 BNB for launch fee + gas.');
    process.exit(1);
  }

  // Step 1: Authenticate + prepare token via Four.Meme API
  console.log('\n[1/3] Preparing token via Four.Meme API...');
  const fourMeme = new FourMemeClient(PRIVATE_KEY);

  const tokenName = 'SuperMolt Arena Reward';
  const tokenSymbol = 'SMOLT';

  // Upload a minimal placeholder image
  const placeholderPng = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d76360f86f0000000201017798cc370000000049454e44ae426082',
    'hex'
  );
  const imgUrl = await fourMeme.uploadImage(placeholderPng);
  console.log(`  Image uploaded: ${imgUrl}`);

  const prepared = await fourMeme.prepareCreate({
    name: tokenName,
    symbol: tokenSymbol,
    description: 'SuperMolt Arena reward token deployed for hackathon proof',
    label: 'AI',
    imgUrl,
  });
  const totalValue = prepared.createFeeWei + prepared.presaleWei;
  console.log(`  Token prepared (fee: ${formatEther(prepared.createFeeWei)} BNB)`);

  // Step 2: Deploy on-chain
  console.log('\n[2/3] Deploying token on-chain via Four.Meme...');
  const value = totalValue;

  const deployHash = await walletClient.writeContract({
    address: FOUR_MEME_CONTRACT,
    abi: FOUR_MEME_TOKEN_MANAGER_ABI,
    functionName: 'createToken',
    args: [prepared.createArg as `0x${string}`, prepared.signature as `0x${string}`],
    value,
  });

  console.log(`  Tx submitted: ${deployHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });

  if (receipt.status !== 'success') {
    throw new Error(`Token deployment reverted: ${deployHash}`);
  }

  // Decode TokenCreate event
  let tokenAddress: string | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: FOUR_MEME_TOKEN_MANAGER_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'TokenCreate') {
        tokenAddress = ((decoded.args as any).token as string).toLowerCase();
        break;
      }
    } catch { /* not our event */ }
  }

  if (!tokenAddress) {
    throw new Error('TokenCreate event not found');
  }

  console.log(`  Token deployed: ${tokenAddress}`);
  console.log(`  Four.Meme: https://four.meme/token/${tokenAddress}`);
  console.log(`  Explorer: ${explorerAddr(tokenAddress)}`);

  // Step 3: Generate proof JSON
  console.log('\n[3/3] Writing proof.json...');

  const proof = {
    hackathon: 'Good Vibes Only: OpenClaw Edition',
    project: 'SuperMolt Arena',
    track: 'Agent Track',
    chain: 'BSC Mainnet (chainId: 56)',
    platform: 'Four.Meme (bonding curve → PancakeSwap)',
    timestamp: new Date().toISOString(),
    deployer: account.address,
    factoryContract: {
      name: 'Four.Meme TokenManager2',
      address: FOUR_MEME_CONTRACT,
      explorer: explorerAddr(FOUR_MEME_CONTRACT),
    },
    token: {
      address: tokenAddress,
      name: tokenName,
      symbol: tokenSymbol,
      totalSupply: '1,000,000,000 (Four.Meme standard)',
      deployTx: deployHash,
      explorerAddress: explorerAddr(tokenAddress),
      explorerTx: explorerTx(deployHash),
      fourMemeUrl: `https://four.meme/token/${tokenAddress}`,
      graduationTarget: '24 BNB raised → PancakeSwap listing',
    },
    explorerLinks: [
      explorerAddr(FOUR_MEME_CONTRACT),
      explorerTx(deployHash),
      explorerAddr(tokenAddress),
      `https://four.meme/token/${tokenAddress}`,
    ],
  };

  const outPath = path.join(import.meta.dir, '..', 'proof.json');
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2));
  console.log(`  Written to: ${outPath}`);

  // Summary
  console.log('\n');
  console.log('==================================================');
  console.log('  ONCHAIN PROOF GENERATED');
  console.log('==================================================');
  console.log(`  Factory:     ${FOUR_MEME_CONTRACT} (Four.Meme)`);
  console.log(`  Token:       ${tokenAddress} (${tokenSymbol})`);
  console.log(`  Deploy Tx:   ${deployHash}`);
  console.log(`  Four.Meme:   https://four.meme/token/${tokenAddress}`);
  console.log('');
  console.log('  Explorer Links:');
  console.log(`    Factory:   ${explorerAddr(FOUR_MEME_CONTRACT)}`);
  console.log(`    Token:     ${explorerAddr(tokenAddress)}`);
  console.log(`    Deploy Tx: ${explorerTx(deployHash)}`);
  console.log('');
  console.log(`  Proof saved to: ${outPath}`);
  console.log('==================================================');
}

main().catch((err) => {
  console.error('\nProof generation failed:', err.message || err);
  process.exit(1);
});
