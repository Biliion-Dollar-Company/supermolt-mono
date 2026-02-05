#!/usr/bin/env bun
/**
 * DR Wallet Test Swap
 * Executes a small Jupiter swap to test E2E flow
 */

import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const JUPITER_API = 'https://quote-api.jup.ag/v6';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

async function main() {
  console.log('🚀 Starting DR Wallet Test Swap\n');

  // 1. Load wallet from private key
  const privateKey = process.env.AGENT_ALPHA_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ AGENT_ALPHA_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
  console.log('✅ Wallet loaded:', wallet.publicKey.toBase58());

  // 2. Check balance
  const connection = new Connection(RPC_URL);
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.02 * 1e9) {
    console.error('❌ Insufficient balance (need at least 0.02 SOL)');
    process.exit(1);
  }

  // 3. Get Jupiter quote
  console.log('\n📊 Getting Jupiter quote...');
  const amount = 0.01 * 1e9; // 0.01 SOL in lamports

  const quoteResponse = await fetch(
    `${JUPITER_API}/quote?inputMint=${SOL_MINT}&outputMint=${BONK_MINT}&amount=${amount}&slippageBps=50`
  );
  const quote = await quoteResponse.json();

  if (quote.error) {
    console.error('❌ Quote error:', quote.error);
    process.exit(1);
  }

  console.log(`✅ Quote received:`);
  console.log(`   Input: ${(amount / 1e9).toFixed(4)} SOL`);
  console.log(`   Output: ${(parseInt(quote.outAmount) / 1e5).toFixed(2)} BONK`);
  console.log(`   Price Impact: ${quote.priceImpactPct}%`);

  // 4. Get swap transaction
  console.log('\n🔨 Building swap transaction...');
  const swapResponse = await fetch(`${JUPITER_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
    }),
  });

  const { swapTransaction } = await swapResponse.json();
  console.log('✅ Transaction built');

  // 5. Sign and send
  console.log('\n✍️  Signing transaction...');
  const transactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuf);
  transaction.sign([wallet]);

  console.log('📡 Sending transaction...');
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  console.log(`✅ Transaction sent: ${signature}`);
  console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);

  // 6. Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...');
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');

  if (confirmation.value.err) {
    console.error('❌ Transaction failed:', confirmation.value.err);
    process.exit(1);
  }

  console.log('✅ Transaction confirmed!\n');

  // 7. Wait for webhook to process
  console.log('⏳ Waiting 10 seconds for webhook processing...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 8. Check if trade appeared in database
  console.log('\n🔍 Checking if trade was captured...');
  const apiResponse = await fetch(
    'https://sr-mobile-production.up.railway.app/feed/activity?limit=10'
  );
  const apiData = await apiResponse.json();

  const matchingTrade = apiData.data.activities.find(
    (activity: any) => activity.timestamp > new Date(Date.now() - 60000).toISOString()
  );

  if (matchingTrade) {
    console.log('✅ Trade detected in system!');
    console.log('   Agent ID:', matchingTrade.agentId);
    console.log('   Action:', matchingTrade.action);
    console.log('   Token:', matchingTrade.token);
    console.log('   Amount:', matchingTrade.amount, 'SOL');
  } else {
    console.log('⚠️  Trade not yet captured (webhook may need more time)');
    console.log('   Check manually: https://sr-mobile-production.up.railway.app/feed/activity');
  }

  console.log('\n🎉 Test complete!');
  console.log('\n📊 Next steps:');
  console.log('   1. Check leaderboard: https://trench-terminal-omega.vercel.app/');
  console.log('   2. Verify webhook logs on Railway');
  console.log('   3. Check database records');
}

main().catch(console.error);
