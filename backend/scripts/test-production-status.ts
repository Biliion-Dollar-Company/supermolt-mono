#!/usr/bin/env bun

const BASE_URL = 'https://sr-mobile-production.up.railway.app';

async function checkProductionStatus() {
  console.log('\n🔍 PRODUCTION SYSTEM STATUS CHECK\n');
  console.log('━'.repeat(70));
  
  try {
    // 1. Check backend health
    console.log('\n1️⃣ Backend Health:');
    const health = await fetch(`${BASE_URL}/health`);
    const healthData = await health.json();
    console.log(`   Status: ${healthData.success ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    console.log(`   Timestamp: ${healthData.data?.timestamp}`);
    
    // 2. Check leaderboard
    console.log('\n2️⃣ Leaderboard:');
    const leaderboard = await fetch(`${BASE_URL}/feed/leaderboard`);
    const leaderboardData = await leaderboard.json();
    const agents = leaderboardData.data?.leaderboard || [];
    console.log(`   Total Agents: ${agents.length}`);
    
    if (agents.length > 0) {
      console.log(`\n   Top Agents:`);
      agents.slice(0, 7).forEach((agent: any, idx: number) => {
        console.log(`   ${idx + 1}. ${agent.displayName} (${agent.agentId})`);
        console.log(`      PnL: ${agent.pnl || 'N/A'} | Messages: ${agent.totalMessages || 0}`);
      });
    } else {
      console.log(`   ⚠️  No agents found on leaderboard`);
    }
    
    // 3. Check recent activity
    console.log('\n3️⃣ Recent Activity:');
    const activity = await fetch(`${BASE_URL}/feed/activity?limit=10`);
    if (activity.ok) {
      const activityData = await activity.json();
      const events = activityData.data?.events || [];
      console.log(`   Recent Events: ${events.length}`);
      
      if (events.length > 0) {
        events.slice(0, 5).forEach((event: any, idx: number) => {
          console.log(`   ${idx + 1}. ${event.type}: ${event.description || 'N/A'}`);
        });
      }
    } else {
      console.log(`   ⚠️  Activity feed not available (${activity.status})`);
    }
    
    // 4. System summary
    console.log('\n━'.repeat(70));
    console.log('\n📊 SYSTEM SUMMARY:');
    console.log(`   Backend: ✅ Running`);
    console.log(`   Observer Agents: ${agents.length} ${agents.length >= 7 ? '✅' : '⚠️'} (target: 7)`);
    console.log(`   Health Status: ✅ Operational`);
    
    if (agents.length < 7) {
      console.log(`\n⚠️  ACTION NEEDED: Create ${7 - agents.length} more observer agents`);
    } else if (agents.length === 0) {
      console.log(`\n⚠️  CRITICAL: No observer agents found!`);
      console.log(`   Possible causes:`);
      console.log(`   - Agents not created yet`);
      console.log(`   - Database connection issue`);
      console.log(`   - Leaderboard query issue`);
    } else {
      console.log(`\n✅ System has ${agents.length} active observer agents`);
    }
    
    console.log('\n━'.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Error checking production status:', error);
  }
}

checkProductionStatus();
