#!/usr/bin/env bun
/**
 * Test Sortino Calculator
 */

import { PrismaClient } from '@prisma/client';
import { createSortinoService } from './src/services/sortino.service';

const db = new PrismaClient();
const sortinoService = createSortinoService(db);

async function main() {
  console.log('🧪 Testing Sortino Calculator\n');

  // Check FeedActivity records
  const feedCount = await db.feedActivity.count();
  console.log(`📊 FeedActivity records: ${feedCount}`);

  // Get unique agents
  const agents = await db.feedActivity.findMany({
    select: { agentId: true },
    distinct: ['agentId'],
  });
  console.log(`👥 Unique agents: ${agents.length}\n`);

  if (agents.length === 0) {
    console.log('⚠️  No agents found in FeedActivity. Creating test data...\n');
    
    // Create test data for the specified agent
    const testAgentId = 'DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy';
    
    // Simulate some trades with varying PnL
    const testTrades = [
      { pnl: 50, pnlPercent: 5 },
      { pnl: -20, pnlPercent: -2 },
      { pnl: 100, pnlPercent: 10 },
      { pnl: -30, pnlPercent: -3 },
      { pnl: 75, pnlPercent: 7.5 },
      { pnl: 25, pnlPercent: 2.5 },
      { pnl: -15, pnlPercent: -1.5 },
      { pnl: 60, pnlPercent: 6 },
    ];

    for (let i = 0; i < testTrades.length; i++) {
      const trade = testTrades[i];
      await db.feedActivity.create({
        data: {
          agentId: testAgentId,
          action: i % 2 === 0 ? 'BUY' : 'SELL',
          tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          tokenSymbol: 'TEST',
          amount: 1000,
          entryPrice: 1.0,
          exitPrice: 1.0 + (trade.pnlPercent / 100),
          pnl: trade.pnl,
          pnlPercent: trade.pnlPercent,
          dex: 'Jupiter',
          txSignature: `test_tx_${i}_${Date.now()}`,
          timestamp: new Date(Date.now() - (testTrades.length - i) * 3600000), // 1 hour apart
        },
      });
    }
    
    console.log(`✅ Created ${testTrades.length} test trades for ${testAgentId.slice(0, 8)}...\n`);
  }

  // Calculate Sortino for test agent
  const testAgentId = 'DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy';
  console.log(`🔢 Calculating Sortino for ${testAgentId.slice(0, 8)}...`);
  
  const metrics = await sortinoService.calculateAgentSortino(testAgentId);
  
  if (metrics) {
    console.log('\n📈 Results:');
    console.log(`   Sortino Ratio: ${metrics.sortinoRatio.toFixed(4)}`);
    console.log(`   Win Rate: ${(metrics.winRate * 100).toFixed(2)}%`);
    console.log(`   Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`   Total PnL: ${metrics.totalPnl.toFixed(2)}`);
    console.log(`   Total Trades: ${metrics.totalTrades}`);
    console.log(`   Avg Return: ${metrics.averageReturn.toFixed(2)}`);
    console.log(`   Downside Dev: ${metrics.downsideDeviation.toFixed(4)}\n`);
  } else {
    console.log('❌ No metrics calculated\n');
  }

  // Store in AgentStats
  console.log('💾 Saving to AgentStats...');
  await sortinoService.calculateAllAgents();

  // Fetch leaderboard
  console.log('\n🏆 Leaderboard (Top 10):');
  const leaderboard = await sortinoService.getLeaderboard(10);
  
  leaderboard.forEach((agent, index) => {
    console.log(`   ${index + 1}. ${agent.agentId.slice(0, 8)}... - Sortino: ${agent.sortinoRatio.toFixed(2)} | Trades: ${agent.totalTrades} | PnL: ${agent.totalPnl.toFixed(2)}`);
  });

  console.log('\n✅ Test complete!');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
