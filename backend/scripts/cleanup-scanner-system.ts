/**
 * Remove USDC Scanner/Epoch System
 * 
 * Cleans up:
 * - Scanner epochs
 * - Scanner rankings
 * - Scanner calls
 * - Treasury allocations
 * 
 * Usage:
 *   DATABASE_URL="..." bun run scripts/cleanup-scanner-system.ts
 */

import { db as prisma } from '../src/lib/db';

async function main() {
  console.log('\n🧹 Cleaning up USDC Scanner/Epoch system...\n');

  // Delete in dependency order (foreign keys)
  
  console.log('1️⃣ Deleting treasury allocations...');
  const deletedAllocations = await prisma.treasuryAllocation.deleteMany({});
  console.log(`   ✅ Deleted ${deletedAllocations.count} allocations`);

  console.log('\n2️⃣ Deleting scanner calls...');
  const deletedCalls = await prisma.scannerCall.deleteMany({});
  console.log(`   ✅ Deleted ${deletedCalls.count} calls`);

  console.log('\n3️⃣ Deleting scanner rankings...');
  const deletedRankings = await prisma.scannerRanking.deleteMany({});
  console.log(`   ✅ Deleted ${deletedRankings.count} rankings`);

  console.log('\n4️⃣ Deleting scanner epochs...');
  const deletedEpochs = await prisma.scannerEpoch.deleteMany({});
  console.log(`   ✅ Deleted ${deletedEpochs.count} epochs`);

  console.log('\n5️⃣ Deleting scanners...');
  const deletedScanners = await prisma.scanner.deleteMany({});
  console.log(`   ✅ Deleted ${deletedScanners.count} scanners`);

  console.log('\n6️⃣ Deleting treasury pool...');
  const deletedTreasury = await prisma.treasuryPool.deleteMany({});
  console.log(`   ✅ Deleted ${deletedTreasury.count} treasury records`);

  console.log('\n✅ Cleanup complete!\n');
  console.log('📊 Summary:');
  console.log(`   Treasury allocations: ${deletedAllocations.count}`);
  console.log(`   Scanner calls: ${deletedCalls.count}`);
  console.log(`   Scanner rankings: ${deletedRankings.count}`);
  console.log(`   Scanner epochs: ${deletedEpochs.count}`);
  console.log(`   Scanners: ${deletedScanners.count}`);
  console.log(`   Treasury pool: ${deletedTreasury.count}`);
  
  console.log('\n💡 Next steps:');
  console.log('   1. Update API to remove scanner/epoch endpoints');
  console.log('   2. Remove scanner models from Prisma schema');
  console.log('   3. Run: npx prisma migrate dev --name remove-scanner-system');
  console.log('   4. Deploy updated backend\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
