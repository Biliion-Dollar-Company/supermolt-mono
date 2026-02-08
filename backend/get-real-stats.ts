#!/usr/bin/env bun
/**
 * Get real stats from database
 */

import { db } from './src/lib/db';

async function getRealStats() {
  console.log('📊 SuperMolt Real Stats\n');
  console.log('═'.repeat(70));
  
  try {
    // 1. Agents
    const agentCount = await db.tradingAgent.count();
    const agents = await db.tradingAgent.findMany({
      select: {
        id: true,
        name: true,
        xp: true,
        level: true,
        totalTrades: true,
        winRate: true,
        totalPnl: true,
        status: true,
        createdAt: true,
      },
      orderBy: { xp: 'desc' },
      take: 10,
    });
    
    console.log('\n👥 AGENTS:');
    console.log('   Total registered:', agentCount);
    if (agents.length > 0) {
      console.log('\n   Top 10:');
      agents.forEach((a, i) => {
        console.log(`   ${i+1}. ${a.name} - ${a.xp} XP, Level ${a.level}, ${a.totalTrades} trades`);
      });
    } else {
      console.log('   (No agents registered yet)');
    }

    // 2. Tasks completed
    const tasksTotal = await db.agentTask.count();
    const tasksOpen = await db.agentTask.count({ where: { status: 'OPEN' } });
    const tasksCompleted = await db.agentTask.count({ where: { status: 'COMPLETED' } });
    
    const completionsTotal = await db.agentTaskCompletion.count();
    const completionsPending = await db.agentTaskCompletion.count({ where: { status: 'PENDING' } });
    const completionsValidated = await db.agentTaskCompletion.count({ where: { status: 'VALIDATED' } });
    
    console.log('\n📋 TASKS:');
    console.log('   Total tasks:', tasksTotal);
    console.log('   Open:', tasksOpen);
    console.log('   Completed:', tasksCompleted);
    console.log('\n   Task completions:');
    console.log('   Total:', completionsTotal);
    console.log('   Pending:', completionsPending);
    console.log('   Validated:', completionsValidated);

    // 3. Trades
    const tradesCount = await db.paperTrade.count();
    const tradesOpen = await db.paperTrade.count({ where: { status: 'OPEN' } });
    const tradesClosed = await db.paperTrade.count({ where: { status: 'CLOSED' } });
    
    console.log('\n💰 TRADES (Paper Trading):');
    console.log('   Total trades:', tradesCount);
    console.log('   Open positions:', tradesOpen);
    console.log('   Closed positions:', tradesClosed);
    
    if (tradesCount > 0) {
      const recentTrades = await db.paperTrade.findMany({
        select: {
          tokenSymbol: true,
          action: true,
          amount: true,
          entryPrice: true,
          pnl: true,
          status: true,
          openedAt: true,
          agent: { select: { name: true } },
        },
        orderBy: { openedAt: 'desc' },
        take: 5,
      });
      
      console.log('\n   Recent 5 trades:');
      recentTrades.forEach((t, i) => {
        console.log(`   ${i+1}. ${t.agent.name}: ${t.action} ${t.tokenSymbol} - ${t.status} (${t.openedAt.toLocaleString()})`);
      });
    }

    // 4. Conversations/Messages
    const conversationsCount = await db.agentConversation.count();
    const messagesCount = await db.agentMessage.count();
    
    console.log('\n💬 CONVERSATIONS:');
    console.log('   Total conversations:', conversationsCount);
    console.log('   Total messages:', messagesCount);

    // 5. Scanner system
    const scannersCount = await db.scanner.count();
    const scannerCallsCount = await db.scannerCall.count();
    
    console.log('\n🔍 SCANNERS:');
    console.log('   Total scanners:', scannersCount);
    console.log('   Total calls:', scannerCallsCount);

    // 6. Reward pool / Treasury
    const treasuryPool = await db.treasuryPool.findFirst();
    const currentEpoch = await db.scannerEpoch.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startAt: 'desc' },
    });
    
    const allocations = await db.treasuryAllocation.count();
    const completedAllocations = await db.treasuryAllocation.count({ where: { status: 'completed' } });
    
    console.log('\n💎 REWARD POOL / TREASURY:');
    if (treasuryPool) {
      console.log('   Total balance:', treasuryPool.totalBalance.toString(), 'USDC');
      console.log('   Allocated:', treasuryPool.allocated.toString(), 'USDC');
      console.log('   Distributed:', treasuryPool.distributed.toString(), 'USDC');
      console.log('   Profits earned:', treasuryPool.profitsEarned.toString(), 'USDC');
    } else {
      console.log('   (No treasury pool configured)');
    }
    
    if (currentEpoch) {
      console.log('\n   Current epoch:', currentEpoch.name);
      console.log('   USDC pool:', currentEpoch.usdcPool.toString(), 'USDC');
      console.log('   Status:', currentEpoch.status);
      console.log('   Start:', currentEpoch.startAt.toLocaleString());
      console.log('   End:', currentEpoch.endAt.toLocaleString());
    } else {
      console.log('\n   (No active epoch)');
    }
    
    console.log('\n   Total allocations:', allocations);
    console.log('   Completed:', completedAllocations);

    // 7. Feed activities
    const feedActivities = await db.feedActivity.count();
    
    console.log('\n📊 FEED ACTIVITIES:');
    console.log('   Total activities:', feedActivities);

    console.log('\n' + '═'.repeat(70));
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.$disconnect();
  }
}

getRealStats();
