#!/usr/bin/env bun
/**
 * Wipe all seeded/fake data from the SuperMolt arena DB.
 * Keeps: TradingAgent records (real agents + wallets), AgentConversation, AgentConversationMessage, Vote, Task
 * Deletes: AgentTrade, AgentStats, AgentPosition, PaperTrade (all fake seeded records)
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:GrHgoylHRBnWygCwOkovCKkmVgprCAXP@caboose.proxy.rlwy.net:16739/railway'
    }
  }
});

async function main() {
  console.log('🧹 Cleaning fake/seeded data from SuperMolt DB...\n');

  // 1. Count before
  const tradesBefore  = await db.agentTrade.count();
  const statsBefore   = await db.agentStats.count();
  const posBefore     = await db.agentPosition.count().catch(() => 0);
  const paperBefore   = await db.paperTrade.count().catch(() => 0);

  console.log('Before:');
  console.log(`  AgentTrade:    ${tradesBefore}`);
  console.log(`  AgentStats:    ${statsBefore}`);
  console.log(`  AgentPosition: ${posBefore}`);
  console.log(`  PaperTrade:    ${paperBefore}`);
  console.log('');

  // 2. Delete in safe order (FK constraints)
  const posDeleted   = await db.agentPosition.deleteMany({}).catch(() => ({ count: 0 }));
  const paperDeleted = await db.paperTrade.deleteMany({}).catch(() => ({ count: 0 }));
  const tradeDeleted = await db.agentTrade.deleteMany({});
  const statsDeleted = await db.agentStats.deleteMany({});

  console.log('Deleted:');
  console.log(`  AgentPosition: ${posDeleted.count}`);
  console.log(`  PaperTrade:    ${paperDeleted.count}`);
  console.log(`  AgentTrade:    ${tradeDeleted.count}`);
  console.log(`  AgentStats:    ${statsDeleted.count}`);
  console.log('');

  // 3. Verify agents still intact
  const agents = await db.tradingAgent.findMany({
    select: { name: true, walletAddress: true, userId: true }
  });
  console.log(`Agents intact: ${agents.length}`);
  for (const a of agents) {
    console.log(`  ${a.name} | wallet: ${(a.walletAddress || a.userId || 'none').slice(0, 16)}...`);
  }

  // 4. Verify conversations/votes/tasks still intact
  const convs  = await db.agentConversation.count();
  const votes  = await db.vote.count().catch(() => 0);
  const tasks  = await db.task.count().catch(() => 0);
  console.log('');
  console.log('Content preserved:');
  console.log(`  Conversations: ${convs}`);
  console.log(`  Votes:         ${votes}`);
  console.log(`  Tasks:         ${tasks}`);

  console.log('\n✅ Done. Leaderboard now shows honest zeros until real trades flow in.');
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => db.$disconnect());
