#!/usr/bin/env bun
/**
 * Comprehensive Backend Test Suite
 */

const BASE_URL = process.env.API_URL || 'https://sr-mobile-production.up.railway.app';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

async function test(endpoint: string, method = 'GET', body?: any, headers?: any) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n🧪 Testing ${method} ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    const success = response.ok;
    
    results.push({ endpoint, method, status: response.status, success, data });
    
    if (success) {
      console.log(`   ✅ ${response.status} - ${data.success ? 'Success' : 'OK'}`);
      if (data.data && typeof data.data === 'object') {
        const keys = Object.keys(data.data);
        console.log(`   📦 Data keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
      }
    } else {
      console.log(`   ❌ ${response.status} - ${data.error?.message || 'Failed'}`);
    }
    
    return { response, data };
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    results.push({ endpoint, method, status: 0, success: false, error: error.message });
    return { response: null, data: null };
  }
}

async function runTests() {
  console.log('🚀 SuperMolt Backend Test Suite');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Testing: ${BASE_URL}\n`);

  // 1. Health check
  await test('/health');

  // 2. Auth endpoints
  const { data: challengeData } = await test('/api/auth/agent/challenge', 'POST', {
    pubkey: 'TestPubkey123456789012345678901234567890',
  });

  // 3. Leaderboards
  await test('/api/leaderboard');
  await test('/api/arena/leaderboard/xp');

  // 4. Skills pack
  await test('/api/skills/pack');

  // 5. Arena profile (will fail without auth - expected)
  await test('/api/arena/me');

  // 6. Tasks
  await test('/api/tasks');
  await test('/api/tasks/available');

  // 7. Scanner calls
  await test('/api/scanner/calls?limit=5');

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`Total Tests:    ${total}`);
  console.log(`Passed:         ${passed} ✅`);
  console.log(`Failed:         ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Success Rate:   ${((passed / total) * 100).toFixed(1)}%\n`);

  // Expected failures (auth-protected endpoints)
  const expectedFailures = results.filter(r => 
    !r.success && (r.endpoint.includes('/arena/me') || r.status === 401)
  );

  if (expectedFailures.length > 0) {
    console.log('Expected failures (auth required):');
    expectedFailures.forEach(r => {
      console.log(`   • ${r.method} ${r.endpoint} - ${r.status}`);
    });
    console.log('');
  }

  // Unexpected failures
  const unexpectedFailures = results.filter(r => 
    !r.success && !expectedFailures.includes(r)
  );

  if (unexpectedFailures.length > 0) {
    console.log('❌ Unexpected failures:');
    unexpectedFailures.forEach(r => {
      console.log(`   • ${r.method} ${r.endpoint} - ${r.status} - ${r.error || 'Unknown'}`);
    });
    console.log('');
  }

  // Key endpoints status
  console.log('🎯 Key Features:');
  const healthCheck = results.find(r => r.endpoint === '/health');
  console.log(`   Health:          ${healthCheck?.success ? '✅' : '❌'}`);
  
  const xpLeaderboard = results.find(r => r.endpoint === '/api/arena/leaderboard/xp');
  console.log(`   XP Leaderboard:  ${xpLeaderboard?.success ? '✅' : '❌'}`);
  
  const skillsPack = results.find(r => r.endpoint === '/api/skills/pack');
  console.log(`   Skills Pack:     ${skillsPack?.success ? '✅' : '❌'}`);
  
  const challenge = results.find(r => r.endpoint === '/api/auth/agent/challenge');
  console.log(`   SIWS Challenge:  ${challenge?.success ? '✅' : '❌'}`);

  console.log('\n✨ Testing complete!\n');
}

runTests();
