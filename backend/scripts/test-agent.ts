#!/usr/bin/env bun
/**
 * Test Agent Script - Execute Test Trade with Agent Alpha
 * 
 * Usage:
 *   bun scripts/test-agent.ts [token] [action] [amount]
 * 
 * Examples:
 *   bun scripts/test-agent.ts BONK BUY 0.01
 *   bun scripts/test-agent.ts WIF BUY 0.005
 *   bun scripts/test-agent.ts BONK SELL 0.01
 * 
 * Requirements:
 *   - AGENT_ALPHA_PRIVATE_KEY in .env
 *   - Sufficient SOL balance in DR wallet
 *   - Helius webhook configured to detect trades
 * 
 * What this script does:
 *   1. Loads Agent Alpha's wallet from private key
 *   2. Executes a LIVE swap on Solana mainnet
 *   3. Waits for transaction confirmation
 *   4. Webhook should detect the trade automatically
 *   5. Agent should appear on leaderboard
 */

import { AGENT_ALPHA } from '../src/services/agent-config';
import {
  initializeAgents,
  loadAlphaWallet,
  executeTestTrade,
} from '../src/services/agent-simulator';

// Parse command line arguments
const args = process.argv.slice(2);
const tokenSymbol = args[0] || 'BONK'; // Default: BONK
const action = (args[1]?.toUpperCase() as 'BUY' | 'SELL') || 'BUY'; // Default: BUY
const solAmount = parseFloat(args[2]) || 0.01; // Default: 0.01 SOL

// Validate action
if (action !== 'BUY' && action !== 'SELL') {
  console.error('❌ Invalid action. Must be BUY or SELL.');
  process.exit(1);
}

// Validate amount
if (isNaN(solAmount) || solAmount <= 0) {
  console.error('❌ Invalid amount. Must be a positive number.');
  process.exit(1);
}

// Validate token is in watchlist
if (!AGENT_ALPHA.tokenWatchlist.includes(tokenSymbol)) {
  console.error(`❌ Token ${tokenSymbol} not in Agent Alpha's watchlist.`);
  console.log(`Available tokens: ${AGENT_ALPHA.tokenWatchlist.join(', ')}`);
  process.exit(1);
}

/**
 * Main test execution
 */
async function main() {
  console.log('🚀 Agent Alpha Test Trade\n');
  console.log('Configuration:');
  console.log(`  - Token: ${tokenSymbol}`);
  console.log(`  - Action: ${action}`);
  console.log(`  - Amount: ${solAmount} SOL`);
  console.log(`  - Wallet: ${AGENT_ALPHA.walletAddress}\n`);

  // Load Agent Alpha's wallet
  console.log('🔐 Loading Agent Alpha wallet from environment...');
  try {
    const keypair = loadAlphaWallet();
    console.log(`✅ Wallet loaded: ${keypair.publicKey.toBase58()}\n`);

    // Execute test trade
    const signature = await executeTestTrade(
      AGENT_ALPHA,
      keypair,
      tokenSymbol,
      action,
      solAmount
    );

    // Success summary
    console.log('\n📊 Test Trade Summary:');
    console.log(`  ✅ Transaction: ${signature}`);
    console.log(`  ✅ Solscan: https://solscan.io/tx/${signature}`);
    console.log(`  ✅ Agent: ${AGENT_ALPHA.name} (${AGENT_ALPHA.emoji})`);
    console.log(`  ✅ Action: ${action} ${tokenSymbol}`);
    console.log(`  ✅ Amount: ${solAmount} SOL\n`);

    console.log('🔔 Next Steps:');
    console.log('  1. Wait 10-30 seconds for Helius webhook to detect the trade');
    console.log('  2. Check the backend logs for webhook processing');
    console.log('  3. Verify agent appears on leaderboard');
    console.log('  4. Check trade shows in Live Tape\n');

    console.log('📡 Monitor the webhook:');
    console.log('  - Railway logs: https://railway.app/');
    console.log('  - Local logs: Check server console\n');

    console.log('🎯 Success Criteria:');
    console.log('  ✅ Transaction confirmed on Solana');
    console.log('  ⏳ Webhook detects swap (wait 10-30s)');
    console.log('  ⏳ Agent created/updated in database');
    console.log('  ⏳ Trade appears on leaderboard');
    console.log('  ⏳ Sortino ratio calculated\n');

    console.log('🔍 To verify agent on leaderboard:');
    console.log('  curl https://your-backend.railway.app/feed/leaderboard\n');

    console.log('✨ Test complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Make sure AGENT_ALPHA_PRIVATE_KEY is set in .env');
    console.log('  2. Verify the private key is in base58 format');
    console.log('  3. Check wallet has sufficient SOL balance');
    console.log('  4. Ensure SOLANA_RPC_URL is set (or uses public RPC)');
    console.log('  5. Check the token symbol is in Agent Alpha\'s watchlist\n');
    process.exit(1);
  }
}

// Run the test
main();
