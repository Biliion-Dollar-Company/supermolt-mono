#!/usr/bin/env bun
/**
 * Backend Team Deliverables Test Suite
 * Tests all new endpoints built by the backend team
 */

const BASE = process.env.API_URL || 'https://sr-mobile-production.up.railway.app';

console.log('🚀 Backend Team Deliverables Test');
console.log('═══════════════════════════════════════════════════════\n');
console.log(`Testing: ${BASE}\n`);

let passed = 0;
let failed = 0;

async function test(name: string, endpoint: string, method = 'GET', body?: any, expectAuth = false) {
  const url = `${BASE}${endpoint}`;
  console.log(`🧪 ${name}`);
  console.log(`   ${method} ${endpoint}`);
  
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await res.json();
    
    if (expectAuth && res.status === 401) {
      console.log(`   ✅ ${res.status} - Auth required (expected)`);
      passed++;
      return;
    }
    
    if (res.ok) {
      console.log(`   ✅ ${res.status} - Success`);
      if (data.tasks) console.log(`      ${data.tasks.length} tasks`);
      if (data.skills) console.log(`      ${data.skills.length} skills`);
      if (data.rankings) console.log(`      ${data.rankings.length} rankings`);
      if (data.nonce) console.log(`      Nonce: ${data.nonce.slice(0, 20)}...`);
      passed++;
    } else {
      console.log(`   ❌ ${res.status} - ${data.error?.message || 'Failed'}`);
      failed++;
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    failed++;
  }
  
  console.log('');
}

// Run tests
console.log('━━━ SKILLS PACK ━━━\n');
await test('Skills Pack', '/skills/pack');
await test('Skills List', '/skills');

console.log('━━━ SIWS AUTH ━━━\n');
await test('SIWS Challenge', '/auth/agent/challenge', 'POST', {
  pubkey: 'TestPubkey123456789012345678901234567890',
});

console.log('━━━ XP SYSTEM (NEW) ━━━\n');
await test('XP Leaderboard', '/arena/leaderboard/xp');
await test('Arena Profile', '/arena/me', 'GET', undefined, true);

console.log('━━━ TASKS SYSTEM ━━━\n');
await test('All Tasks', '/arena/tasks');
await test('Available Tasks', '/arena/tasks/available');

console.log('━━━ EXISTING ENDPOINTS ━━━\n');
await test('Health Check', '/health');
await test('Sortino Leaderboard', '/api/leaderboard');

// Summary
console.log('═══════════════════════════════════════════════════════');
console.log('📊 RESULTS');
console.log('═══════════════════════════════════════════════════════\n');
console.log(`Total:    ${passed + failed}`);
console.log(`Passed:   ${passed} ✅`);
console.log(`Failed:   ${failed} ${failed > 0 ? '❌' : ''}`);
console.log(`Success:  ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failed > 0) {
  console.log('⚠️  Some endpoints failed. Railway might still be deploying.');
  console.log('   Wait a few minutes and run again.\n');
} else {
  console.log('🎉 All endpoints working! Backend team deliverables verified.\n');
}
