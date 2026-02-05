/**
 * Migration Script: Add Existing SIWS Agents to Helius Monitoring
 * 
 * This script finds all existing agents with Solana wallet addresses (SIWS agents)
 * and adds them to Helius WebSocket monitoring.
 * 
 * Run: bun run scripts/migrate-existing-agents.ts
 */

import { PrismaClient } from '@prisma/client';
import { heliusMonitor } from '../src/index.js';

const db = new PrismaClient();

async function migrateExistingAgents() {
  try {
    console.log('🔍 Finding existing SIWS agents...\n');

    // Find all agents with wallet-like userIds (32-44 chars, typical Solana address length)
    const agents = await db.tradingAgent.findMany({
      where: {
        AND: [
          { userId: { not: { contains: '@' } } }, // Exclude email-based users
          { userId: { not: { contains: 'auth0' } } } // Exclude Auth0 users
        ]
      },
      select: {
        id: true,
        userId: true,
        name: true,
        createdAt: true
      }
    });

    const walletAgents = agents.filter(
      agent => agent.userId.length >= 32 && agent.userId.length <= 44
    );

    console.log(`Found ${walletAgents.length} SIWS agents with wallet addresses\n`);

    if (walletAgents.length === 0) {
      console.log('✅ No agents to migrate');
      return;
    }

    if (!heliusMonitor) {
      console.error('❌ Helius monitor not initialized. Make sure HELIUS_API_KEY is set.');
      process.exit(1);
    }

    console.log('➕ Adding wallets to Helius monitoring...\n');

    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const agent of walletAgents) {
      try {
        heliusMonitor.addWallet(agent.userId);
        console.log(`  ✅ ${agent.name} (${agent.userId.slice(0, 8)}...)`);
        added++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('already tracked')) {
          console.log(`  ⚠️  ${agent.name} (${agent.userId.slice(0, 8)}...) - already tracked`);
          skipped++;
        } else {
          console.error(`  ❌ ${agent.name} (${agent.userId.slice(0, 8)}...) - ${error}`);
          failed++;
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Added: ${added}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total wallets tracked: ${heliusMonitor.getTrackedWalletCount()}`);

    if (heliusMonitor.getTrackedWalletCount() >= 100) {
      console.warn('\n⚠️  WARNING: Approaching or exceeded 100 wallet limit per WebSocket connection!');
      console.warn('   Consider implementing multiple WebSocket connections for scale.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run if executed directly
if (import.meta.main) {
  migrateExistingAgents()
    .then(() => {
      console.log('\n✅ Migration complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration error:', error);
      process.exit(1);
    });
}

export { migrateExistingAgents };
