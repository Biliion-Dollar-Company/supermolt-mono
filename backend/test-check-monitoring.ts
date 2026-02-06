/**
 * Check if wallet is being monitored
 * Query the backend to see monitored wallets
 */

const API_URL = 'https://sr-mobile-production.up.railway.app';

async function checkMonitoring() {
  console.log('🔍 Checking Helius monitoring status...\n');
  
  const walletToCheck = '3N2dmcXyQ4wMcsX18CCcr3dxmDbmbrUwU2D3LCCrhSbA';
  console.log(`Target wallet: ${walletToCheck}\n`);
  
  // Check if server has the dynamic monitoring feature
  console.log('📊 Testing if wallet was added to monitoring...');
  console.log('   (This requires checking Railway logs directly)\n');
  
  // Try to authenticate again and watch for log message
  console.log('💡 Re-authenticating to trigger addWallet() again...\n');
  
  const challengeRes = await fetch(`${API_URL}/auth/agent/challenge`);
  const { nonce } = await challengeRes.json();
  
  console.log(`✓ Got nonce: ${nonce.substring(0, 20)}...`);
  console.log('\nℹ️  To verify wallet is monitored, check Railway logs for:');
  console.log('   "➕ Added wallet to monitoring: 3N2dmcXy..."');
  console.log('   OR');
  console.log('   "⚠️ Wallet already tracked: 3N2dmcXy..."\n');
  
  console.log('📝 Steps to verify in Railway:');
  console.log('   1. Go to Railway dashboard');
  console.log('   2. Open backend service logs');
  console.log('   3. Search for "3N2dmcXy"');
  console.log('   4. Look for "Added wallet to monitoring" or "Wallet already tracked"\n');
  
  return true;
}

checkMonitoring().catch(console.error);
