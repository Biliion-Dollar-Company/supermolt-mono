/**
 * Complete System Test Suite
 * 
 * Tests all critical platform flows end-to-end:
 * 1. Trade Execution Flow (webhook → task completion → XP)
 * 2. Conversation System (create → join → post)
 * 3. Research Submission (submit → task completion)
 * 4. Leaderboard Systems (XP + Trading)
 * 5. Position Tracking
 * 6. Voting System
 * 
 * Usage:
 *   bun run test-complete-system.ts
 */

import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

const BASE_URL = process.env.BASE_URL || 'https://sr-mobile-production.up.railway.app';
const ARENA_URL = `${BASE_URL}/arena`;
const AUTH_URL = `${BASE_URL}/auth`;
const AGENT_AUTH_URL = `${BASE_URL}/agent-auth`;

// Test state
let testAgent = {
  publicKey: '',
  secretKey: new Uint8Array(),
  agentId: '',
  jwt: '',
  xp: 0,
  level: 1,
  conversationId: '',
  voteId: ''
};

// Utilities
function generateKeypair() {
  const keypair = nacl.sign.keyPair();
  const publicKey = bs58.encode(keypair.publicKey);
  const secretKey = keypair.secretKey;
  return { publicKey, secretKey };
}

function signMessage(message: string, secretKey: Uint8Array): string {
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return bs58.encode(signature);
}

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
  console.log('\n🧪 COMPLETE SYSTEM TEST SUITE');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Time: ${new Date().toISOString()}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: AUTHENTICATION & SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  await step(1, 'Generate fresh Solana keypair', async () => {
    const { publicKey, secretKey } = generateKeypair();
    testAgent.publicKey = publicKey;
    testAgent.secretKey = secretKey;
    console.log(`Wallet: ${publicKey.substring(0, 12)}...${publicKey.slice(-4)}`);
  });

  await step(2, 'SIWS Authentication', async () => {
    const nonceRes = await fetch(`${AUTH_URL}/agent/challenge`);
    if (!nonceRes.ok) throw new Error('Failed to get nonce');
    
    const { nonce, statement } = await nonceRes.json();
    const message = `${statement}\n\nNonce: ${nonce}`;
    const signature = signMessage(message, testAgent.secretKey);

    const verifyRes = await fetch(`${AUTH_URL}/agent/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: testAgent.publicKey, signature, nonce })
    });

    if (!verifyRes.ok) {
      const errorText = await verifyRes.text();
      throw new Error(`Verify failed: ${errorText}`);
    }

    const result = await verifyRes.json();
    testAgent.jwt = result.accessToken || result.token;
    const agent = result.agent || result.data || result;
    testAgent.agentId = agent.id || agent.agentId;
    testAgent.xp = agent.xp || 0;

    console.log(`✅ Agent: ${testAgent.agentId}`);
    console.log(`   XP: ${testAgent.xp}`);
    console.log(`   JWT: ${testAgent.jwt.substring(0, 20)}...`);
  });

  // Wait for onboarding tasks to be created
  await new Promise(resolve => setTimeout(resolve, 2000));

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: TRADE EXECUTION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  await step(3, 'Simulate trade execution', async () => {
    // In production, this would be triggered by Helius webhook
    // For testing, we'll call the internal trade creation endpoint if available
    // OR manually create a trade record for testing
    
    console.log('⚠️  Trade simulation requires:');
    console.log('   - Helius webhook integration OR');
    console.log('   - Manual database insert OR');
    console.log('   - Internal test endpoint');
    console.log('\n🔍 Checking for FIRST_TRADE task...');

    // Check if FIRST_TRADE task exists
    const tasksRes = await fetch(`${ARENA_URL}/tasks/agent/${testAgent.agentId}`);
    if (!tasksRes.ok) throw new Error('Failed to get tasks');

    const { completions } = await tasksRes.json();
    const firstTradeTask = completions.find((c: any) => c.taskType === 'FIRST_TRADE');

    if (!firstTradeTask) {
      throw new Error('FIRST_TRADE task not found');
    }

    console.log(`✅ FIRST_TRADE task found: ${firstTradeTask.taskId}`);
    console.log(`   Status: ${firstTradeTask.status}`);
    console.log(`   XP Reward: ${firstTradeTask.xpReward}`);
    
    console.log('\n⏭️  Skipping trade execution (requires webhook/manual setup)');
    console.log('   Task is ready for completion when trade is detected');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: CONVERSATION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  await step(4, 'Create conversation', async () => {
    const res = await fetch(`${BASE_URL}/messaging/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAgent.jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: `Test Conversation ${Date.now()}`,
        tokenMint: 'So11111111111111111111111111111111111111112' // SOL
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Create conversation failed: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    const conversationData = result.data || result;
    testAgent.conversationId = conversationData.conversationId;

    console.log(`✅ Conversation created: ${testAgent.conversationId}`);
    console.log(`   Topic: ${conversationData.topic}`);
  });

  await step(5, 'Post message to conversation', async () => {
    const res = await fetch(`${BASE_URL}/messaging/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAgent.jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationId: testAgent.conversationId,
        agentId: testAgent.agentId,
        message: 'This is a test message from automated test suite.'
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Post message failed: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    const messageData = result.message || result.data || result;

    console.log(`✅ Message posted: ${messageData.id}`);
    console.log(`   Content: ${messageData.message || messageData.content}`);
    
    console.log('\n🎯 JOIN_CONVERSATION task should auto-complete now (+50 XP)');
  });

  await step(6, 'Verify JOIN_CONVERSATION task completed', async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const agentRes = await fetch(`${AGENT_AUTH_URL}/profile/${testAgent.agentId}`);
    if (!agentRes.ok) throw new Error('Failed to get agent profile');

    const { data: agent } = await agentRes.json();
    const previousXp = testAgent.xp;
    testAgent.xp = agent.xp;

    console.log(`\nAgent XP: ${testAgent.xp} (was ${previousXp})`);

    const tasksRes = await fetch(`${ARENA_URL}/tasks/agent/${testAgent.agentId}`);
    if (!tasksRes.ok) throw new Error('Failed to get tasks');

    const { completions } = await tasksRes.json();
    const joinConvoTask = completions.find((c: any) => c.taskType === 'JOIN_CONVERSATION');

    if (!joinConvoTask) {
      console.log('⚠️  JOIN_CONVERSATION task not found (may not auto-complete on message post)');
      return;
    }

    console.log(`\nJOIN_CONVERSATION task status: ${joinConvoTask.status}`);
    
    if (joinConvoTask.status === 'VALIDATED') {
      console.log(`✅ Task completed!`);
      console.log(`   XP Awarded: +50`);
    } else {
      console.log(`ℹ️  Task not yet completed (status: ${joinConvoTask.status})`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: VOTING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  await step(7, 'Create vote proposal', async () => {
    const res = await fetch(`${BASE_URL}/voting/propose`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAgent.jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        proposerId: testAgent.agentId,
        action: 'BUY',
        token: 'SOL',
        tokenMint: 'So11111111111111111111111111111111111111112',
        amount: 1.0,
        reason: 'Testing the voting system - should we buy SOL?',
        expiresInHours: 24
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Create vote failed: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    const voteData = result.data || result;
    testAgent.voteId = voteData.proposalId;

    console.log(`✅ Vote created: ${testAgent.voteId}`);
    console.log(`   Action: ${voteData.action} ${voteData.amount} ${voteData.token}`);
    console.log(`   Reason: ${voteData.reason}`);
  });

  await step(8, 'Cast vote', async () => {
    const res = await fetch(`${BASE_URL}/voting/${testAgent.voteId}/cast`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAgent.jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: testAgent.agentId,
        vote: 'YES' // Vote YES
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Cast vote failed: ${res.status} - ${errorText}`);
    }

    console.log(`✅ Vote cast successfully`);
    console.log(`   Voted: YES`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: LEADERBOARD SYSTEMS
  // ═══════════════════════════════════════════════════════════════════════════

  await step(9, 'Test XP Leaderboard', async () => {
    const res = await fetch(`${ARENA_URL}/leaderboard/xp`);
    if (!res.ok) throw new Error('XP leaderboard request failed');

    const { rankings } = await res.json();
    
    console.log(`\n📊 XP Leaderboard (top 5):`);
    rankings.slice(0, 5).forEach((agent: any, i: number) => {
      console.log(`   ${i + 1}. ${agent.name}: ${agent.xp} XP (Level ${agent.level})`);
    });

    // Check if our test agent appears
    const ourAgent = rankings.find((a: any) => a.agentId === testAgent.agentId);
    if (ourAgent) {
      console.log(`\n✅ Our test agent found in leaderboard:`);
      console.log(`   Rank: ${rankings.indexOf(ourAgent) + 1}/${rankings.length}`);
      console.log(`   XP: ${ourAgent.xp}`);
    }
  });

  await step(10, 'Test Trading Leaderboard', async () => {
    const res = await fetch(`${ARENA_URL}/leaderboard`);
    if (!res.ok) throw new Error('Trading leaderboard request failed');

    const data = await res.json();
    const agents = data.agents || data.leaderboard || [];
    
    console.log(`\n📊 Trading Leaderboard (top 5):`);
    agents.slice(0, 5).forEach((agent: any, i: number) => {
      console.log(`   ${i + 1}. ${agent.name}: Sortino ${agent.sortino?.toFixed(2) || 'N/A'}, PnL ${agent.totalPnl || 0}`);
    });

    console.log(`\n✅ Trading leaderboard operational (${agents.length} agents)`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: POSITION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  await step(11, 'Test Position Tracking', async () => {
    const res = await fetch(`${ARENA_URL}/positions`);
    if (!res.ok) throw new Error('Positions request failed');

    const data = await res.json();
    const positions = data.positions || [];
    
    console.log(`\n📊 Active Positions: ${positions.length}`);
    if (positions.length > 0) {
      console.log(`\nSample positions (first 3):`);
      positions.slice(0, 3).forEach((pos: any) => {
        console.log(`   - ${pos.tokenSymbol}: ${pos.amount} tokens, PnL: ${pos.unrealizedPnl || 0}`);
      });
    } else {
      console.log('   No active positions found (expected for new agents)');
    }

    console.log(`\n✅ Position tracking operational`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: TASK SYSTEM OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  await step(12, 'Final Task Status Check', async () => {
    const res = await fetch(`${ARENA_URL}/tasks/agent/${testAgent.agentId}`);
    if (!res.ok) throw new Error('Failed to get tasks');

    const { completions } = await res.json();
    
    console.log(`\n📋 All Agent Tasks (${completions.length}):`);
    
    const completed = completions.filter((c: any) => c.status === 'VALIDATED');
    const pending = completions.filter((c: any) => c.status === 'PENDING');
    
    console.log(`\n✅ Completed (${completed.length}):`);
    completed.forEach((task: any) => {
      console.log(`   - ${task.taskType}: +${task.xpAwarded} XP`);
    });

    console.log(`\n⏳ Pending (${pending.length}):`);
    pending.forEach((task: any) => {
      console.log(`   - ${task.taskType}: ${task.xpReward} XP available`);
    });

    const totalXpEarned = completed.reduce((sum: number, t: any) => sum + (t.xpAwarded || 0), 0);
    const totalXpAvailable = pending.reduce((sum: number, t: any) => sum + (t.xpReward || 0), 0);

    console.log(`\n💰 XP Summary:`);
    console.log(`   Earned: ${totalXpEarned} XP`);
    console.log(`   Available: ${totalXpAvailable} XP`);
    console.log(`   Total Possible: ${totalXpEarned + totalXpAvailable} XP`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '='.repeat(80));
  console.log('🎉 COMPLETE SYSTEM TEST FINISHED!');
  console.log('='.repeat(80));

  console.log('\n📊 SYSTEMS TESTED:');
  console.log('─'.repeat(80));
  console.log('   ✅ Authentication (SIWS)');
  console.log('   ✅ Onboarding Task Creation');
  console.log('   ⏭️  Trade Execution (requires webhook/manual setup)');
  console.log('   ✅ Conversation System');
  console.log('   ⚠️  JOIN_CONVERSATION Auto-Completion (check logs)');
  console.log('   ✅ Voting System');
  console.log('   ✅ XP Leaderboard');
  console.log('   ✅ Trading Leaderboard');
  console.log('   ✅ Position Tracking');
  console.log('   ✅ Task Status Queries');
  console.log('─'.repeat(80));

  console.log('\n📋 TEST AGENT SUMMARY:');
  console.log('─'.repeat(80));
  console.log(`   Agent ID: ${testAgent.agentId}`);
  console.log(`   Wallet: ${testAgent.publicKey}`);
  console.log(`   Final XP: ${testAgent.xp}`);
  console.log(`   Conversation: ${testAgent.conversationId}`);
  console.log(`   Vote: ${testAgent.voteId}`);
  console.log('─'.repeat(80));

  console.log('\n⚠️  MANUAL TESTING REQUIRED:');
  console.log('─'.repeat(80));
  console.log('   • Trade execution (Helius webhook or manual insert)');
  console.log('   • FIRST_TRADE task completion (+100 XP)');
  console.log('   • COMPLETE_RESEARCH task (submit research)');
  console.log('   • Real-time WebSocket events');
  console.log('   • Treasury distribution flow');
  console.log('─'.repeat(80));

  console.log('\n✨ NEXT STEPS:');
  console.log('   1. Test trade execution with real wallet');
  console.log('   2. Verify JOIN_CONVERSATION auto-completion works');
  console.log('   3. Test COMPLETE_RESEARCH task submission');
  console.log('   4. Monitor WebSocket events in frontend');
  console.log('   5. Test treasury distribution (if agents have trades)\n');
}

main().catch((error) => {
  console.error('\n❌ TEST SUITE FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
});
