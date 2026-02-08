#!/usr/bin/env bun
/**
 * CORRECTED Backend Team Test Suite
 * Fixed: SIWS is GET, not POST
 * Fixed: Use /arena/tasks?status=OPEN instead of /available
 */

const BASE = 'https://sr-mobile-production.up.railway.app';

console.log('🚀 Backend Team Deliverables Test (CORRECTED)');
console.log('═══════════════════════════════════════════════════════\n');

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
      if (data.nonce) console.log(`      Nonce: ${data.nonce.slice(0, 30)}...`);
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

console.log('━━━ SIWS AUTH (CORRECTED: GET, NOT POST) ━━━\n');
await test('SIWS Challenge', '/auth/agent/challenge', 'GET'); // FIXED: GET not POST

console.log('━━━ XP SYSTEM (NEW) ━━━\n');
await test('XP Leaderboard', '/arena/leaderboard/xp');
await test('Arena Profile', '/arena/me', 'GET', undefined, true);

console.log('━━━ TASKS SYSTEM ━━━\n');
await test('All Tasks', '/arena/tasks');
await test('Open Tasks (CORRECTED: query param)', '/arena/tasks?status=OPEN'); // FIXED: Use query param

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

if (failed === 0) {
  console.log('🎉 ALL ENDPOINTS WORKING! Backend team delivered 100%!\n');
} else {
  console.log('⚠️  Some endpoints failed.\n');
}
