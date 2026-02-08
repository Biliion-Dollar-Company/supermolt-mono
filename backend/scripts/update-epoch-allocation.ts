import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const epochId = 'ab09bf12-2b88-407e-838f-3235df80f8e7';
  
  // Lower to 4.9 to fit within 20 USDC (was 5, giving 20.13)
  const updated = await prisma.scannerEpoch.update({
    where: { id: epochId },
    data: { baseAllocation: 4.9 }
  });
  
  console.log('✅ Updated epoch base allocation:');
  console.log(`  - Base allocation: ${updated.baseAllocation} USDC`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
