import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('📊 Database Status Check\n');

  try {
    const agents = await prisma.tradingAgent.count();
    const trades = await prisma.paperTrade.count();
    const positions = await prisma.agentPosition.count();
    const stats = await prisma.agentStats.count();
    const feedActivity = await prisma.feedActivity.count();

    console.log('📈 Record Counts:');
    console.log(`  Agents:        ${agents}`);
    console.log(`  Trades:        ${trades}`);
    console.log(`  Positions:     ${positions}`);
    console.log(`  Agent Stats:   ${stats}`);
    console.log(`  Feed Activity: ${feedActivity}`);
    console.log('');

    if (agents > 0) {
      console.log('🤖 Recent Agents:');
      const recentAgents = await prisma.tradingAgent.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          displayName: true,
          createdAt: true,
        },
      });
      recentAgents.forEach((agent, idx) => {
        console.log(`  ${idx + 1}. ${agent.displayName || 'Unnamed'} (${agent.userId?.slice(0, 8)}...)`);
        console.log(`     Created: ${agent.createdAt.toISOString()}`);
      });
      console.log('');
    }

    if (trades > 0) {
      console.log('💸 Recent Trades:');
      const recentTrades = await prisma.paperTrade.findMany({
        take: 5,
        orderBy: { executedAt: 'desc' },
        select: {
          id: true,
          action: true,
          tokenSymbol: true,
          quantityUsd: true,
          executedAt: true,
        },
      });
      recentTrades.forEach((trade, idx) => {
        console.log(`  ${idx + 1}. ${trade.action} ${trade.tokenSymbol} - $${trade.quantityUsd}`);
        console.log(`     Executed: ${trade.executedAt?.toISOString() || 'N/A'}`);
      });
      console.log('');
    }

    if (positions > 0) {
      console.log('📍 Active Positions:');
      const activePositions = await prisma.agentPosition.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          tokenSymbol: true,
          quantity: true,
          currentValue: true,
          pnl: true,
        },
      });
      activePositions.forEach((pos, idx) => {
        const pnlStr = pos.pnl >= 0 ? `+$${pos.pnl.toFixed(2)}` : `-$${Math.abs(pos.pnl).toFixed(2)}`;
        console.log(`  ${idx + 1}. ${pos.tokenSymbol}: ${pos.quantity} units ($${pos.currentValue.toFixed(2)}) - P&L: ${pnlStr}`);
      });
      console.log('');
    }

    console.log('✅ Database check complete!\n');
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
