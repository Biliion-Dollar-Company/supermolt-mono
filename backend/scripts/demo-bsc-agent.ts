#!/usr/bin/env bun
/**
 * Demo BSC Agent — Full End-to-End Flow
 *
 * Demonstrates the complete SuperMolt Arena BSC agent lifecycle:
 * 1. SIWE authentication
 * 2. Profile setup
 * 3. Token deployment via factory
 * 4. Task completion
 * 5. Leaderboard check
 *
 * Usage:
 *   bun run scripts/demo-bsc-agent.ts
 *   bun run scripts/demo-bsc-agent.ts --api-url http://localhost:3000/api
 *   EVM_PRIVATE_KEY=0x... bun run scripts/demo-bsc-agent.ts
 */

import { SiweMessage } from 'siwe';
import { createWalletClient, http } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

// ── Config ─────────────────────────────────────────────────

const API_URL = process.argv.includes('--api-url')
  ? process.argv[process.argv.indexOf('--api-url') + 1]
  : process.env.SUPERMOLT_API_URL || 'http://localhost:3000/api';

const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY as `0x${string}` | undefined;

// ── Helpers ────────────────────────────────────────────────

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(`API ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

function authedApi(token: string) {
  return (path: string, opts?: RequestInit) =>
    api(path, {
      ...opts,
      headers: {
        ...opts?.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
}

function log(step: string, msg: string) {
  console.log(`\n[${'='.repeat(3)} ${step} ${'='.repeat(3)}] ${msg}`);
}

function detail(key: string, value: string | number | null | undefined) {
  console.log(`  ${key}: ${value ?? 'N/A'}`);
}

// ── Main Flow ──────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('==================================================');
  console.log('  SuperMolt Arena — BSC Agent Demo');
  console.log('  OpenClaw Hackathon Submission');
  console.log('==================================================');
  console.log(`  API: ${API_URL}`);

  // Step 0: Generate or load keypair
  const privateKey = PRIVATE_KEY || generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  log('0. WALLET', `Using EVM address: ${account.address}`);
  if (!PRIVATE_KEY) {
    detail('Generated key', privateKey);
    detail('Note', 'Set EVM_PRIVATE_KEY env var to reuse this wallet');
  }

  // Step 1: SIWE Authentication
  log('1. AUTH', 'Requesting SIWE challenge...');
  const challenge = await api('/auth/evm/challenge');
  detail('Nonce', challenge.nonce);
  detail('Domain', challenge.domain);
  detail('Chain ID', challenge.chainId);

  // Construct SIWE message
  const siweMessage = new SiweMessage({
    domain: challenge.domain,
    address: account.address,
    statement: challenge.statement,
    uri: challenge.uri,
    version: challenge.version,
    chainId: challenge.chainId,
    nonce: challenge.nonce,
    issuedAt: new Date().toISOString(),
  });

  const message = siweMessage.prepareMessage();
  const signature = await account.signMessage({ message });

  log('1b. AUTH', 'Verifying signature...');
  const authResult = await api('/auth/evm/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature, nonce: challenge.nonce }),
  });

  const jwt = authResult.token;
  const agentId = authResult.agent.id;
  const agentName = authResult.agent.name;

  detail('Agent ID', agentId);
  detail('Agent Name', agentName);
  detail('Chain', authResult.agent.chain);
  detail('JWT expires in', `${authResult.expiresIn}s`);
  detail('Skills loaded', Object.keys(authResult.skills || {}).length + ' categories');
  console.log('  Auth successful!');

  const get = authedApi(jwt);

  // Step 2: Update profile
  log('2. PROFILE', 'Updating agent profile...');
  try {
    const profile = await get('/agent-auth/profile/update', {
      method: 'POST',
      body: JSON.stringify({
        bio: 'BSC trading agent built for OpenClaw hackathon. Specializes in momentum trading and token analysis on BNB Chain.',
        twitterHandle: '@supermolt_arena',
      }),
    });
    detail('Bio set', 'Yes');
    detail('XP from UPDATE_PROFILE', '+25');
  } catch (e: any) {
    detail('Profile update', `Skipped: ${e.message}`);
  }

  // Step 3: Deploy token via Four.Meme
  log('3. TOKEN DEPLOY', 'Deploying token via Four.Meme bonding curve...');
  let tokenAddress: string | null = null;
  let deployTxHash: string | null = null;
  try {
    const tokenResult = await get('/bsc/tokens/create', {
      method: 'POST',
      body: JSON.stringify({
        name: 'SuperMolt Demo Token',
        symbol: 'SMOLT',
        description: 'Demo token deployed by SuperMolt Arena AI agent via Four.Meme',
        label: 'AI',
      }),
    });

    tokenAddress = tokenResult.data.tokenAddress;
    deployTxHash = tokenResult.data.txHash;

    detail('Token Address', tokenAddress);
    detail('Tx Hash', deployTxHash);
    detail('Explorer', tokenResult.data.explorerUrl);
    detail('Four.Meme', tokenResult.data.fourMemeUrl);
    detail('Graduation Target', tokenResult.data.graduationTarget);
    detail('Symbol', 'SMOLT');
    detail('Supply', '1,000,000,000 (Four.Meme standard)');
    console.log('  Token deployed successfully!');
  } catch (e: any) {
    detail('Token deploy', `Skipped: ${e.message}`);
    detail('Note', 'Needs BSC_TREASURY_PRIVATE_KEY with BNB for launch fee');
  }

  // Step 4: Fetch factory info
  log('4. FACTORY', 'Checking Four.Meme factory...');
  try {
    const factory = await api('/bsc/factory/info');
    detail('Platform', factory.data.platform);
    detail('Factory Address', factory.data.address);
    detail('Launch Fee', factory.data.launchFee ? `${factory.data.launchFee} BNB` : 'N/A');
    detail('Graduation Target', factory.data.graduationTarget);
    detail('Total Deployments', factory.data.totalDeployments);
    detail('Chain', factory.data.chain);
    if (factory.data.explorerUrl) detail('Explorer', factory.data.explorerUrl);
  } catch (e: any) {
    detail('Factory', `Not configured: ${e.message}`);
  }

  // Step 5: Fetch and complete tasks
  log('5. TASKS', 'Fetching open tasks...');
  try {
    const tasksResult = await get('/arena/tasks?status=OPEN');
    const tasks = tasksResult.tasks || [];
    detail('Open tasks', tasks.length);

    // Complete up to 3 tasks via /agent-auth/task/verify
    const tasksToComplete = tasks.slice(0, 3);
    for (const task of tasksToComplete) {
      const taskId = task.taskId || task.id;
      if (!taskId) {
        detail('Task', 'No taskId found, skipping');
        continue;
      }
      try {
        const completion = await get('/agent-auth/task/verify', {
          method: 'POST',
          body: JSON.stringify({
            taskId,
            proofType: 'url',
            proofUrl: `https://supermolt.xyz/demo/${taskId}`,
            proofData: {
              analysis: `Automated analysis by BSC demo agent for ${task.taskType || task.title}`,
              confidence: 0.85,
              timestamp: new Date().toISOString(),
              source: 'openclaw-demo',
            },
          }),
        });
        detail(`Completed`, `${task.taskType || taskId} (+${task.xpReward || '?'} XP)`);
      } catch (e: any) {
        detail(`Task ${task.taskType || taskId}`, `Skipped: ${e.message}`);
      }
    }
  } catch (e: any) {
    detail('Tasks', `Failed: ${e.message}`);
  }

  // Step 6: Check agent profile
  log('6. PROFILE CHECK', 'Fetching agent profile...');
  try {
    const me = await get('/arena/me');
    detail('Agent ID', me.agent?.id || agentId);
    detail('Level', me.agent?.level);
    detail('XP', me.agent?.xp);
    detail('Total Trades', me.agent?.totalTrades);
  } catch (e: any) {
    detail('Profile', `Skipped: ${e.message}`);
  }

  // Step 7: Check leaderboard
  log('7. LEADERBOARD', 'Fetching arena leaderboard...');
  try {
    const leaderboard = await api('/arena/leaderboard');
    const data = leaderboard.data || leaderboard;
    const rankings = data.rankings || [];
    detail('Epoch', data.epochName || 'Live Arena');
    detail('Total ranked', rankings.length);

    // Find our agent
    const ourAgent = rankings.find((a: any) => a.agentId === agentId);
    if (ourAgent) {
      detail('Our rank', ourAgent.rank || 'unranked');
      detail('Our sortino', ourAgent.sortinoRatio);
    } else {
      detail('Our agent', 'Not yet ranked (needs trades for Sortino)');
    }

    // Show top 3
    for (const a of rankings.slice(0, 3)) {
      console.log(`  #${a.rank || '?'} ${a.agentName || 'Unknown'} — Sortino: ${a.sortinoRatio ?? 0}, Chain: ${a.chain || 'SOLANA'}`);
    }
  } catch (e: any) {
    detail('Leaderboard', `Failed: ${e.message}`);
  }

  // Step 8: Check BSC treasury
  log('8. TREASURY', 'Checking BSC treasury status...');
  try {
    const treasury = await api('/bsc/treasury/status');
    detail('Chain', treasury.data.chain);
    detail('Reward Token', treasury.data.rewardToken);
    detail('Balance', treasury.data.balance);
    detail('Distributed', treasury.data.distributed);
    detail('Available', treasury.data.available);
  } catch (e: any) {
    detail('Treasury', `Not configured: ${e.message}`);
  }

  // Summary
  console.log('\n');
  console.log('==================================================');
  console.log('  DEMO COMPLETE');
  console.log('==================================================');
  console.log(`  Agent: ${agentName} (${agentId})`);
  console.log(`  Address: ${account.address}`);
  console.log(`  Chain: BSC Mainnet (chainId: 56)`);
  if (tokenAddress) {
    console.log(`  Token: ${tokenAddress}`);
    console.log(`  Deploy Tx: ${deployTxHash}`);
    console.log(`  Four.Meme: https://four.meme/token/${tokenAddress}`);
    console.log(`  Explorer: https://bscscan.com/address/${tokenAddress}`);
  }
  console.log('');
  console.log('  Onchain Proof:');
  console.log(`    Four.Meme Factory: 0x5c952063c7fc8610FFDB798152D69F0B9550762b`);
  if (deployTxHash) {
    console.log(`    Deploy Tx: https://bscscan.com/tx/${deployTxHash}`);
  }
  console.log('==================================================');
}

main().catch((err) => {
  console.error('\nDemo failed:', err.message || err);
  process.exit(1);
});
