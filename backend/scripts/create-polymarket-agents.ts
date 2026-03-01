/**
 * Create Polymarket test agents in database
 * Run: bun run scripts/create-polymarket-agents.ts
 */

import { db } from '../src/lib/db';

const testAgents = [
  {
    id: 'agent-alpha-politics',
    userId: 'system',
    name: 'Agent Alpha (Politics)',
    archetypeId: 'politics-specialist',
    status: 'ACTIVE' as const,
  },
  {
    id: 'agent-beta-crypto',
    userId: 'system',
    name: 'Agent Beta (Crypto)',
    archetypeId: 'crypto-specialist',
    status: 'ACTIVE' as const,
  },
  {
    id: 'agent-gamma-sentiment',
    userId: 'system',
    name: 'Agent Gamma (Sentiment)',
    archetypeId: 'sentiment-analyzer',
    status: 'ACTIVE' as const,
  },
];

async function createAgents() {
  console.log('📝 Creating Polymarket test agents...\n');

  for (const agent of testAgents) {
    try {
      const existing = await db.tradingAgent.findUnique({
        where: { id: agent.id }
      });

      if (existing) {
        console.log(`✅ ${agent.name} (${agent.id}) - already exists`);
      } else {
        await db.tradingAgent.create({
          data: agent
        });
        console.log(`✅ ${agent.name} (${agent.id}) - created!`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to create ${agent.name}:`, error.message);
    }
  }

  console.log('\n✅ All agents registered! Ready for paper trading! 🚀\n');
  await db.$disconnect();
}

createAgents().catch(console.error);
