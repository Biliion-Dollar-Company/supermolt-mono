/**
 * Create Season with 2 Epochs (5 days each)
 * 
 * Season Structure:
 * - Epoch 1: 5 days
 * - Epoch 2: 5 days
 * Total: 10 days per season
 * 
 * Usage:
 *   DATABASE_URL="..." bun run scripts/create-season-epochs.ts [seasonNumber]
 */

import { db as prisma } from '../src/lib/db';

async function main() {
  const seasonNumber = parseInt(process.argv[2] || '1');
  const usdcPoolPerEpoch = parseFloat(process.argv[3] || '500'); // 500 USDC per epoch
  
  console.log(`\n🎮 Creating Season ${seasonNumber} (2 epochs × 5 days)\n`);
  console.log(`   USDC per epoch: ${usdcPoolPerEpoch}`);
  console.log(`   Total pool: ${usdcPoolPerEpoch * 2}\n`);

  // Delete any existing active/upcoming epochs
  const deleted = await prisma.scannerEpoch.deleteMany({
    where: {
      status: { in: ['ACTIVE', 'UPCOMING'] }
    }
  });
  
  if (deleted.count > 0) {
    console.log(`⚠️  Deleted ${deleted.count} existing active/upcoming epochs\n`);
  }

  // Get last epoch number
  const lastEpoch = await prisma.scannerEpoch.findFirst({
    orderBy: { epochNumber: 'desc' }
  });
  
  const startingEpochNumber = (lastEpoch?.epochNumber || 0) + 1;

  // Create Epoch 1 (starts now, 5 days)
  const epoch1Start = new Date();
  const epoch1End = new Date(epoch1Start);
  epoch1End.setDate(epoch1End.getDate() + 5);

  const epoch1 = await prisma.scannerEpoch.create({
    data: {
      epochNumber: startingEpochNumber,
      name: `Season ${seasonNumber} - Epoch 1`,
      chain: 'solana',
      startAt: epoch1Start,
      endAt: epoch1End,
      status: 'ACTIVE',
      usdcPool: usdcPoolPerEpoch,
      baseAllocation: usdcPoolPerEpoch * 0.2 // 20% base
    }
  });

  console.log('✅ Epoch 1 Created:');
  console.log(`   ID: ${epoch1.id}`);
  console.log(`   Name: ${epoch1.name}`);
  console.log(`   Start: ${epoch1.startAt.toISOString()}`);
  console.log(`   End: ${epoch1.endAt.toISOString()}`);
  console.log(`   Status: ${epoch1.status}`);
  console.log(`   USDC Pool: ${epoch1.usdcPool}`);

  // Create Epoch 2 (starts when Epoch 1 ends, 5 days)
  const epoch2Start = new Date(epoch1End);
  const epoch2End = new Date(epoch2Start);
  epoch2End.setDate(epoch2End.getDate() + 5);

  const epoch2 = await prisma.scannerEpoch.create({
    data: {
      epochNumber: startingEpochNumber + 1,
      name: `Season ${seasonNumber} - Epoch 2`,
      chain: 'solana',
      startAt: epoch2Start,
      endAt: epoch2End,
      status: 'UPCOMING',
      usdcPool: usdcPoolPerEpoch,
      baseAllocation: usdcPoolPerEpoch * 0.2
    }
  });

  console.log('\n✅ Epoch 2 Created:');
  console.log(`   ID: ${epoch2.id}`);
  console.log(`   Name: ${epoch2.name}`);
  console.log(`   Start: ${epoch2.startAt.toISOString()}`);
  console.log(`   End: ${epoch2.endAt.toISOString()}`);
  console.log(`   Status: ${epoch2.status}`);
  console.log(`   USDC Pool: ${epoch2.usdcPool}`);

  console.log(`\n🎉 Season ${seasonNumber} created!`);
  console.log(`   Total duration: 10 days`);
  console.log(`   Total USDC: ${usdcPoolPerEpoch * 2}`);
  console.log(`   Epoch 1: ${epoch1Start.toLocaleDateString()} - ${epoch1End.toLocaleDateString()}`);
  console.log(`   Epoch 2: ${epoch2Start.toLocaleDateString()} - ${epoch2End.toLocaleDateString()}`);
  
  console.log('\n💡 Next steps:');
  console.log('   1. Fund treasury wallet');
  console.log('   2. Agents start trading');
  console.log('   3. System auto-transitions to Epoch 2 on', epoch2Start.toLocaleDateString());
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
