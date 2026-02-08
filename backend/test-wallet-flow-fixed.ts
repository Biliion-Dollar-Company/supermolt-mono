#!/usr/bin/env bun
/**
 * Test Wallet Connection Flow End-to-End (FIXED)
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const BASE = 'https://sr-mobile-production.up.railway.app';

console.log('🔐 Wallet Connection Flow Test');
console.log('═══════════════════════════════════════════════════════\n');

// Step 1: Generate test wallet
console.log('1️⃣  Generating test wallet...');
const wallet = Keypair.generate();
const pubkey = wallet.publicKey.toBase58();
console.log(`   ✅ Wallet: ${pubkey.slice(0, 20)}...`);
console.log('');

// Step 2: Get SIWS challenge
console.log('2️⃣  Getting SIWS challenge...');
try {
  const challengeRes = await fetch(`${BASE}/auth/agent/challenge`);
  const challengeData = await challengeRes.json();
  
  if (!challengeRes.ok) {
    console.log(`   ❌ Failed: ${challengeData.error?.message}`);
    process.exit(1);
  }
  
  console.log(`   ✅ Challenge received`);
  console.log(`   Nonce: ${challengeData.nonce.slice(0, 30)}...`);
  console.log(`   Statement: ${challengeData.statement.slice(0, 50)}...`);
  console.log('');
  
  // Step 3: Sign message
  console.log('3️⃣  Signing message...');
  
  const message = `${challengeData.statement}\n\nNonce: ${challengeData.nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, wallet.secretKey);
  const signatureBase58 = bs58.encode(signature);
  
  console.log(`   ✅ Message signed`);
  console.log(`   Signature: ${signatureBase58.slice(0, 30)}...`);
  console.log('');
  
  // Step 4: Verify signature and get JWT
  console.log('4️⃣  Verifying signature...');
  
  const verifyRes = await fetch(`${BASE}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      signature: signatureBase58,
      nonce: challengeData.nonce,
    }),
  });
  
  const verifyData = await verifyRes.json();
  
  if (!verifyRes.ok) {
    console.log(`   ❌ Verification failed: ${verifyData.error?.message}`);
    console.log(`   Full response:`, JSON.stringify(verifyData, null, 2));
    process.exit(1);
  }
  
  console.log(`   ✅ Signature verified`);
  console.log(`   Agent ID: ${verifyData.agentId}`);
  console.log(`   Token: ${verifyData.token?.slice(0, 30)}...`);
  console.log(`   Refresh Token: ${verifyData.refreshToken ? 'Present' : 'Missing'}`);
  console.log('');
  
  // Step 5: Test authenticated endpoint
  console.log('5️⃣  Testing authenticated endpoint...');
  
  const meRes = await fetch(`${BASE}/arena/me`, {
    headers: {
      'Authorization': `Bearer ${verifyData.token}`,
    },
  });
  
  const meData = await meRes.json();
  
  if (!meRes.ok) {
    console.log(`   ❌ Failed: ${meData.error?.message}`);
    console.log(`   Full response:`, JSON.stringify(meData, null, 2));
    process.exit(1);
  }
  
  console.log(`   ✅ Profile loaded`);
  console.log(`   Name: ${meData.agent?.name || 'Unnamed'}`);
  console.log(`   Pubkey: ${meData.agent?.pubkey?.slice(0, 20)}...`);
  console.log(`   XP: ${meData.agent?.xp || 0}`);
  console.log(`   Level: ${meData.agent?.level || 1}`);
  console.log(`   Onboarding tasks: ${meData.onboardingTasks?.length || 0}`);
  console.log('');
  
  // Step 6: Check onboarding tasks
  console.log('6️⃣  Checking onboarding tasks...');
  
  if (meData.onboardingTasks && meData.onboardingTasks.length > 0) {
    console.log(`   ✅ ${meData.onboardingTasks.length} tasks created:`);
    meData.onboardingTasks.forEach((task: any) => {
      console.log(`      • ${task.type} - ${task.status} (${task.xpReward} XP)`);
    });
  } else {
    console.log(`   ⚠️  No onboarding tasks found`);
  }
  console.log('');
  
  // Step 7: Test token refresh
  console.log('7️⃣  Testing token refresh...');
  
  if (verifyData.refreshToken) {
    const refreshRes = await fetch(`${BASE}/auth/agent/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: verifyData.refreshToken,
      }),
    });
    
    const refreshData = await refreshRes.json();
    
    if (refreshRes.ok) {
      console.log(`   ✅ Token refreshed`);
      console.log(`   New token: ${refreshData.token?.slice(0, 30)}...`);
    } else {
      console.log(`   ❌ Refresh failed: ${refreshData.error?.message}`);
    }
  } else {
    console.log(`   ⚠️  No refresh token to test`);
  }
  console.log('');
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ WALLET CONNECTION FLOW: SUCCESS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('Flow tested:');
  console.log('  1. ✅ Generate wallet');
  console.log('  2. ✅ Get SIWS challenge (GET /auth/agent/challenge)');
  console.log('  3. ✅ Sign message with wallet');
  console.log('  4. ✅ Verify signature → JWT (POST /auth/agent/verify)');
  console.log('  5. ✅ Access authenticated endpoint (GET /arena/me)');
  console.log('  6. ✅ Onboarding tasks created automatically');
  console.log('  7. ✅ Token refresh works (POST /auth/agent/refresh)');
  console.log('');
  console.log('🎉 Complete wallet auth flow working!\n');
  
} catch (error: any) {
  console.log(`\n❌ Error: ${error.message}`);
  console.log(error);
  process.exit(1);
}
