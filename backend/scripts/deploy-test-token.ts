#!/usr/bin/env bun
/**
 * Deploy Test Token — Dual Platform Proof
 *
 * Deploys a token on BOTH Four.Meme (BSC) and Pump.fun (Solana)
 * to prove the integrations work end-to-end.
 *
 * Usage:
 *   bun run scripts/deploy-test-token.ts --platform fourmeme
 *   bun run scripts/deploy-test-token.ts --platform pumpfun
 *   bun run scripts/deploy-test-token.ts --platform both
 *
 * Requirements:
 *   Four.Meme: BSC_TREASURY_PRIVATE_KEY (wallet with ~0.02 BNB)
 *   Pump.fun:  SOLANA_DEPLOYER_PRIVATE_KEY (base58) or TREASURY_PRIVATE_KEY (base64)
 *              Wallet needs ~0.03 SOL for gas
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Parse args ──────────────────────────────────────────

const args = process.argv.slice(2);
const platformIdx = args.indexOf('--platform');
const platform = platformIdx >= 0 ? args[platformIdx + 1] : 'both';

if (!['fourmeme', 'pumpfun', 'both'].includes(platform)) {
  console.error('Usage: bun run scripts/deploy-test-token.ts --platform [fourmeme|pumpfun|both]');
  process.exit(1);
}

const runFourMeme = platform === 'fourmeme' || platform === 'both';
const runPumpFun = platform === 'pumpfun' || platform === 'both';

// ── Results collector ───────────────────────────────────

interface DeployResult {
  platform: string;
  chain: string;
  tokenAddress: string;
  txHash: string;
  name: string;
  symbol: string;
  url: string;
  explorerUrl: string;
  error?: string;
}

const results: DeployResult[] = [];
const timestamp = new Date().toISOString();

console.log('');
console.log('==================================================');
console.log('  Token Deployment Test — Dual Platform Proof');
console.log('==================================================');
console.log(`  Timestamp: ${timestamp}`);
console.log(`  Platform:  ${platform}`);
console.log('');

// ── Four.Meme (BSC) ────────────────────────────────────

async function deployFourMeme(): Promise<DeployResult | null> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  FOUR.MEME (BSC)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!process.env.BSC_TREASURY_PRIVATE_KEY) {
    console.log('  SKIPPED: BSC_TREASURY_PRIVATE_KEY not set');
    console.log('  Set this env var with a wallet that has ~0.02 BNB on mainnet');
    return null;
  }

  try {
    const { FourMemeClient } = await import('../src/services/fourmeme-api.service');
    const {
      createPublicClient,
      createWalletClient,
      http,
      formatEther,
      formatUnits,
      decodeEventLog,
    } = await import('viem');
    const { bsc } = await import('viem/chains');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { FOUR_MEME_TOKEN_MANAGER_ABI } = await import('../src/lib/token-factory-abi');

    const PRIVATE_KEY = process.env.BSC_TREASURY_PRIVATE_KEY as `0x${string}`;
    const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
    const FACTORY = '0x5c952063c7fc8610FFDB798152D69F0B9550762b' as `0x${string}`;

    const account = privateKeyToAccount(PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC_URL) });
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC_URL) });

    console.log(`  Wallet:  ${account.address}`);

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    const bnb = parseFloat(formatUnits(balance, 18));
    console.log(`  Balance: ${bnb.toFixed(4)} BNB`);

    if (bnb < 0.02) {
      console.log('  ERROR: Insufficient BNB. Need at least 0.02 BNB.');
      return null;
    }

    // Step 1: Auth + prepare via Four.Meme API
    console.log('  [1/3] Authenticating with Four.Meme API...');
    const fourMeme = new FourMemeClient(PRIVATE_KEY);

    const tokenName = `SuperMolt Test ${Date.now() % 10000}`;
    const tokenSymbol = 'SMTEST';

    // Upload placeholder image
    const placeholderPng = Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d76360f86f0000000201017798cc370000000049454e44ae426082',
      'hex'
    );
    const imgUrl = await fourMeme.uploadImage(placeholderPng);
    console.log(`  Image: ${imgUrl}`);

    console.log('  [2/3] Preparing token creation...');
    const prepared = await fourMeme.prepareCreate({
      name: tokenName,
      symbol: tokenSymbol,
      description: 'SuperMolt Arena test token — proving Four.Meme integration works',
      label: 'AI',
      imgUrl,
    });

    const value = prepared.createFeeWei + prepared.presaleWei;
    console.log(`  Fee: ${formatEther(value)} BNB`);

    // Step 2: Deploy on-chain
    console.log('  [3/3] Deploying on-chain...');
    const deployHash = await walletClient.writeContract({
      address: FACTORY,
      abi: FOUR_MEME_TOKEN_MANAGER_ABI,
      functionName: 'createToken',
      args: [prepared.createArg as `0x${string}`, prepared.signature as `0x${string}`],
      value,
    });

    console.log(`  Tx: ${deployHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });

    if (receipt.status !== 'success') {
      throw new Error(`Transaction reverted: ${deployHash}`);
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

    if (!tokenAddress) throw new Error('TokenCreate event not found');

    const result: DeployResult = {
      platform: 'Four.Meme',
      chain: 'BSC Mainnet',
      tokenAddress,
      txHash: deployHash,
      name: tokenName,
      symbol: tokenSymbol,
      url: `https://four.meme/token/${tokenAddress}`,
      explorerUrl: `https://bscscan.com/tx/${deployHash}`,
    };

    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Four.Meme: ${result.url}`);
    console.log(`  Explorer: ${result.explorerUrl}`);
    console.log('  STATUS: SUCCESS');

    return result;
  } catch (error: any) {
    console.error(`  ERROR: ${error.message}`);
    return {
      platform: 'Four.Meme',
      chain: 'BSC Mainnet',
      tokenAddress: '',
      txHash: '',
      name: '',
      symbol: '',
      url: '',
      explorerUrl: '',
      error: error.message,
    };
  }
}

// ── Pump.fun (Solana) ───────────────────────────────────

async function deployPumpFun(): Promise<DeployResult | null> {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PUMP.FUN (Solana)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const b58Key = process.env.SOLANA_DEPLOYER_PRIVATE_KEY;
  const b64Key = process.env.TREASURY_PRIVATE_KEY;

  if (!b58Key && !b64Key) {
    console.log('  SKIPPED: No Solana private key configured');
    console.log('  Set SOLANA_DEPLOYER_PRIVATE_KEY (base58) or TREASURY_PRIVATE_KEY (base64)');
    return null;
  }

  try {
    const { Keypair, Connection } = await import('@solana/web3.js');
    const bs58 = (await import('bs58')).default;
    const { PumpFunClient } = await import('../src/services/pumpfun-api.service');

    let keypair: InstanceType<typeof Keypair>;
    if (b58Key) {
      keypair = Keypair.fromSecretKey(bs58.decode(b58Key));
    } else {
      keypair = Keypair.fromSecretKey(Buffer.from(b64Key!, 'base64'));
    }

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`  Wallet:  ${keypair.publicKey.toBase58()}`);
    console.log(`  RPC:     ${rpcUrl}`);

    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    const sol = balance / 1e9;
    console.log(`  Balance: ${sol.toFixed(4)} SOL`);

    if (sol < 0.03) {
      console.log('  ERROR: Insufficient SOL. Need at least 0.03 SOL for gas.');
      return null;
    }

    const client = new PumpFunClient(keypair, rpcUrl);

    const tokenName = `SuperMolt Test ${Date.now() % 10000}`;
    const tokenSymbol = 'SMTEST';

    console.log(`  Creating ${tokenName} (${tokenSymbol})...`);

    const result = await client.createToken({
      name: tokenName,
      symbol: tokenSymbol,
      description: 'SuperMolt Arena test token — proving pump.fun integration works',
    });

    const deployResult: DeployResult = {
      platform: 'Pump.fun',
      chain: 'Solana Mainnet',
      tokenAddress: result.mintAddress,
      txHash: result.txSignature,
      name: tokenName,
      symbol: tokenSymbol,
      url: result.pumpFunUrl,
      explorerUrl: result.explorerUrl,
    };

    console.log(`  Token: ${result.mintAddress}`);
    console.log(`  Pump.fun: ${result.pumpFunUrl}`);
    console.log(`  Explorer: ${result.explorerUrl}`);
    console.log('  STATUS: SUCCESS');

    return deployResult;
  } catch (error: any) {
    console.error(`  ERROR: ${error.message}`);
    return {
      platform: 'Pump.fun',
      chain: 'Solana Mainnet',
      tokenAddress: '',
      txHash: '',
      name: '',
      symbol: '',
      url: '',
      explorerUrl: '',
      error: error.message,
    };
  }
}

// ── Main ────────────────────────────────────────────────

async function main() {
  if (runFourMeme) {
    const r = await deployFourMeme();
    if (r) results.push(r);
  }

  if (runPumpFun) {
    const r = await deployPumpFun();
    if (r) results.push(r);
  }

  // Write proof
  const proof = {
    test: 'SuperMolt Arena — Dual Platform Token Deployment',
    timestamp,
    platform,
    results,
    summary: {
      total: results.length,
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
    },
  };

  const outPath = path.join(import.meta.dir, '..', 'deployment-proof.json');
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2));

  console.log('');
  console.log('==================================================');
  console.log('  DEPLOYMENT RESULTS');
  console.log('==================================================');

  for (const r of results) {
    console.log(`  ${r.platform} (${r.chain}):`);
    if (r.error) {
      console.log(`    FAILED: ${r.error}`);
    } else {
      console.log(`    Token:    ${r.tokenAddress}`);
      console.log(`    URL:      ${r.url}`);
      console.log(`    Explorer: ${r.explorerUrl}`);
    }
    console.log('');
  }

  console.log(`  Proof saved: ${outPath}`);
  console.log(`  Success: ${proof.summary.successful}/${proof.summary.total}`);
  console.log('==================================================');

  if (proof.summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nDeployment test failed:', err.message || err);
  process.exit(1);
});
