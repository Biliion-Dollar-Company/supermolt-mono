import { db } from '../src/lib/db';

async function listAgents() {
  const agents = await db.tradingAgent.findMany({
    orderBy: { totalTrades: 'desc' },
    take: 20,
    select: {
      id: true,
      name: true,
      displayName: true,
      archetypeId: true,
      totalTrades: true,
      winRate: true,
      totalPnl: true,
      status: true,
      config: true,
    },
  });

  console.log(`\n📊 Top 20 Trading Agents:\n`);
  
  for (const agent of agents) {
    console.log(`${agent.displayName || agent.name} (${agent.archetypeId})`);
    console.log(`  ID: ${agent.id}`);
    console.log(`  Trades: ${agent.totalTrades} | Win Rate: ${parseFloat(agent.winRate.toString()).toFixed(2)}% | P&L: ${parseFloat(agent.totalPnl.toString()).toFixed(2)} SOL`);
    console.log(`  Status: ${agent.status}`);
    console.log(`  Config: ${JSON.stringify(agent.config)}\n`);
  }

  console.log(`\nTotal agents found: ${agents.length}`);
}

listAgents().then(() => process.exit(0));
