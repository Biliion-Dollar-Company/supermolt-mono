/**
 * Test Script: Verify Dynamic Wallet Monitoring
 * 
 * Tests the dynamic wallet monitoring functionality:
 * 1. Add a test wallet
 * 2. Remove a test wallet
 * 3. Verify subscription limits
 * 
 * Run: bun run scripts/test-dynamic-monitoring.ts
 */

import { heliusMonitor } from '../src/index.js';

async function testDynamicMonitoring() {
  console.log('🧪 Testing Dynamic Wallet Monitoring\n');

  if (!heliusMonitor) {
    console.error('❌ Helius monitor not initialized');
    console.error('   Make sure HELIUS_API_KEY is set in .env');
    process.exit(1);
  }

  const testWallet = 'TestWallet1234567890123456789012345'; // Dummy 35-char address

  try {
    // Test 1: Initial state
    console.log('📊 Test 1: Initial State');
    const initialCount = heliusMonitor.getTrackedWalletCount();
    console.log(`   Tracked wallets: ${initialCount}\n`);

    // Test 2: Add wallet
    console.log('📊 Test 2: Add Wallet');
    heliusMonitor.addWallet(testWallet);
    const afterAddCount = heliusMonitor.getTrackedWalletCount();
    console.log(`   Tracked wallets after add: ${afterAddCount}`);
    
    if (afterAddCount === initialCount + 1) {
      console.log('   ✅ Add wallet successful\n');
    } else {
      console.log('   ❌ Add wallet failed - count mismatch\n');
    }

    // Test 3: Add duplicate (should be ignored)
    console.log('📊 Test 3: Add Duplicate Wallet');
    heliusMonitor.addWallet(testWallet);
    const afterDupeCount = heliusMonitor.getTrackedWalletCount();
    
    if (afterDupeCount === afterAddCount) {
      console.log('   ✅ Duplicate correctly ignored\n');
    } else {
      console.log('   ❌ Duplicate handling failed\n');
    }

    // Test 4: Remove wallet
    console.log('📊 Test 4: Remove Wallet');
    heliusMonitor.removeWallet(testWallet);
    const afterRemoveCount = heliusMonitor.getTrackedWalletCount();
    
    if (afterRemoveCount === initialCount) {
      console.log('   ✅ Remove wallet successful\n');
    } else {
      console.log('   ❌ Remove wallet failed - count mismatch\n');
    }

    // Test 5: Connection status
    console.log('📊 Test 5: Connection Status');
    const isRunning = heliusMonitor.isRunning();
    console.log(`   WebSocket connected: ${isRunning ? '✅' : '❌'}\n`);

    // Test 6: Capacity check
    console.log('📊 Test 6: Capacity Check');
    const capacity = 100 - heliusMonitor.getTrackedWalletCount();
    console.log(`   Available capacity: ${capacity} wallets`);
    
    if (capacity < 10) {
      console.warn('   ⚠️  WARNING: Less than 10 slots remaining!');
    } else if (capacity < 0) {
      console.error('   ❌ CRITICAL: Over capacity!');
    } else {
      console.log('   ✅ Capacity OK\n');
    }

    console.log('✅ All tests completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  // Wait a moment for monitor to initialize
  setTimeout(() => {
    testDynamicMonitoring()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }, 2000);
}

export { testDynamicMonitoring };
