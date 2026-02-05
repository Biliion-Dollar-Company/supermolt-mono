import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Setting epoch to ACTIVE...\n');
  
  const epochId = 'ab09bf12-2b88-407e-838f-3235df80f8e7';
  
  const updated = await prisma.scannerEpoch.update({
    where: { id: epochId },
    data: { status: 'ACTIVE' }
  });
  
  console.log('✅ Epoch status updated!');
  console.log(`  - Name: ${updated.name}`);
  console.log(`  - Status: ${updated.status}`);
  console.log(`  - USDC Pool: ${updated.usdcPool} USDC\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
