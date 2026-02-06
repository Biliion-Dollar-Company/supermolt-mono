/**
 * Execute REAL Jupiter swap from Agent Alpha
 * SOL → BONK (small amount)
 */

import { Keypair, Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';

const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Agent Alpha (Henry's funded wallet)
const AGENT_ALPHA_KEY = Buffer.from(
  '101f3878c5e29150a44a10c73508eb05624b084b6b6615a150f94d9c38fc15e9231a6b1983aa11eea8c482d4e441f29ca4e549df044f71c85a89a0a27a2976b1',
  'hex'
);

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK
const SWAP_AMOUNT = 0.001; // 0.001 SOL worth of BONK

async function executeJupiterSwap() {
  console.log('🚀 Executing REAL Jupiter Swap from Agent Alpha\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = Keypair.fromSecretKey(AGENT_ALPHA_KEY);
  
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Swap: ${SWAP_AMOUNT} SOL → BONK\n`);

  // Step 1: Get quote from Jupiter
  console.log('📊 Step 1: Getting Jupiter quote...');
  const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${BONK_MINT}&amount=${Math.floor(SWAP_AMOUNT * 1e9)}&slippageBps=50`;
  
  const quoteRes = await fetch(quoteUrl);
  const quoteData = await quoteRes.json();
  
  if (quoteData.error) {
    throw new Error(`Jupiter quote failed: ${quoteData.error}`);
  }
  
  console.log(`   ✓ Quote received`);
  console.log(`   Input: ${SWAP_AMOUNT} SOL`);
  console.log(`   Output: ~${(parseInt(quoteData.outAmount) / 1e5).toFixed(0)} BONK\n`);

  // Step 2: Get swap transaction
  console.log('📝 Step 2: Building swap transaction...');
  const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quoteData,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto'
    })
  });

  const swapData = await swapRes.json();
  
  if (swapData.error) {
    throw new Error(`Jupiter swap failed: ${swapData.error}`);
  }

  console.log(`   ✓ Transaction built\n`);

  // Step 3: Deserialize and sign
  console.log('✍️  Step 3: Signing transaction...');
  const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  transaction.sign([wallet]);
  console.log(`   ✓ Signed\n`);

  // Step 4: Send transaction
  console.log('📤 Step 4: Sending to blockchain...');
  const rawTransaction = transaction.serialize();
  const signature = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 2
  });

  console.log(`   ✓ Signature: ${signature}`);
  console.log(`   🔗 https://solscan.io/tx/${signature}\n`);

  // Step 5: Confirm
  console.log('⏳ Step 5: Waiting for confirmation...');
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  console.log(`   ✅ CONFIRMED!\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 REAL SWAP EXECUTED ON MAINNET!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\nTransaction: ${signature}`);
  console.log(`Token: BONK (${BONK_MINT})`);
  console.log(`Amount: ${SWAP_AMOUNT} SOL worth`);
  console.log(`\n🔍 Helius should detect this within 10 seconds...`);
  console.log(`📡 Agent Beta should receive WebSocket event!\n`);

  return signature;
}

executeJupiterSwap().catch(error => {
  console.error('\n❌ Swap failed:', error.message);
  process.exit(1);
});
