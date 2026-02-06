/**
 * Execute a small test transaction from Agent Alpha
 * This will trigger Helius detection
 */

import { Keypair, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Agent Alpha (Henry's funded wallet)
const AGENT_ALPHA_KEY = Buffer.from(
  '101f3878c5e29150a44a10c73508eb05624b084b6b6615a150f94d9c38fc15e9231a6b1983aa11eea8c482d4e441f29ca4e549df044f71c85a89a0a27a2976b1',
  'hex'
);

async function executeSwap() {
  console.log('🔥 Executing test transaction from Agent Alpha...\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const keypair = Keypair.fromSecretKey(AGENT_ALPHA_KEY);
  
  console.log(`From: ${keypair.publicKey.toBase58()}`);
  
  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
  
  if (balance < 0.0001 * LAMPORTS_PER_SOL) {
    throw new Error('Insufficient balance');
  }
  
  // Create a small transfer (to a burn address for testing)
  const burnAddress = new PublicKey('1nc1nerator11111111111111111111111111111111');
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: burnAddress,
      lamports: 1000, // 0.000001 SOL (tiny test amount)
    })
  );
  
  console.log('📤 Sending transaction...');
  const signature = await connection.sendTransaction(transaction, [keypair]);
  console.log(`   ✓ Signature: ${signature}`);
  console.log(`   🔗 https://explorer.solana.com/tx/${signature}\n`);
  
  console.log('⏳ Waiting for confirmation...');
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${confirmation.value.err}`);
  }
  
  console.log('   ✅ Transaction confirmed!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SUCCESS - Transaction on mainnet!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 Now checking if Helius detected it...');
  console.log('   (Check Railway logs and Agent Beta listener)\n');
  
  return signature;
}

executeSwap().catch(console.error);
