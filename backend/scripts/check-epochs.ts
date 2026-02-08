import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Checking all epochs...\n');
  
  const epochs = await prisma.scannerEpoch.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${epochs.length} epoch(s):\n`);
  
  epochs.forEach((epoch, i) => {
    console.log(`${i + 1}. ${epoch.name}`);
    console.log(`   - ID: ${epoch.id}`);
    console.log(`   - Status: ${epoch.status}`);
    console.log(`   - Distributed: ${epoch.distributed}`);
    console.log(`   - USDC Pool: ${epoch.usdcPool} USDC`);
    console.log(`   - Start: ${epoch.startAt}`);
    console.log(`   - End: ${epoch.endAt}`);
    console.log('');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
