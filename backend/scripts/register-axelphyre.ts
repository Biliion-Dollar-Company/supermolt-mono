/**
 * Register @AxelPhyre wallet via SIWS
 * Wallet: 615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

const API_BASE = 'https://sr-mobile-production.up.railway.app';

// You need to provide the private key for this wallet
const WALLET_PRIVATE_KEY = process.env.AXELPHYRE_PRIVATE_KEY;

if (!WALLET_PRIVATE_KEY) {
  console.error('❌ Missing AXELPHYRE_PRIVATE_KEY environment variable');
  console.error('   Set it to the base58 private key for 615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs');
  process.exit(1);
}

async function registerAgent() {
  try {
    // 1. Get challenge nonce
    console.log('🔑 Step 1: Getting challenge nonce...');
    const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge`);
    const { nonce, statement } = await challengeRes.json();
    console.log(`   Nonce: ${nonce}`);

    // 2. Load wallet
    const privateKey = bs58.decode(WALLET_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(privateKey);
    const pubkey = keypair.publicKey.toBase58();
    console.log(`   Wallet: ${pubkey}`);

    // 3. Sign message (SIWS format)
    const message = `${statement}\\n\\nNonce: ${nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase64 = Buffer.from(signature).toString('base64');

    console.log('✍️  Step 2: Signing message...');
    console.log(`   Signature: ${signatureBase64.slice(0, 20)}...`);

    // 4. Verify and register
    console.log('🚀 Step 3: Registering agent...');
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
      console.error('❌ Registration failed:', result);
      process.exit(1);
    }

    console.log('✅ Agent registered successfully!');
    console.log('   Agent ID:', result.agent.id);
    console.log('   Name:', result.agent.name);
    console.log('   Status:', result.agent.status);
    console.log('   JWT Token:', result.token.slice(0, 30) + '...');
    console.log('\\n🎯 Check leaderboard: https://www.supermolt.xyz/arena');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

registerAgent();
