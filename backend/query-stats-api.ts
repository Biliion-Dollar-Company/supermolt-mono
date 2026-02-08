#!/usr/bin/env bun
/**
 * Query real stats via Railway API
 */

const API_BASE = 'https://sr-mobile-production.up.railway.app';

async function getStats() {
  console.log('📊 SuperMolt Real Stats (via API)\n');
  console.log('═'.repeat(70));
  
  try {
    // 1. XP Leaderboard (agents)
    const leaderboardRes = await fetch(`${API_BASE}/arena/leaderboard/xp`);
    const leaderboard = await leaderboardRes.json();
    const agents = leaderboard.agents || [];
    
    console.log('\n👥 AGENTS:');
    console.log('   Total registered:', agents.length);
    if (agents.length > 0) {
      console.log('\n   Top 10:');
      agents.slice(0, 10).forEach((a: any, i: number) => {
        console.log(`   ${i+1}. ${a.name} - ${a.xp} XP, Level ${a.level}`);
      });
    } else {
      console.log('   (No agents on leaderboard yet)');
    }

    // 2. Tasks
    const tasksRes = await fetch(`${API_BASE}/arena/tasks`);
    const tasksData = await tasksRes.json();
    const tasks = Array.isArray(tasksData) ? tasksData : tasksData.tasks || [];
    
    const openTasks = tasks.filter((t: any) => t.status === 'OPEN');
    const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED');
    const onboardingTasks = tasks.filter((t: any) => !t.tokenMint);
    
    console.log('\n📋 TASKS:');
    console.log('   Total tasks:', tasks.length);
    console.log('   Open:', openTasks.length);
    console.log('   Completed:', completedTasks.length);
    console.log('   Onboarding tasks:', onboardingTasks.length);

    // 3. Try to get trades
    const tradesRes = await fetch(`${API_BASE}/arena/trades?limit=100`);
    let trades = [];
    if (tradesRes.ok) {
      const tradesData = await tradesRes.json();
      trades = Array.isArray(tradesData) ? tradesData : tradesData.trades || [];
      
      console.log('\n💰 TRADES:');
      console.log('   Total trades:', trades.length);
      if (trades.length > 0) {
        const openTrades = trades.filter((t: any) => t.status === 'OPEN');
        const closedTrades = trades.filter((t: any) => t.status === 'CLOSED');
        console.log('   Open positions:', openTrades.length);
        console.log('   Closed positions:', closedTrades.length);
        
        console.log('\n   Recent 5 trades:');
        trades.slice(0, 5).forEach((t: any, i: number) => {
          console.log(`   ${i+1}. ${t.action} ${t.tokenSymbol} - ${t.status}`);
        });
      }
    } else {
      console.log('\n💰 TRADES:');
      console.log('   (Trades endpoint returned', tradesRes.status, ')');
    }

    // 4. Conversations
    const convoRes = await fetch(`${API_BASE}/arena/conversations`);
    let conversations = [];
    let messagesCount = 0;
    if (convoRes.ok) {
      const convoData = await convoRes.json();
      conversations = Array.isArray(convoData) ? convoData : convoData.conversations || [];
      
      // Count messages
      conversations.forEach((c: any) => {
        if (c.messages) messagesCount += c.messages.length;
      });
      
      console.log('\n💬 CONVERSATIONS:');
      console.log('   Total conversations:', conversations.length);
      console.log('   Total messages:', messagesCount);
    } else {
      console.log('\n💬 CONVERSATIONS:');
      console.log('   (Conversations endpoint returned', convoRes.status, ')');
    }

    // 5. Get scanner/epoch info via Railway CLI
    console.log('\n💎 REWARD POOL / TREASURY:');
    console.log('   Checking via Railway...');

    console.log('\n' + '═'.repeat(70));
    console.log('\n💡 Summary:');
    console.log(`   ${agents.length} agents | ${tasks.length} tasks | ${trades.length} trades | ${conversations.length} conversations`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

getStats();
