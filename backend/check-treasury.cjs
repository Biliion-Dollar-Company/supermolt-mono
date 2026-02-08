const { PrismaClient } = require('@prisma/client');

// Use public Railway proxy
const DATABASE_URL = 'postgresql://postgres:rLsqkdPgMBVcwRdlcBYwpexIbUjJaGev@caboose.proxy.rlwy.net:16739/railway';

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
});

async function getRewardStats() {
  try {
    const [treasuryPool, epochs, scannerCount, callsCount, allocCount, agentCount] = await Promise.all([
      prisma.treasuryPool.findFirst(),
      prisma.scannerEpoch.findMany({ orderBy: { epochNumber: 'desc' }, take: 3 }),
      prisma.scanner.count(),
      prisma.scannerCall.count(),
      prisma.treasuryAllocation.count(),
      prisma.tradingAgent.count(),
    ]);
    
    console.log('\n💎 REWARD POOL / TREASURY:\n');
    if (treasuryPool) {
      console.log('   Treasury wallet:', treasuryPool.treasuryWallet.substring(0, 8) + '...' + treasuryPool.treasuryWallet.substring(treasuryPool.treasuryWallet.length - 6));
      console.log('   Total balance:', treasuryPool.totalBalance.toString(), 'USDC');
      console.log('   Allocated:', treasuryPool.allocated.toString(), 'USDC');
      console.log('   Distributed:', treasuryPool.distributed.toString(), 'USDC');
      console.log('   Profits earned:', treasuryPool.profitsEarned.toString(), 'USDC');
    } else {
      console.log('   (No treasury pool created yet)');
    }
    
    console.log('\n📊 EPOCHS:\n');
    if (epochs.length > 0) {
      epochs.forEach(e => {
        console.log('   Epoch', e.epochNumber + ':', e.name);
        console.log('     USDC Pool:', e.usdcPool.toString(), 'USDC');
        console.log('     Status:', e.status);
        console.log('     Base allocation:', e.baseAllocation.toString(), 'USDC');
        console.log('     Period:', e.startAt.toISOString().split('T')[0], '→', e.endAt.toISOString().split('T')[0]);
        console.log('');
      });
    } else {
      console.log('   (No epochs created yet)');
    }
    
    console.log('🔍 ACTIVITY STATS:\n');
    console.log('   Total agents:', agentCount);
    console.log('   Total scanners:', scannerCount);
    console.log('   Scanner calls:', callsCount);
    console.log('   Treasury allocations:', allocCount);
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

getRewardStats();
