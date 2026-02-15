import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== DATABASE STATUS ===\n');
  
  // Check scanners
  const scanners = await prisma.scanner.findMany({
    select: { id: true, agentId: true, name: true, pubkey: true }
  });
  console.log(`📊 Scanners (${scanners.length}):`);
  scanners.forEach(s => console.log(`  - ${s.name} (${s.agentId.slice(0,8)}...)`));
  
  // Check epochs
  const epochs = await prisma.scannerEpoch.findMany({
    select: { id: true, name: true, status: true, startAt: true, endAt: true }
  });
  console.log(`\n📅 Epochs (${epochs.length}):`);
  epochs.forEach(e => console.log(`  - ${e.name} (${e.status})`));
  
  // Check scanner rankings
  const rankings = await prisma.scannerRanking.findMany({
    include: { scanner: true, epoch: true }
  });
  console.log(`\n🏆 Scanner Rankings (${rankings.length}):`);
  rankings.forEach(r => console.log(`  - ${r.scanner.name} in ${r.epoch.name}: ${r.totalCalls} calls, ${r.winRate}% win rate`));
  
  // Check scanner calls
  const calls = await prisma.scannerCall.findMany({
    select: { id: true, scannerId: true, tokenSymbol: true, status: true }
  });
  console.log(`\n📞 Scanner Calls (${calls.length}):`);
  console.log(`  Open: ${calls.filter(c => c.status === 'open').length}`);
  console.log(`  Closed: ${calls.filter(c => c.status !== 'open').length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
