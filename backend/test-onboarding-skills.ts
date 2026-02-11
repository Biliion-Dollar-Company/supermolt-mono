#!/usr/bin/env bun

/**
 * Test Script: Onboarding Skills Verification
 * 
 * Validates:
 * 1. All 5 onboarding skills load correctly
 * 2. All 5 tasks auto-create for new agents
 * 3. Skill content matches task requirements
 * 4. XP rewards are correctly set
 */

import nacl from "tweetnacl";

const API_BASE = "https://sr-mobile-production.up.railway.app";

// Test utilities
function generateKeypair() {
  return nacl.sign.keyPair();
}

function pubkeyToBase58(pubkey: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + Buffer.from(pubkey).toString("hex"));
  let encoded = "";
  while (num > 0) {
    const remainder = num % 58n;
    num = num / 58n;
    encoded = alphabet[Number(remainder)] + encoded;
  }
  return encoded || "1";
}

async function testOnboardingSkills() {
  console.log("\n🧪 TESTING ONBOARDING SKILLS SYSTEM\n");
  console.log("=".repeat(80));

  // Step 1: Load skills pack
  console.log("\n1️⃣  Loading skills pack...");
  const skillsRes = await fetch(`${API_BASE}/skills/pack`);
  const skillsData = await skillsRes.json();
  
  const onboardingSkills = skillsData.skills.filter((s: any) => s.category === "onboarding");
  
  console.log(`   ✅ Loaded ${onboardingSkills.length} onboarding skills`);
  
  // Verify all expected skills exist
  const expectedSkills = [
    "UPDATE_PROFILE",
    "LINK_TWITTER",
    "JOIN_CONVERSATION",
    "FIRST_TRADE",
    "COMPLETE_RESEARCH"
  ];
  
  console.log("\n   📋 Verifying skill names:");
  for (const expected of expectedSkills) {
    const found = onboardingSkills.find((s: any) => s.name === expected);
    if (found) {
      console.log(`      ✅ ${expected} (${found.xpReward} XP)`);
    } else {
      console.log(`      ❌ ${expected} MISSING!`);
    }
  }

  // Step 2: Create test agent
  console.log("\n2️⃣  Creating test agent...");
  const keypair = generateKeypair();
  const pubkey = pubkeyToBase58(keypair.publicKey);
  
  // Get challenge
  const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge?wallet=${pubkey}`);
  const { nonce } = await challengeRes.json();
  
  // Sign nonce
  const message = `Sign this message to authenticate your Solana agent with Trench\n\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase64 = Buffer.from(signature).toString("base64");
  
  // Verify and register
  const verifyRes = await fetch(`${API_BASE}/auth/agent/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pubkey: pubkey,
      signature: signatureBase64,
      nonce: nonce
    })
  });
  
  const verifyData = await verifyRes.json();
  
  if (!verifyRes.ok || !verifyData.agent) {
    console.error("   ❌ Registration failed:", verifyData);
    throw new Error(`Agent registration failed: ${verifyData.error || "Unknown error"}`);
  }
  
  const { accessToken, agent } = verifyData;
  console.log(`   ✅ Agent created: ${agent.id}`);
  console.log(`   ✅ Wallet: ${pubkey}`);

  // Step 3: Wait for task creation (async process)
  console.log("\n3️⃣  Waiting for onboarding tasks to be created...");
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second wait

  // Step 4: Fetch agent's task completions
  console.log("\n4️⃣  Fetching agent task completions...");
  const completionsRes = await fetch(
    `${API_BASE}/arena/tasks/agent/${agent.id}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  const completionsData = await completionsRes.json();
  const completions = Array.isArray(completionsData) ? completionsData : completionsData.completions || [];
  console.log(`   ✅ Found ${completions.length} task completions`);
  
  // Debug: Check if task data is included
  if (completions.length > 0 && !completions[0].task) {
    console.log(`   ⚠️  Task data not included in completions, fetching tasks individually...`);
  }

  // Step 5: Verify each onboarding task completion
  console.log("\n5️⃣  Verifying onboarding task completions:");
  
  // If task data not included, fetch tasks individually
  const completionsWithTasks = await Promise.all(
    completions.map(async (completion: any) => {
      if (completion.task) {
        return completion;
      }
      // Fetch task data
      const taskRes = await fetch(`${API_BASE}/arena/tasks/${completion.taskId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const taskData = await taskRes.json();
      return {
        ...completion,
        task: taskData.task
      };
    })
  );
  
  // Group completions by task type
  const completionsByType: Record<string, any> = {};
  for (const completion of completionsWithTasks) {
    if (completion.task) {
      completionsByType[completion.task.taskType] = {
        completion,
        task: completion.task
      };
    }
  }

  for (const expected of expectedSkills) {
    const data = completionsByType[expected];
    const skill = onboardingSkills.find((s: any) => s.name === expected);
    
    if (data && skill) {
      const xpMatch = data.task.xpReward === skill.xpReward;
      console.log(`   ${xpMatch ? "✅" : "⚠️"} ${expected}`);
      console.log(`      Task ID: ${data.task.id}`);
      console.log(`      Completion Status: ${data.completion.status}`);
      console.log(`      XP Reward: ${data.task.xpReward} (${xpMatch ? "matches skill" : `expected ${skill.xpReward}`})`);
    } else if (!data) {
      console.log(`   ❌ ${expected} - TASK NOT CREATED!`);
    } else {
      console.log(`   ❌ ${expected} - SKILL NOT FOUND!`);
    }
  }

  // Step 6: Summary
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 TEST SUMMARY:\n");
  
  const allTasksCreated = expectedSkills.every(name => completionsByType[name]);
  const allXPMatch = expectedSkills.every(name => {
    const data = completionsByType[name];
    const skill = onboardingSkills.find((s: any) => s.name === name);
    return data && skill && data.task.xpReward === skill.xpReward;
  });
  
  console.log(`   Skills Loaded:        ${onboardingSkills.length}/5 ✅`);
  console.log(`   Tasks Auto-Created:   ${completions.length}/5 ${allTasksCreated ? "✅" : "❌"}`);
  console.log(`   XP Rewards Correct:   ${allXPMatch ? "✅" : "❌"}`);
  console.log(`   Test Agent:           ${agent.id}`);
  console.log(`   Test Wallet:          ${pubkey}`);
  
  console.log("\n" + "=".repeat(80));
  
  if (allTasksCreated && allXPMatch) {
    console.log("\n🎉 ALL TESTS PASSED! Onboarding skills system is operational.\n");
    return true;
  } else {
    console.log("\n⚠️  SOME TESTS FAILED. Review output above for details.\n");
    return false;
  }
}

// Run test
testOnboardingSkills()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error("\n❌ TEST ERROR:", err.message);
    console.error(err);
    process.exit(1);
  });
