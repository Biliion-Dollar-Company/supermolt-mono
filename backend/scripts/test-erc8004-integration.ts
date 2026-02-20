#!/usr/bin/env bun
/**
 * ERC-8004 Integration Test Script
 * Tests the full flow: Register agent → Submit feedback → Prove intent
 */

import { db } from '../src/lib/db';
import * as identity from '../src/services/erc8004-identity.service';
import * as reputation from '../src/services/erc8004-reputation.service';
import * as validation from '../src/services/erc8004-validation.service';
import { testIPFS } from '../src/lib/ipfs';

async function main() {
  console.log('🧪 ERC-8004 Integration Test\n');

  // 0. Test IPFS connectivity
  console.log('📌 Step 0: Testing IPFS...');
  const ipfsOk = await testIPFS();
  if (!ipfsOk) {
    console.error('❌ IPFS test failed. Check PINATA_API_KEY or PINATA_JWT');
    process.exit(1);
  }
  console.log('✅ IPFS working\n');

  // 1. Find a test agent (Henry's agent or first active agent)
  console.log('📌 Step 1: Finding test agent...');
  let agent = await db.tradingAgent.findFirst({
    where: { 
      userId: 'henry', // Henry's user ID or adjust as needed
      onChainAgentId: null, // Not yet registered
    },
  });

  if (!agent) {
    // Fallback: find any unregistered agent
    agent = await db.tradingAgent.findFirst({
      where: { onChainAgentId: null },
    });
  }

  if (!agent) {
    console.error('❌ No unregistered agents found');
    process.exit(1);
  }

  console.log(`✅ Found agent: ${agent.name} (${agent.id})\n`);

  // 2. Register agent on-chain
  console.log('📌 Step 2: Registering agent on-chain...');
  try {
    const registration = await identity.registerAgentOnChain(agent.id);
    console.log('✅ Agent registered!');
    console.log(`   On-chain ID: ${registration.onChainId}`);
    console.log(`   IPFS URI: ${registration.ipfsUri}`);
    console.log(`   TX Hash: ${registration.txHash}\n`);
  } catch (error: any) {
    console.error('❌ Registration failed:', error.message);
    process.exit(1);
  }

  // 3. Find a closed trade for this agent
  console.log('📌 Step 3: Finding closed trade...');
  const trade = await db.paperTrade.findFirst({
    where: {
      agentId: agent.id,
      status: 'CLOSED',
      feedbackTxHash: null,
    },
  });

  if (!trade) {
    console.error('❌ No closed trades found for this agent');
    console.log('   Create some test trades or use a different agent');
    process.exit(0); // Don't fail, just exit
  }

  console.log(`✅ Found trade: ${trade.tokenSymbol} (${trade.id})`);
  console.log(`   PnL: ${trade.pnl} (${trade.pnlPercent}%)\n`);

  // 4. Submit feedback
  console.log('📌 Step 4: Submitting trade feedback...');
  try {
    const feedback = await reputation.submitTradeFeedback(trade.id);
    console.log('✅ Feedback submitted!');
    console.log(`   Feedback Index: ${feedback.feedbackIndex}`);
    console.log(`   Score: ${feedback.score}/100`);
    console.log(`   IPFS URI: ${feedback.feedbackURI}`);
    console.log(`   TX Hash: ${feedback.txHash}\n`);
  } catch (error: any) {
    console.error('❌ Feedback submission failed:', error.message);
    // Continue anyway
  }

  // 5. Prove trade intent
  console.log('📌 Step 5: Proving trade intent...');
  try {
    const validationResult = await validation.proveTradeIntent(trade.id);
    console.log('✅ Validation request created!');
    console.log(`   Request Hash: ${validationResult.requestHash}`);
    console.log(`   Proof URI: ${validationResult.proofURI}`);
    console.log(`   TX Hash: ${validationResult.txHash}\n`);
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    // Continue anyway
  }

  // 6. Get agent reputation summary
  console.log('📌 Step 6: Fetching reputation summary...');
  try {
    const rep = await reputation.getAgentReputation(agent.id);
    if (rep) {
      console.log('✅ Reputation summary:');
      console.log(`   Total Feedback: ${rep.totalFeedback}`);
      console.log(`   Average Score: ${rep.averageScore}`);
      console.log(`   Total Value: ${rep.totalValue}\n`);
    } else {
      console.log('⚠️  No reputation data yet (may take time to sync)\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch reputation:', error.message);
  }

  // 7. Get validation stats
  console.log('📌 Step 7: Fetching validation stats...');
  try {
    const stats = await validation.getAgentValidationStats(agent.id);
    if (stats) {
      console.log('✅ Validation stats:');
      console.log(`   Approved: ${stats.approvedCount}`);
      console.log(`   Rejected: ${stats.rejectedCount}`);
      console.log(`   Pending: ${stats.pendingCount}`);
      console.log(`   Needs Info: ${stats.needsInfoCount}\n`);
    } else {
      console.log('⚠️  No validation stats yet\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch validation stats:', error.message);
  }

  console.log('🎉 Integration test complete!\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
