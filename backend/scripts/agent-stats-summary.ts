import { db } from '../src/lib/db';

async function getStats() {
  // Total agents
  const totalAgents = await db.tradingAgent.count();
  
  // Agents by status
  const byStatus = await db.tradingAgent.groupBy({
    by: ['status'],
    _count: true,
  });
  
  // Agents by chain
  const byChain = await db.tradingAgent.groupBy({
    by: ['chain'],
    _count: true,
  });
  
  // Total trades
  const totalTrades = await db.paperTrade.count();
  
  // Active agents (with trades)
  const activeAgents = await db.tradingAgent.count({
    where: { totalTrades: { gt: 0 } }
  });
  
  // Top 10 by trade count
  const topTraders = await db.tradingAgent.findMany({
    orderBy: { totalTrades: 'desc' },
    take: 10,
    select: {
      name: true,
      displayName: true,
      totalTrades: true,
      winRate: true,
      totalPnl: true,
      status: true,
      twitterHandle: true,
    }
  });
  
  console.log('\n📊 SuperMolt Platform Stats\n');
  console.log(`Total Agents: ${totalAgents}`);
  console.log(`Active Agents (with trades): ${activeAgents}`);
  console.log(`Total Trades: ${totalTrades}`);
  
  console.log('\nBy Status:');
  byStatus.forEach(s => console.log(`  ${s.status}: ${s._count}`));
  
  console.log('\nBy Chain:');
  byChain.forEach(c => console.log(`  ${c.chain}: ${c._count}`));
  
  console.log('\n🏆 Top 10 Traders:\n');
  topTraders.forEach((a, i) => {
    const name = a.displayName || a.name;
    const twitter = a.twitterHandle ? ` (@${a.twitterHandle})` : '';
    console.log(`${i+1}. ${name}${twitter}`);
    console.log(`   Trades: ${a.totalTrades} | Win Rate: ${a.winRate}% | PnL: ${a.totalPnl} SOL | Status: ${a.status}`);
  });
  
  process.exit(0);
}

getStats();
