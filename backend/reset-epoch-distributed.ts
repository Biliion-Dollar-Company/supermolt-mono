import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Resetting epoch distributed status...\n');
  
  // Get the active epoch
  const epoch = await prisma.scannerEpoch.findFirst({
    where: { status: 'active' },
    orderBy: { endAt: 'desc' }
  });
  
  if (!epoch) {
    console.error('❌ No active epoch found');
    process.exit(1);
  }
  
  console.log('📋 Found epoch:', epoch.name);
  console.log('  - ID:', epoch.id);
  console.log('  - Distributed:', epoch.distributed);
  console.log('  - Distribution Date:', epoch.distributionDate);
  
  // Reset distributed flag
  const updated = await prisma.scannerEpoch.update({
    where: { id: epoch.id },
    data: {
      distributed: false,
      distributionDate: null
    }
  });
  
  console.log('\n✅ Epoch reset complete!');
  console.log('  - Distributed:', updated.distributed);
  console.log('  - Distribution Date:', updated.distributionDate);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
