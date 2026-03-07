/**
 * Startup migration — creates tables that Prisma schema doesn't auto-push
 * Runs once at server boot, idempotent (CREATE TABLE IF NOT EXISTS)
 */
import { db } from './db';

export async function runStartupMigrations() {
  try {
    // Create swarm_decisions table if it doesn't exist
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS swarm_decisions (
        id TEXT NOT NULL PRIMARY KEY,
        "marketId" TEXT NOT NULL,
        question TEXT NOT NULL,
        consensus TEXT NOT NULL,
        confidence DOUBLE PRECISION NOT NULL,
        votes JSONB NOT NULL,
        executed BOOLEAN NOT NULL DEFAULT false,
        "dryRun" BOOLEAN NOT NULL DEFAULT true,
        "txHash" TEXT,
        "erc8004Logged" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS swarm_decisions_marketId_idx ON swarm_decisions("marketId")
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS swarm_decisions_createdAt_idx ON swarm_decisions("createdAt")
    `);

    console.log('[migrate] ✅ swarm_decisions table ready');
  } catch (err) {
    // Non-fatal — log and continue, don't crash server
    console.error('[migrate] ⚠️ startup migration error:', err);
  }
}
