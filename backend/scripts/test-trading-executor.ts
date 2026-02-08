/**
 * Test Script: Trading Executor
 * 
 * Tests the trading executor with a real agent on mainnet.
 * 
 * Usage:
 *   AGENT_PRIVATE_KEY="<base58_key>" bun run test-trading-executor.ts
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createTradingExecutor } from './src/services/trading-executor';

// Test tokens (highly liquid on Solana)
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function testTradingExecutor() {
  console.log('🧪 Testing Trading Executor\n');
  console.log('='.repeat(60));

  // 1. Get agent keypair from env
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY;
  if (!agentPrivateKey) {
    console.error('❌ Error: AGENT_PRIVATE_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  AGENT_PRIVATE_KEY="<base58_key>" bun run test-trading-executor.ts');
    process.exit(1);
  }

  let agentKeypair: Keypair;
  try {
    agentKeypair = Keypair.fromSecretKey(bs58.decode(agentPrivateKey));
    console.log('✅ Agent keypair loaded');
    console.log(`   Wallet: ${agentKeypair.publicKey.toString()}`);
  } catch (error) {
    console.error('❌ Invalid AGENT_PRIVATE_KEY format (must be base58)');
    process.exit(1);
  }

  // 2. Initialize executor
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    console.error('❌ Error: HELIUS_RPC_URL or SOLANA_RPC_URL not set');
    process.exit(1);
  }

  const executor = createTradingExecutor(rpcUrl);
  console.log('✅ Trading executor initialized');
  console.log(`   RPC: ${rpcUrl.slice(0, 50)}...`);

  // 3. Check wallet balance
  console.log('\n' + '='.repeat(60));
  console.log('Checking wallet balance...\n');
  
  const balance = await executor.getBalance(agentKeypair.publicKey);
  console.log(`💰 Current balance: ${balance.toFixed(4)} SOL`);

  if (balance < 0.02) {
    console.error('❌ Insufficient balance. Need at least 0.02 SOL for testing.');
    console.log('   Please fund this wallet and try again.');
    process.exit(1);
  }

  // 4. Test quote (no execution)
  console.log('\n' + '='.repeat(60));
  console.log('Testing Jupiter quote API...\n');

  const canTradeBonk = await executor.canQuote(BONK_MINT);
  console.log(`🔍 BONK tradeable: ${canTradeBonk ? '✅ Yes' : '❌ No'}`);

  if (!canTradeBonk) {
    console.error('❌ Cannot get quote for BONK. Jupiter may be down or token delisted.');
    process.exit(1);
  }

  // 5. Execute test BUY trade
  console.log('\n' + '='.repeat(60));
  console.log('Executing TEST BUY trade...\n');
  console.log('⚠️  This will spend real SOL on mainnet!');
  console.log('   Trade: 0.01 SOL → BONK');
  
  // Confirm before executing
  const confirmEnv = process.env.CONFIRM_TRADE;
  if (confirmEnv !== 'yes') {
    console.log('\n❌ Trade cancelled.');
    console.log('   To execute, set CONFIRM_TRADE=yes');
    console.log('   Example: CONFIRM_TRADE=yes AGENT_PRIVATE_KEY="..." bun run test-trading-executor.ts');
    process.exit(0);
  }

  console.log('✅ Trade confirmed. Executing...\n');

  try {
    const buyResult = await executor.executeBuy(
      agentKeypair,
      BONK_MINT,
      0.01 // 0.01 SOL (~$2)
    );

    console.log('\n' + '='.repeat(60));
    console.log('✅ BUY TRADE SUCCESSFUL!\n');
    console.log('Results:');
    console.log(`  Signature: ${buyResult.signature}`);
    console.log(`  SOL spent: ${buyResult.amountSol} SOL`);
    console.log(`  BONK received: ${buyResult.tokensReceived.toLocaleString()}`);
    console.log(`  Priority fee: ${buyResult.priorityFeeLamports.toLocaleString()} lamports`);
    console.log(`  Swap fee: ${buyResult.swapFeeSol.toFixed(6)} SOL`);
    console.log(`  Total fees: ${buyResult.totalFeesSol.toFixed(6)} SOL`);
    console.log(`  Fee %: ${((buyResult.totalFeesSol / buyResult.amountSol) * 100).toFixed(2)}%`);
    console.log(`  Execution time: ${buyResult.executionMs}ms`);
    console.log(`  Attempts: ${buyResult.attempt}`);
    console.log(`  Slippage: ${buyResult.slippageBps} bps`);
    if (buyResult.priceImpactPct !== undefined) {
      console.log(`  Price impact: ${buyResult.priceImpactPct.toFixed(2)}%`);
    }
    console.log(`\n  🔗 Solscan: https://solscan.io/tx/${buyResult.signature}`);

    // 6. Check if fees are within target (<1%)
    const feePercent = (buyResult.totalFeesSol / buyResult.amountSol) * 100;
    if (feePercent > 1.0) {
      console.log('\n⚠️  WARNING: Fees exceed 1% target!');
    } else {
      console.log('\n✅ Fees within target (<1%)');
    }

    // 7. Optional: Test SELL (uncomment to enable)
    /*
    console.log('\n' + '='.repeat(60));
    console.log('Testing SELL trade (selling half of BONK bought)...\n');

    const sellAmount = Math.floor(buyResult.tokensReceived / 2);
    
    const sellResult = await executor.executeSell(
      agentKeypair,
      BONK_MINT,
      sellAmount
    );

    console.log('\n✅ SELL TRADE SUCCESSFUL!\n');
    console.log('Results:');
    console.log(`  Signature: ${sellResult.signature}`);
    console.log(`  BONK sold: ${sellResult.tokensSold.toLocaleString()}`);
    console.log(`  SOL received: ${sellResult.solReceived.toFixed(4)} SOL`);
    console.log(`  Total fees: ${sellResult.totalFeesSol.toFixed(6)} SOL`);
    console.log(`  Fee %: ${((sellResult.totalFeesSol / sellResult.solReceived) * 100).toFixed(2)}%`);
    console.log(`\n  🔗 Solscan: https://solscan.io/tx/${sellResult.signature}`);
    */

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!\n');
    console.log('Next steps:');
    console.log('  1. Review transaction on Solscan');
    console.log('  2. Verify token balance in wallet');
    console.log('  3. Check fee percentages');
    console.log('  4. Integrate with position manager');
    
  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TRADE FAILED!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('No liquidity')) {
      console.log('\nTroubleshooting:');
      console.log('  - Token may have low liquidity');
      console.log('  - Try a more liquid token (USDC, BONK, WIF)');
    } else if (error.message.includes('timeout')) {
      console.log('\nTroubleshooting:');
      console.log('  - Jupiter API may be slow');
      console.log('  - Try again in a few minutes');
    } else if (error.message.includes('insufficient funds')) {
      console.log('\nTroubleshooting:');
      console.log('  - Check wallet balance');
      console.log('  - Ensure at least 0.02 SOL available');
    }
    
    process.exit(1);
  }
}

// Run test
testTradingExecutor().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
