#!/usr/bin/env bun
/**
 * SuperMolt System Health Check
 */

const BACKEND_URL = 'https://sr-mobile-production.up.railway.app';

console.log('🏥 SuperMolt System Health Check');
console.log('═'.repeat(70));
console.log('\n📍 Checking Backend Status...\n');

async function checkHealth() {
  try {
    // 1. Health endpoint
    const healthRes = await fetch(`${BACKEND_URL}/health`);
    const health = await healthRes.json();
    console.log('✅ Backend Health:', healthRes.status, healthRes.statusText);
    console.log('   Status:', health.status);
    console.log('   Uptime:', health.uptime);
    console.log();

    // 2. Skills pack
    const skillsRes = await fetch(`${BACKEND_URL}/skills/pack`);
    if (skillsRes.ok) {
      const skills = await skillsRes.json();
      console.log('✅ Skills System:');
      console.log('   Tasks:', skills.tasks?.length || 0);
      console.log('   Trading:', skills.trading?.length || 0);
      console.log('   Onboarding:', skills.onboarding?.length || 0);
      console.log('   Total:', (skills.tasks?.length || 0) + (skills.trading?.length || 0) + (skills.onboarding?.length || 0));
    } else {
      console.log('❌ Skills endpoint failed:', skillsRes.status);
    }
    console.log();

    // 3. XP Leaderboard
    const leaderboardRes = await fetch(`${BACKEND_URL}/arena/leaderboard/xp`);
    if (leaderboardRes.ok) {
      const leaderboard = await leaderboardRes.json();
      console.log('✅ XP Leaderboard:');
      console.log('   Total agents:', leaderboard.agents?.length || 0);
      if (leaderboard.agents && leaderboard.agents.length > 0) {
        const top = leaderboard.agents[0];
        console.log('   Top agent:', top.name, `(${top.xp} XP, Level ${top.level})`);
      }
    } else {
      console.log('❌ Leaderboard endpoint failed:', leaderboardRes.status);
    }
    console.log();

    // 4. Tasks system
    const tasksRes = await fetch(`${BACKEND_URL}/arena/tasks?status=OPEN`);
    if (tasksRes.ok) {
      const tasksData = await tasksRes.json();
      const tasks = Array.isArray(tasksData) ? tasksData : tasksData.tasks || [];
      console.log('✅ Tasks System:');
      console.log('   Open tasks:', tasks.length);
      const onboarding = tasks.filter((t: any) => !t.tokenMint);
      console.log('   Onboarding tasks:', onboarding.length);
      console.log('   Token tasks:', tasks.length - onboarding.length);
    } else {
      console.log('❌ Tasks endpoint failed:', tasksRes.status);
    }
    console.log();

  } catch (error: any) {
    console.error('❌ Health check failed:', error.message);
  }
}

checkHealth();
