/**
 * Test SIWS auth flow and verify onboarding tasks are created
 */

import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

const API_BASE = 'https://sr-mobile-production.up.railway.app';

async function testSIWSOnboarding() {
  console.log('\n🧪 Testing SIWS Onboarding Flow\n');

  // Step 1: Generate a fresh wallet
  console.log('Step 1: Generating new wallet...');
  const keypair = nacl.sign.keyPair();
  const pubkey = bs58.encode(keypair.publicKey);
  console.log(`✅ Wallet: ${pubkey}`);

  // Step 2: Get challenge
  console.log('\nStep 2: Getting SIWS challenge...');
  const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge`);
  if (!challengeRes.ok) {
    console.error(`❌ Challenge failed: ${challengeRes.status} ${challengeRes.statusText}`);
    return;
  }
  
  const { nonce, statement } = await challengeRes.json();
  console.log(`✅ Nonce: ${nonce.substring(0, 20)}...`);
  console.log(`   Statement: "${statement}"`);

  // Step 3: Sign the challenge
  console.log('\nStep 3: Signing message...');
  const message = `${statement}\n\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signature = Buffer.from(signatureBytes).toString('base64');
  console.log(`✅ Signature: ${signature.substring(0, 40)}...`);

  // Step 4: Verify (this should trigger onboarding task creation)
  console.log('\nStep 4: Verifying signature (should create onboarding tasks)...');
  const verifyRes = await fetch(`${API_BASE}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey, signature, nonce }),
  });

  if (!verifyRes.ok) {
    const error = await verifyRes.text();
    console.error(`❌ Verify failed: ${verifyRes.status}`);
    console.error(error);
    return;
  }

  const verifyData = await verifyRes.json();
  console.log(`✅ Verified! Agent ID: ${verifyData.agent.id}`);
  console.log(`   Token received: ${verifyData.token.substring(0, 40)}...`);
  
  const agentId = verifyData.agent.id;
  const token = verifyData.token;

  // Step 5: Wait a moment for tasks to be created
  console.log('\nStep 5: Waiting 2 seconds for tasks to be created...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 6: Check for onboarding tasks
  console.log('\nStep 6: Fetching onboarding tasks for agent...');
  const tasksRes = await fetch(`${API_BASE}/arena/tasks?status=OPEN`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!tasksRes.ok) {
    console.error(`❌ Failed to fetch tasks: ${tasksRes.status}`);
    return;
  }

  const tasksData = await tasksRes.json();
  console.log(`   Raw response type: ${typeof tasksData}`);
  console.log(`   Response keys: ${Object.keys(tasksData).join(', ')}`);
  
  const tasks = Array.isArray(tasksData) ? tasksData : tasksData.tasks || [];
  const onboardingTasks = tasks.filter((t: any) => !t.tokenMint);
  
  console.log(`\n📊 Results:`);
  console.log(`   Total tasks: ${tasks.length}`);
  console.log(`   Onboarding tasks (tokenMint=null): ${onboardingTasks.length}`);

  if (onboardingTasks.length > 0) {
    console.log(`\n✅ SUCCESS! Onboarding tasks created:`);
    onboardingTasks.forEach((t: any) => {
      console.log(`   - ${t.taskType}: ${t.title} (+${t.xpReward} XP)`);
    });
  } else {
    console.log(`\n❌ FAILURE! No onboarding tasks found.`);
    console.log(`\nCheck Railway logs for errors:`);
    console.log(`   railway logs | grep "onboarding"`);
  }

  // Step 7: Check agent profile
  console.log(`\nStep 7: Checking agent profile...`);
  const meRes = await fetch(`${API_BASE}/arena/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (meRes.ok) {
    const profile = await meRes.json();
    console.log(`✅ Agent: ${profile.agent.name}`);
    console.log(`   XP: ${profile.agent.xp}`);
    console.log(`   Level: ${profile.agent.level}`);
  }

  console.log(`\n🎯 Test complete. Agent ID for reference: ${agentId}`);
}

testSIWSOnboarding().catch(console.error);
