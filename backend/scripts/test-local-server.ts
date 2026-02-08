#!/usr/bin/env bun
/**
 * Test Local Development Server
 * Tests all new endpoints on localhost:8000
 */

const BASE_URL = 'http://localhost:8000';

async function test(endpoint: string, method = 'GET', body?: any) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n🧪 ${method} ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ ${response.status}`);
      if (data.data || data.skills || data.tasks) {
        const keys = Object.keys(data.data || data).slice(0, 3);
        console.log(`   📦 ${keys.join(', ')}`);
      }
    } else {
      console.log(`   ❌ ${response.status} - ${data.error?.message || JSON.stringify(data).slice(0, 50)}`);
    }
    
    return { ok: response.ok, data };
  } catch (error: any) {
    console.log(`   ❌ Connection failed: ${error.message}`);
    return { ok: false, data: null };
  }
}

async function runTests() {
  console.log('🚀 Local Server Test Suite');
  console.log('═══════════════════════════════════════\n');
  
  // Core endpoints
  await test('/health');
  await test('/skills/pack');
  await test('/skills');
  
  // SIWS auth
  await test('/auth/agent/challenge', 'POST', {
    pubkey: 'TestPubkey123456789012345678901234567890',
  });
  
  // Arena endpoints
  await test('/api/arena/leaderboard/xp');
  await test('/api/arena/me'); // Will fail without auth - expected
  
  // Tasks
  await test('/api/tasks');
  await test('/api/tasks/available');
  
  console.log('\n✅ Local testing complete!\n');
}

runTests();
