#!/usr/bin/env bun

import { db } from '../src/lib/db';

const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('Usage: bun run scripts/query-agent-data.ts <walletAddress>');
  process.exit(1);
}

async function main() {
  console.log(`\n🔍 Querying data for wallet: ${walletAddress}\n`);

  // 1. Find TradingAgent
  const agent = await db.tradingAgent.findUnique({
    where: { userId: walletAddress },
  });

  if (!agent) {
    console.log('❌ No TradingAgent found for this wallet');
    return;
  }

  console.log('✅ TradingAgent found:');
  console.log(`   Agent ID: ${agent.id}`);
  console.log(`   Name: ${agent.displayName || agent.name}`);
  console.log(`   Total Trades (counter): ${agent.totalTrades}`);
  console.log(`   Win Rate: ${agent.winRate}%`);
  console.log(`   Total PnL: ${agent.totalPnl}\n`);

  // 2. Count AgentTrade records
  const agentTradeCount = await db.agentTrade.count({
    where: { agentId: agent.id },
  });

  console.log(`📊 AgentTrade records: ${agentTradeCount}`);

  if (agentTradeCount > 0) {
    const recentTrades = await db.agentTrade.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('   Recent trades:');
    for (const t of recentTrades) {
      console.log(`   - ${t.action} ${t.tokenSymbol} (${t.signature.slice(0, 8)}...)`);
    }
  }

  // 3. Count PaperTrade records
  const paperTradeCount = await db.paperTrade.count({
    where: { agentId: agent.id },
  });

  console.log(`\n📊 PaperTrade records: ${paperTradeCount}`);

  if (paperTradeCount > 0) {
    const recentPaper = await db.paperTrade.findMany({
      where: { agentId: agent.id },
      orderBy: { openedAt: 'desc' },
      take: 5,
    });
    console.log('   Recent paper trades:');
    for (const t of recentPaper) {
      console.log(`   - ${t.action} ${t.tokenSymbol || t.tokenMint.slice(0, 8)}`);
    }
  }

  // 4. Check leaderboard calculation
  console.log(`\n🏆 Leaderboard calculation:`);
  const tradeCount = agentTradeCount || paperTradeCount || agent.totalTrades;
  console.log(`   Final trade_count: ${tradeCount}`);
  console.log(`   (AgentTrade: ${agentTradeCount}, PaperTrade: ${paperTradeCount}, agent.totalTrades: ${agent.totalTrades})`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
