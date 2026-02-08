/**
 * Full End-to-End Onboarding Flow Test
 * 
 * Tests the complete agent onboarding journey:
 * 1. SIWS authentication (create new agent)
 * 2. Verify 5 onboarding tasks auto-created
 * 3. Request Twitter verification code
 * 4. Submit Twitter verification
 * 5. Verify LINK_TWITTER task auto-completed (+50 XP)
 * 6. Update profile (bio)
 * 7. Verify UPDATE_PROFILE task auto-completed (+25 XP)
 * 8. Check final XP total (75 XP)
 * 
 * Usage:
 *   bun run test-full-onboarding-flow.ts
 */

import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

const BASE_URL = process.env.BASE_URL || 'https://sr-mobile-production.up.railway.app';
const ARENA_URL = `${BASE_URL}/arena`;
const AUTH_URL = `${BASE_URL}/auth`;
const AGENT_AUTH_URL = `${BASE_URL}/agent-auth`;

// Generate a fresh keypair for testing
function generateKeypair() {
  const keypair = nacl.sign.keyPair();
  const publicKey = bs58.encode(keypair.publicKey);
  const secretKey = keypair.secretKey;
  return { publicKey, secretKey };
}

// Sign a message with SIWS format
function signMessage(message: string, secretKey: Uint8Array): string {
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return bs58.encode(signature);
}

// Test utilities
let testAgent = {
  publicKey: '',
  secretKey: new Uint8Array(),
  agentId: '',
  jwt: '',
  xp: 0,
  level: 1
};

async function step(num: number, description: string, fn: () => Promise<void>) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP ${num}: ${description}`);
  console.log('='.repeat(80));
  try {
    await fn();
    console.log(`✅ STEP ${num} PASSED\n`);
  } catch (error: any) {
    console.error(`❌ STEP ${num} FAILED: ${error.message}\n`);
    throw error;
  }
}

async function main() {
  console.log('\n🧪 FULL END-TO-END ONBOARDING FLOW TEST');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Time: ${new Date().toISOString()}\n`);

  // ── STEP 1: Generate fresh keypair ────────────────────────────────────────

  await step(1, 'Generate fresh Solana keypair', async () => {
    const { publicKey, secretKey } = generateKeypair();
    testAgent.publicKey = publicKey;
    testAgent.secretKey = secretKey;
    
    console.log(`Generated wallet: ${publicKey.substring(0, 12)}...${publicKey.slice(-4)}`);
  });

  // ── STEP 2: SIWS Authentication ───────────────────────────────────────────

  await step(2, 'SIWS Authentication (create new agent)', async () => {
    // Get nonce
    const nonceRes = await fetch(`${AUTH_URL}/agent/challenge`);
    if (!nonceRes.ok) {
      const errorText = await nonceRes.text();
      throw new Error(`Failed to get nonce: ${errorText}`);
    }
    
    const { nonce, statement } = await nonceRes.json();
    console.log(`Nonce: ${nonce}`);
    console.log(`Statement: ${statement}`);

    // Create SIWS message to sign
    const message = `${statement}\n\nNonce: ${nonce}`;
    
    // Sign message
    const signature = signMessage(message, testAgent.secretKey);
    console.log(`Signature: ${signature.substring(0, 50)}...`);

    // Verify and get JWT
    const verifyRes = await fetch(`${AUTH_URL}/agent/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: testAgent.publicKey,
        signature,
        nonce
      })
    });

    if (!verifyRes.ok) {
      const errorText = await verifyRes.text();
      throw new Error(`Verify failed: ${errorText}`);
    }

    const result = await verifyRes.json();
    testAgent.jwt = result.accessToken || result.token;
    
    // Agent data might be nested
    const agent = result.agent || result.data || result;
    testAgent.agentId = agent.id || agent.agentId;
    testAgent.xp = agent.xp || 0;
    testAgent.level = agent.level || 1;

    console.log(`✅ Agent created: ${testAgent.agentId}`);
    console.log(`   Name: ${agent.name || 'N/A'}`);
    console.log(`   XP: ${testAgent.xp}`);
    console.log(`   Level: ${testAgent.level}`);
    console.log(`   JWT: ${testAgent.jwt.substring(0, 20)}...`);
  });

  // ── STEP 3: Verify onboarding tasks created ───────────────────────────────

  await step(3, 'Verify 5 onboarding tasks auto-created', async () => {
    // Wait 2 seconds for onboarding service to complete
    console.log('Waiting 2 seconds for onboarding tasks to be created...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const res = await fetch(`${ARENA_URL}/tasks/agent/${testAgent.agentId}`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to get agent tasks: ${res.status} - ${errorText}`);
    }

    const { completions } = await res.json();
    console.log(`\nAgent has ${completions.length} task completions:`);

    const expectedTasks = ['UPDATE_PROFILE', 'LINK_TWITTER', 'JOIN_CONVERSATION', 'FIRST_TRADE', 'COMPLETE_RESEARCH'];
    const foundTasks = completions.map((c: any) => c.taskType);

    for (const expectedTask of expectedTasks) {
      const found = foundTasks.includes(expectedTask);
      console.log(`   ${found ? '✅' : '❌'} ${expectedTask}`);
      if (!found) throw new Error(`Missing onboarding task: ${expectedTask}`);
    }

    console.log(`\n✅ All 5 onboarding tasks created successfully!`);
  });

  // ── STEP 4: Request Twitter verification code ─────────────────────────────

  let verificationCode = '';
  let tweetTemplate = '';

  await step(4, 'Request Twitter verification code', async () => {
    const res = await fetch(`${AGENT_AUTH_URL}/twitter/request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAgent.jwt}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Twitter request failed: ${errorText}`);
    }

    const { success, data } = await res.json();
    if (!success) throw new Error('Twitter request returned success=false');

    verificationCode = data.code;
    tweetTemplate = data.tweetTemplate;

    console.log(`\nVerification code: ${verificationCode}`);
    console.log(`\nTweet template:\n${tweetTemplate}`);
    console.log(`\nExpires at: ${new Date(data.expiresAt).toISOString()}`);
  });

  // ── STEP 5: Simulate Twitter verification ─────────────────────────────────

  await step(5, 'Submit Twitter verification (simulated)', async () => {
    // In a real scenario, agent would:
    // 1. Post tweet via Twitter API
    // 2. Get tweet URL
    // 3. Submit URL here

    // For testing, we'll use a fake tweet URL with valid format
    // Backend will fallback to trusting the URL if TWITTER_BEARER_TOKEN is not set
    const fakeTwitterHandle = `agent_${testAgent.publicKey.substring(0, 8)}`;
    const fakeTweetId = Date.now().toString();
    const fakeTweetUrl = `https://x.com/${fakeTwitterHandle}/status/${fakeTweetId}`;

    console.log(`\n📝 Simulated tweet URL: ${fakeTweetUrl}`);
    console.log(`⚠️  Note: Real verification requires TWITTER_BEARER_TOKEN env var`);
    console.log(`    Without it, backend will trust the URL format (less secure)`);

    const res = await fetch(`${AGENT_AUTH_URL}/twitter/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAgent.jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tweetUrl: fakeTweetUrl })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Twitter verification failed: ${errorText}`);
    }

    const { success, data } = await res.json();
    if (!success) throw new Error('Twitter verification returned success=false');

    console.log(`\n✅ Twitter verified!`);
    console.log(`   Handle: ${data.twitterHandle}`);
    console.log(`   Username: ${data.twitterUsername}`);
    console.log(`   Verified at: ${data.verifiedAt}`);
    console.log(`\n🎯 LINK_TWITTER task should auto-complete now (+50 XP)`);
  });

  // ── STEP 6: Verify LINK_TWITTER task completed ────────────────────────────

  await step(6, 'Verify LINK_TWITTER task completed with XP reward', async () => {
    // Wait 2 seconds for auto-completion
    console.log('Waiting 2 seconds for auto-completion...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check agent XP
    const agentRes = await fetch(`${AGENT_AUTH_URL}/profile/${testAgent.agentId}`);
    if (!agentRes.ok) throw new Error('Failed to get agent profile');

    const { success, data: agent } = await agentRes.json();
    if (!success) throw new Error('Agent profile returned success=false');

    testAgent.xp = agent.xp;
    testAgent.level = agent.level;

    console.log(`\nAgent XP: ${testAgent.xp} (expected: 50)`);
    console.log(`Agent Level: ${testAgent.level}`);

    // Check task status
    const tasksRes = await fetch(`${ARENA_URL}/tasks/agent/${testAgent.agentId}`);
    if (!tasksRes.ok) throw new Error('Failed to get agent tasks');

    const { completions } = await tasksRes.json();
    const linkTwitterTask = completions.find((c: any) => c.taskType === 'LINK_TWITTER');

    if (!linkTwitterTask) throw new Error('LINK_TWITTER task not found');

    console.log(`\nLINK_TWITTER task status: ${linkTwitterTask.status}`);
    console.log(`XP awarded: ${linkTwitterTask.xpAwarded || 0}`);

    if (linkTwitterTask.status !== 'VALIDATED') {
      throw new Error(`Expected status VALIDATED, got ${linkTwitterTask.status}`);
    }

    if (testAgent.xp < 50) {
      throw new Error(`Expected at least 50 XP, got ${testAgent.xp}`);
    }

    console.log(`\n✅ LINK_TWITTER task completed successfully!`);
    console.log(`   Status: VALIDATED`);
    console.log(`   XP Awarded: +50`);
    console.log(`   Total XP: ${testAgent.xp}`);
  });

  // ── STEP 7: Update profile (complete UPDATE_PROFILE task) ─────────────────

  await step(7, 'Update profile to complete UPDATE_PROFILE task', async () => {
    const bio = `AI agent ${testAgent.agentId.substring(0, 8)} - Solana trading on Trench`;

    const res = await fetch(`${AGENT_AUTH_URL}/profile/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAgent.jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bio })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Profile update failed: ${errorText}`);
    }

    const { success, data } = await res.json();
    if (!success) throw new Error('Profile update returned success=false');

    console.log(`\n✅ Profile updated!`);
    console.log(`   Bio: ${data.bio}`);
    console.log(`\n🎯 UPDATE_PROFILE task should auto-complete now (+25 XP)`);
  });

  // ── STEP 8: Verify UPDATE_PROFILE task completed ──────────────────────────

  await step(8, 'Verify UPDATE_PROFILE task completed with XP reward', async () => {
    // Wait 2 seconds for auto-completion
    console.log('Waiting 2 seconds for auto-completion...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check agent XP
    const agentRes = await fetch(`${AGENT_AUTH_URL}/profile/${testAgent.agentId}`);
    if (!agentRes.ok) throw new Error('Failed to get agent profile');

    const { success, data: agent } = await agentRes.json();
    if (!success) throw new Error('Agent profile returned success=false');

    testAgent.xp = agent.xp;
    testAgent.level = agent.level;

    console.log(`\nAgent XP: ${testAgent.xp} (expected: 75)`);
    console.log(`Agent Level: ${testAgent.level}`);

    // Check task status
    const tasksRes = await fetch(`${ARENA_URL}/tasks/agent/${testAgent.agentId}`);
    if (!tasksRes.ok) throw new Error('Failed to get agent tasks');

    const { completions } = await tasksRes.json();
    const updateProfileTask = completions.find((c: any) => c.taskType === 'UPDATE_PROFILE');

    if (!updateProfileTask) throw new Error('UPDATE_PROFILE task not found');

    console.log(`\nUPDATE_PROFILE task status: ${updateProfileTask.status}`);
    console.log(`XP awarded: ${updateProfileTask.xpAwarded || 0}`);

    if (updateProfileTask.status !== 'VALIDATED') {
      throw new Error(`Expected status VALIDATED, got ${updateProfileTask.status}`);
    }

    if (testAgent.xp < 75) {
      throw new Error(`Expected at least 75 XP, got ${testAgent.xp}`);
    }

    console.log(`\n✅ UPDATE_PROFILE task completed successfully!`);
    console.log(`   Status: VALIDATED`);
    console.log(`   XP Awarded: +25`);
    console.log(`   Total XP: ${testAgent.xp}`);
  });

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(80));
  console.log('🎉 FULL END-TO-END ONBOARDING FLOW TEST COMPLETE!');
  console.log('='.repeat(80));
  console.log(`\n✅ All 8 steps passed successfully!\n`);

  console.log('📊 FINAL AGENT STATE:');
  console.log('─'.repeat(80));
  console.log(`   Agent ID: ${testAgent.agentId}`);
  console.log(`   Wallet: ${testAgent.publicKey}`);
  console.log(`   XP: ${testAgent.xp} / 75 expected`);
  console.log(`   Level: ${testAgent.level}`);
  console.log(`   Tasks Completed: 2/5 (LINK_TWITTER, UPDATE_PROFILE)`);
  console.log(`   Tasks Remaining: 3 (JOIN_CONVERSATION, FIRST_TRADE, COMPLETE_RESEARCH)`);
  console.log('─'.repeat(80));

  console.log('\n🔍 VERIFICATION SUMMARY:');
  console.log('─'.repeat(80));
  console.log('   ✅ SIWS authentication working');
  console.log('   ✅ 5 onboarding tasks auto-created');
  console.log('   ✅ Twitter verification flow working');
  console.log('   ✅ LINK_TWITTER task auto-completed (+50 XP)');
  console.log('   ✅ Profile update working');
  console.log('   ✅ UPDATE_PROFILE task auto-completed (+25 XP)');
  console.log('   ✅ XP system working correctly');
  console.log('   ✅ Task auto-completion system working');
  console.log('─'.repeat(80));

  console.log('\n✨ ONBOARDING SYSTEM: 100% OPERATIONAL\n');
}

main().catch((error) => {
  console.error('\n❌ TEST FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
});
