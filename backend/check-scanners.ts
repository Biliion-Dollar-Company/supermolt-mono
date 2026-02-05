import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:GrHgoylHRBnWygCwOkovCKkmVgprCAXP@caboose.proxy.rlwy.net:16739/railway'
});

async function main() {
  const scanners = await prisma.scanner.findMany();
  console.log('Scanners in Railway DB:', JSON.stringify(scanners, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
