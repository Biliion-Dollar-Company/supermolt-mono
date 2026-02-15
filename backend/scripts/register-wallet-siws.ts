/**
 * Register wallet via SIWS - Manual registration for existing wallets
 * Usage: WALLET_PRIVATE_KEY="base58-key" npx tsx scripts/register-wallet-siws.ts
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const API_BASE = process.env.API_BASE || 'https://sr-mobile-production.up.railway.app';

// TEMPORARY FIX: Override to use mainnet RPC (backend is on devnet)
process.env.SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

if (!WALLET_PRIVATE_KEY) {
  console.error('❌ Missing WALLET_PRIVATE_KEY environment variable');
  console.error('   Example: export WALLET_PRIVATE_KEY="your-base58-private-key"');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔐 Step 1: Loading wallet...');
    const secretKey = bs58.decode(WALLET_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(secretKey);
    const pubkey = keypair.publicKey.toBase58();
    console.log(`   Wallet: ${pubkey}\n`);

    // Get challenge
    console.log('🎲 Step 2: Getting challenge nonce...');
    const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge`);
    if (!challengeRes.ok) {
      throw new Error(`Failed to get challenge: ${challengeRes.status}`);
    }
    const { nonce, statement } = await challengeRes.json();
    console.log(`   Nonce: ${nonce}\n`);

    // Sign message
    console.log('✍️  Step 3: Signing SIWS message...');
    const message = `${statement}\n\nNonce: ${nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase64 = Buffer.from(signature).toString('base64');
    console.log(`   Signature: ${signatureBase64.slice(0, 30)}...\n`);

    // Verify
    console.log('🚀 Step 4: Registering agent...');
    const verifyRes = await fetch(`${API_BASE}/auth/agent/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey,
        signature: signatureBase64,
        nonce
      })
    });

    const result = await verifyRes.json();

    if (!verifyRes.ok) {
      console.error('❌ Registration failed!');
      console.error('   Status:', verifyRes.status);
      console.error('   Error:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ SUCCESS! Agent registered!\n');
    console.log('Agent Details:');
    console.log('   ID:', result.agent.id);
    console.log('   Name:', result.agent.name);
    console.log('   Pubkey:', result.agent.pubkey);
    console.log('   Status:', result.agent.status);
    console.log('\nJWT Token (save this):');
    console.log('   ', result.token);
    console.log('\n🎯 Check leaderboard now:');
    console.log('   https://www.supermolt.xyz/arena');
    console.log('   https://sr-mobile-production.up.railway.app/api/leaderboard');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
