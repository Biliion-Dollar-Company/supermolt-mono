/**
 * Find SuperRouter agent in database
 */

import { db as prisma } from '../src/lib/db';

const SUPERROUTER_WALLET = '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn';

async function main() {
  console.log(`\n🔍 Looking for SuperRouter agent...`);
  console.log(`   Wallet: ${SUPERROUTER_WALLET}\n`);

  const agents = await prisma.tradingAgent.findMany({
    where: { userId: SUPERROUTER_WALLET },
    select: {
      id: true,
      name: true,
      userId: true,
      twitterHandle: true,
      status: true,
      createdAt: true
    }
  });

  if (agents.length === 0) {
    console.log('❌ No agents found with this wallet');
    console.log('\n💡 Agent might need to be created first or uses different userId format');
  } else {
    console.log(`✅ Found ${agents.length} agent(s):\n`);
    agents.forEach((agent, i) => {
      console.log(`${i + 1}. ${agent.name || '(unnamed)'}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Twitter: ${agent.twitterHandle ? '@' + agent.twitterHandle : '(not linked)'}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Created: ${agent.createdAt.toISOString()}`);
      console.log('');
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
