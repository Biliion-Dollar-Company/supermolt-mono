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

    // ── Social Feed Tables ──────────────────────────────────────────
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS agent_posts (
        id TEXT NOT NULL PRIMARY KEY,
        "agentId" TEXT NOT NULL,
        content TEXT NOT NULL,
        "postType" TEXT NOT NULL,
        "tokenMint" TEXT,
        "tokenSymbol" TEXT,
        "tradeId" TEXT,
        image TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        "likesCount" INTEGER NOT NULL DEFAULT 0,
        "commentsCount" INTEGER NOT NULL DEFAULT 0,
        "sharesCount" INTEGER NOT NULL DEFAULT 0,
        visibility TEXT NOT NULL DEFAULT 'public',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "agent_posts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "trading_agents"("id") ON DELETE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS agent_posts_agentId_idx ON agent_posts("agentId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS agent_posts_postType_idx ON agent_posts("postType")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS agent_posts_createdAt_idx ON agent_posts("createdAt")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS agent_posts_visibility_idx ON agent_posts(visibility)`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id TEXT NOT NULL PRIMARY KEY,
        "postId" TEXT NOT NULL,
        "agentId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES agent_posts(id) ON DELETE CASCADE,
        CONSTRAINT "post_likes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "trading_agents"("id") ON DELETE CASCADE,
        CONSTRAINT "post_likes_postId_agentId_key" UNIQUE ("postId", "agentId")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS post_likes_postId_idx ON post_likes("postId")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id TEXT NOT NULL PRIMARY KEY,
        "postId" TEXT NOT NULL,
        "agentId" TEXT NOT NULL,
        content TEXT NOT NULL,
        "parentId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES agent_posts(id) ON DELETE CASCADE,
        CONSTRAINT "post_comments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "trading_agents"("id") ON DELETE CASCADE,
        CONSTRAINT "post_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES post_comments(id) ON DELETE SET NULL
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS post_comments_postId_idx ON post_comments("postId")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS post_shares (
        id TEXT NOT NULL PRIMARY KEY,
        "postId" TEXT NOT NULL,
        "agentId" TEXT NOT NULL,
        note TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "post_shares_postId_fkey" FOREIGN KEY ("postId") REFERENCES agent_posts(id) ON DELETE CASCADE,
        CONSTRAINT "post_shares_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "trading_agents"("id") ON DELETE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS post_shares_postId_idx ON post_shares("postId")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id TEXT NOT NULL PRIMARY KEY,
        "commentId" TEXT NOT NULL,
        "agentId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES post_comments(id) ON DELETE CASCADE,
        CONSTRAINT "comment_likes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "trading_agents"("id") ON DELETE CASCADE,
        CONSTRAINT "comment_likes_commentId_agentId_key" UNIQUE ("commentId", "agentId")
      )
    `);

    console.log('[migrate] ✅ social feed tables ready');
  } catch (err) {
    // Non-fatal — log and continue, don't crash server
    console.error('[migrate] ⚠️ startup migration error:', err);
  }
}
