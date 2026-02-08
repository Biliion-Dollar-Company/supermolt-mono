/**
 * Verify Dynamic Monitoring Feature is Deployed
 * Checks if the new code is actually running
 */

const API_URL = 'https://sr-mobile-production.up.railway.app';

async function verify() {
  console.log('🔍 Verifying Dynamic Monitoring Feature Deployment\n');
  
  // Check server version
  const res = await fetch(`${API_URL}/`);
  const data = await res.json();
  console.log(`Server version: ${data.version}`);
  console.log(`Server name: ${data.name}\n`);
  
  // Try to authenticate and watch for the feature
  console.log('🧪 Test: Authenticating to trigger addWallet()...\n');
  
  const challengeRes = await fetch(`${API_URL}/auth/agent/challenge`);
  const { nonce } = await challengeRes.json();
  
  console.log(`✓ Nonce received: ${nonce.substring(0, 20)}...\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 MANUAL VERIFICATION NEEDED:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Go to Railway Dashboard and check logs for:');
  console.log('');
  console.log('1. On startup:');
  console.log('   "✅ Helius monitor instance saved globally"');
  console.log('');
  console.log('2. On authentication:');
  console.log('   "➕ Added wallet to monitoring: 3N2dmcXy..."');
  console.log('   OR');
  console.log('   "⚠️ Wallet already tracked: 3N2dmcXy..."');
  console.log('');
  console.log('3. If NOT found:');
  console.log('   → Code not deployed yet (check Railway build status)');
  console.log('   → Server needs manual restart');
  console.log('');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('🔧 QUICK FIX if feature not deployed:');
  console.log('');
  console.log('Add to Railway env vars:');
  console.log('MONITORED_WALLETS=DRhKV...,9U5Pt...,48Bbw...,3N2dmcXyQ4wMcsX18CCcr3dxmDbmbrUwU2D3LCCrhSbA');
  console.log('');
  console.log('Then restart the service.');
  console.log('');
}

verify().catch(console.error);
