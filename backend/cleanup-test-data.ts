#!/usr/bin/env bun
/**
 * Clean up test data before deployment
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up test data...\n');

  // Delete test FeedActivity records
  const deleted = await db.feedActivity.deleteMany({
    where: {
      AND: [
        { tokenSymbol: 'TEST' },
        { dex: 'Jupiter' },
      ],
    },
  });

  console.log(`✅ Deleted ${deleted.count} test FeedActivity records`);

  // Optionally clear AgentStats for test agent
  const agentDeleted = await db.agentStats.deleteMany({
    where: {
      agentId: 'DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy',
      totalTrades: { lte: 10 }, // Only delete if low trade count (likely test)
    },
  });

  console.log(`✅ Deleted ${agentDeleted.count} test AgentStats records`);

  console.log('\n✨ Cleanup complete!');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
