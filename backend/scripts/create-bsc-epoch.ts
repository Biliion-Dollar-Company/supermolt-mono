/**
 * Create First BSC Epoch
 * 
 * Quick script to create the first BSC competition epoch
 * 
 * Usage:
 *   bun run scripts/create-bsc-epoch.ts
 */

import { db as prisma } from '../src/lib/db';

async function main() {
  console.log('🚀 Creating first BSC epoch...\n');

  // Get last epoch number
  const lastEpoch = await prisma.scannerEpoch.findFirst({
    orderBy: { epochNumber: 'desc' },
  });

  const nextEpochNumber = (lastEpoch?.epochNumber || 0) + 1;

  // Create BSC epoch (starts tomorrow, runs for 7 days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Tomorrow
  startDate.setHours(0, 0, 0, 0); // Midnight

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7); // 7 days later

  const epoch = await prisma.scannerEpoch.create({
    data: {
      epochNumber: nextEpochNumber,
      name: `BSC Week ${nextEpochNumber}`,
      chain: 'bsc',
      startAt: startDate,
      endAt: endDate,
      status: 'ACTIVE', // Start immediately
      usdcPool: 1000, // 1000 USDC pool
      baseAllocation: 200, // Base reward amount
    },
  });

  console.log('✅ BSC Epoch Created!');
  console.log('\nEpoch Details:');
  console.log('  ID:', epoch.id);
  console.log('  Number:', epoch.epochNumber);
  console.log('  Name:', epoch.name);
  console.log('  Chain:', epoch.chain);
  console.log('  Start:', epoch.startAt.toISOString());
  console.log('  End:', epoch.endAt.toISOString());
  console.log('  Status:', epoch.status);
  console.log('  USDC Pool:', epoch.usdcPool.toString(), 'USDC');
  console.log('  Base Allocation:', epoch.baseAllocation.toString(), 'USDC');

  console.log('\n🎉 BSC competition is now LIVE!');
  console.log('\n💡 Next steps:');
  console.log('  1. Fund BSC treasury wallet with USDC');
  console.log('  2. Update frontend to show both chains');
  console.log('  3. Agents start trading on BSC!');
}

main()
  .catch((e) => {
    console.error('❌ Error creating BSC epoch:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
