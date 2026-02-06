/**
 * Single Agent Authentication Test
 * Authenticate one agent and verify JWT
 */

import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';

const API_URL = process.env.API_URL || 'https://sr-mobile-production.up.railway.app';

// Private key provided by Henry (Agent Alpha)
const PRIVATE_KEY_HEX = '8ab4d6bac4228ba4bfa97baf1a122a85b0f0fa7c8a6176998c56319e96fb5a721f7e267cc7028931082b0022ec49edcb99e090a52530635c1f7c36141d015dbf';
const PRIVATE_KEY = Buffer.from(PRIVATE_KEY_HEX, 'hex');

async function authenticateAgent() {
  console.log('🚀 Authenticating Agent...\n');

  // Load keypair
  const keypair = Keypair.fromSecretKey(PRIVATE_KEY);
  const publicKey = keypair.publicKey.toBase58();
  
  console.log(`Public Key: ${publicKey}\n`);

  // Step 1: Get challenge
  console.log('📋 Step 1: Requesting nonce...');
  const challengeRes = await fetch(`${API_URL}/auth/agent/challenge`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!challengeRes.ok) {
    throw new Error(`Challenge failed: ${await challengeRes.text()}`);
  }

  const { nonce } = await challengeRes.json();
  console.log(`   ✓ Nonce: ${nonce}\n`);

  // Step 2: Sign the nonce
  console.log('✍️  Step 2: Signing nonce...');
  const messageBytes = Buffer.from(nonce);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase64 = Buffer.from(signature).toString('base64');
  console.log(`   ✓ Signature generated (${signatureBase64.length} chars)\n`);

  // Step 3: Verify and get JWT
  console.log('🔐 Step 3: Verifying signature...');
  const verifyRes = await fetch(`${API_URL}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey: publicKey,
      signature: signatureBase64,
      nonce: nonce,
    }),
  });

  if (!verifyRes.ok) {
    const errorText = await verifyRes.text();
    throw new Error(`Verification failed: ${errorText}`);
  }

  const result = await verifyRes.json();
  console.log(`   ✓ Authentication successful!\n`);

  // Display result
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ AUTHENTICATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Agent Public Key: ${publicKey}`);
  console.log(`JWT Token: ${result.token.substring(0, 50)}...`);
  console.log(`Token Length: ${result.token.length} characters`);
  
  if (result.agent) {
    console.log(`\nAgent Info:`);
    console.log(`  - ID: ${result.agent.id}`);
    console.log(`  - Created: ${result.agent.createdAt || 'N/A'}`);
    console.log(`  - Status: ${result.agent.status || 'Active'}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test the token with a protected endpoint
  console.log('🔬 Testing JWT with protected endpoint...');
  const testRes = await fetch(`${API_URL}/agents/${publicKey}`, {
    headers: { 'Authorization': `Bearer ${result.token}` },
  });

  if (testRes.ok) {
    const agentData = await testRes.json();
    console.log('   ✓ JWT works! Agent data retrieved:');
    console.log(JSON.stringify(agentData, null, 2));
  } else {
    console.log(`   ⚠️ Agent lookup returned: ${testRes.status}`);
  }

  console.log('\n🎉 All done! Agent is authenticated and ready.\n');
  
  return { publicKey, token: result.token };
}

// Run
authenticateAgent().catch(error => {
  console.error('\n❌ Authentication failed:', error.message);
  process.exit(1);
});
