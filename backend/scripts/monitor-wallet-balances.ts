/**
 * Wallet Balance Monitor
 * 
 * Monitors agent wallet balances and alerts when low.
 * Run this script continuously or via cron.
 * 
 * Usage:
 *   bun run scripts/monitor-wallet-balances.ts
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const connection = new Connection(
  process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
);

// Alert thresholds
const CRITICAL_BALANCE_SOL = 0.05;  // 🔴 Stop trading
const WARNING_BALANCE_SOL = 0.1;    // 🟡 Fund soon
const OPTIMAL_BALANCE_SOL = 0.5;    // 🟢 Healthy

interface WalletStatus {
  agentId: string;
  publicKey: string;
  balance: number;
  status: '🔴' | '🟡' | '🟢';
  message: string;
}

async function checkWalletBalances(): Promise<WalletStatus[]> {
  console.log('💰 Checking Agent Wallet Balances...\n');
  console.log('='.repeat(70));

  const agents = await prisma.tradingAgent.findMany({
    where: {
      // Only check active agents
      status: 'ACTIVE'
    },
    select: {
      id: true,
      name: true,
      config: true
    }
  });

  const statuses: WalletStatus[] = [];
  const alerts: string[] = [];

  for (const agent of agents) {
    // Get wallet address from config (if stored there)
    const config = agent.config as any;
    const publicKeyStr = config?.wallet_address || config?.walletAddress;

    if (!publicKeyStr) {
      console.log(`⚠️  ${agent.name} (${agent.id}): No wallet address found`);
      continue;
    }

    try {
      const publicKey = new PublicKey(publicKeyStr);
      const balanceLamports = await connection.getBalance(publicKey);
      const balance = balanceLamports / LAMPORTS_PER_SOL;

      let status: '🔴' | '🟡' | '🟢';
      let message: string;

      if (balance < CRITICAL_BALANCE_SOL) {
        status = '🔴';
        message = 'CRITICAL - Stop trading!';
        alerts.push(`🔴 CRITICAL: ${agent.name} balance is ${balance.toFixed(4)} SOL (below ${CRITICAL_BALANCE_SOL} SOL)`);
      } else if (balance < WARNING_BALANCE_SOL) {
        status = '🟡';
        message = 'WARNING - Fund soon';
        alerts.push(`🟡 WARNING: ${agent.name} balance is ${balance.toFixed(4)} SOL (below ${WARNING_BALANCE_SOL} SOL)`);
      } else {
        status = '🟢';
        message = balance < OPTIMAL_BALANCE_SOL ? 'OK' : 'Optimal';
      }

      console.log(`${status} ${agent.name.padEnd(20)} ${balance.toFixed(4)} SOL  ${message}`);
      console.log(`   ${publicKeyStr.slice(0, 8)}...${publicKeyStr.slice(-8)}`);

      statuses.push({
        agentId: agent.id,
        publicKey: publicKeyStr,
        balance,
        status,
        message
      });

    } catch (error: any) {
      console.error(`❌ Error checking ${agent.name}:`, error.message);
    }
  }

  console.log('='.repeat(70));

  // Print alerts
  if (alerts.length > 0) {
    console.log('\n🚨 ALERTS:\n');
    alerts.forEach(alert => console.log(`  ${alert}`));
    console.log();
  } else {
    console.log('\n✅ All wallets have sufficient balance!\n');
  }

  return statuses;
}

async function monitorContinuously() {
  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES || '30');
  
  console.log(`🔄 Monitoring wallet balances every ${intervalMinutes} minutes...\n`);

  // Run immediately
  await checkWalletBalances();

  // Then run every N minutes
  setInterval(async () => {
    console.log(`\n[${new Date().toISOString()}]`);
    await checkWalletBalances();
  }, intervalMinutes * 60 * 1000);
}

// Main
async function main() {
  const mode = process.argv[2];

  if (mode === 'once') {
    // Run once and exit
    await checkWalletBalances();
    await prisma.$disconnect();
    process.exit(0);
  } else {
    // Monitor continuously
    await monitorContinuously();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
