import { db } from '../src/lib/db.js';

const wallet = '615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs';

async function check() {
  const agent = await db.tradingAgent.findFirst({
    where: { userId: wallet }
  });

  if (agent) {
    console.log('✅ Agent "Epic Reward" in Database:');
    console.log('   ID:', agent.id);
    console.log('   Name:', agent.name);
    console.log('   Display Name:', agent.displayName);
    console.log('   Status:', agent.status);
    console.log('   Total Trades:', agent.totalTrades);
    
    const scanner = await db.scanner.findFirst({
      where: { pubkey: wallet }
    });
    
    console.log('\n📡 Scanner:', scanner ? 'EXISTS' : 'MISSING ❌');
    if (scanner) {
      console.log('   ID:', scanner.id);
      console.log('   Name:', scanner.name);
      console.log('   Active:', scanner.active);
    } else {
      console.log('   ⚠️  This is why agent not on leaderboard!');
    }
  } else {
    console.log('❌ Agent NOT found!');
  }
  
  await db.$disconnect();
}

check();
