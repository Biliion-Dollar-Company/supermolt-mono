/**
 * Test Treasury Distribution E2E
 * Runs distribution directly (bypasses admin auth)
 */
import { TreasuryManagerService } from './src/services/treasury-manager.service';

async function main() {
  console.log('🎯 Starting Treasury Distribution E2E Test...\n');
  
  const epochId = 'ab09bf12-2b88-407e-838f-3235df80f8e7';
  const treasury = new TreasuryManagerService();
  
  // Step 1: Check treasury status
  console.log('📊 Step 1: Treasury Status');
  const status = await treasury.getTreasuryStatus();
  console.log(`  - Balance: ${status.totalBalance} USDC`);
  console.log(`  - Available: ${status.available} USDC\n`);
  
  // Step 2: Calculate allocations
  console.log('🧮 Step 2: Calculate Allocations');
  const allocations = await treasury.calculateAllocations(epochId);
  const totalAmount = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
  console.log(`  - Total to distribute: ${totalAmount.toFixed(2)} USDC`);
  console.log(`  - Scanners: ${allocations.length}\n`);
  
  allocations.forEach(a => {
    console.log(`  ${a.rank}. ${a.scannerName}: ${a.usdcAmount} USDC (${a.winRate}% win rate)`);
  });
  
  // Step 3: Execute distribution
  console.log('\n💸 Step 3: Executing Distribution...');
  const result = await treasury.distributeRewards(epochId);
  
  if (!result.success) {
    console.error('❌ Distribution failed:', result.error);
    process.exit(1);
  }
  
  // Step 4: Show results
  console.log('\n✅ Distribution Complete!\n');
  console.log('📜 Transactions:');
  result.transactions.forEach(tx => {
    const alloc = allocations.find(a => a.scannerId === tx.scannerId);
    const status = tx.status === 'success' ? '✅' : '❌';
    console.log(`  ${status} ${alloc?.scannerName}: ${alloc?.usdcAmount} USDC`);
    if (tx.txSignature) {
      console.log(`     Signature: ${tx.txSignature}`);
      console.log(`     Explorer: https://explorer.solana.com/tx/${tx.txSignature}?cluster=devnet`);
    }
    if (tx.error) {
      console.log(`     Error: ${tx.error}`);
    }
  });
  
  const successCount = result.transactions.filter(t => t.status === 'success').length;
  const failCount = result.transactions.filter(t => t.status === 'failed').length;
  
  console.log(`\n📊 Summary:`);
  console.log(`  - Successful: ${successCount}/${result.transactions.length}`);
  console.log(`  - Failed: ${failCount}/${result.transactions.length}`);
  console.log(`  - Total distributed: ${totalAmount.toFixed(2)} USDC`);
  
  // Step 5: Check updated treasury
  console.log('\n💰 Final Treasury Status:');
  const finalStatus = await treasury.getTreasuryStatus();
  console.log(`  - Remaining: ${finalStatus.available} USDC`);
  console.log(`  - Distributed: ${finalStatus.distributed} USDC\n`);
  
  console.log('🎉 E2E Test Complete!');
}

main()
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
