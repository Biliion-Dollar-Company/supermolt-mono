#!/usr/bin/env bun
/**
 * Create Polymarket agents - Direct execution
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const agents = [
  { id: 'agent-alpha-politics', userId: 'system', name: 'Agent Alpha (Politics)', archetypeId: 'politics-specialist', status: 'ACTIVE' as const },
  { id: 'agent-beta-crypto', userId: 'system', name: 'Agent Beta (Crypto)', archetypeId: 'crypto-specialist', status: 'ACTIVE' as const },
  { id: 'agent-gamma-sentiment', userId: 'system', name: 'Agent Gamma (Sentiment)', archetypeId: 'sentiment-analyzer', status: 'ACTIVE' as const },
];

async function main() {
  console.log('🚀 Creating agents in Railway database...\n');
  
  for (const agent of agents) {
    try {
      const result = await db.tradingAgent.upsert({
        where: { id: agent.id },
        update: { 
          name: agent.name,
          updatedAt: new Date()
        },
        create: agent
      });
      
      console.log(`✅ ${result.name} (${result.id})`);
    } catch (error: any) {
      console.error(`❌ Failed ${agent.name}:`, error.message);
    }
  }
  
  console.log('\n📊 Verifying agents...');
  const created = await db.tradingAgent.findMany({
    where: { id: { startsWith: 'agent-' } },
    select: { id: true, name: true, status: true, createdAt: true }
  });
  
  console.table(created);
  console.log(`\n✅ ${created.length} agents ready!\n`);
  
  await db.$disconnect();
}

main().catch(console.error);
