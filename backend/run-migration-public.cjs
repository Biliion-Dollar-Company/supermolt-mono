#!/usr/bin/env node
/**
 * Run XP System Migration on Railway Database (Public Proxy)
 * Uses caboose.proxy.rlwy.net:16739
 */

const { Client } = require('pg');

const migrations = [
  {
    name: 'Add XP column',
    sql: 'ALTER TABLE "trading_agents" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;'
  },
  {
    name: 'Add Level column',
    sql: 'ALTER TABLE "trading_agents" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;'
  },
  {
    name: 'Add XP index',
    sql: 'CREATE INDEX IF NOT EXISTS "trading_agents_xp_idx" ON "trading_agents"("xp");'
  },
  {
    name: 'Make tokenMint optional',
    sql: 'ALTER TABLE "agent_tasks" ALTER COLUMN "tokenMint" DROP NOT NULL;'
  }
];

async function runMigration() {
  // Try DATABASE_URL first, fall back to RAILWAY_PUBLIC_URL
  let connectionString = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;
  
  // If using internal hostname, replace with public proxy
  if (connectionString && connectionString.includes('postgres.railway.internal')) {
    connectionString = connectionString.replace(
      'postgres.railway.internal:5432',
      'caboose.proxy.rlwy.net:16739'
    );
  }
  
  if (!connectionString) {
    console.error('❌ No database connection string found');
    console.log('\nTry running with Railway:');
    console.log('  railway run node run-migration-public.cjs');
    process.exit(1);
  }

  console.log('🔄 Connecting to Railway database...');
  console.log(`   Host: ${connectionString.includes('caboose') ? 'caboose.proxy.rlwy.net:16739' : 'internal'}\n`);

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📝 Running migrations...\n');

    for (const migration of migrations) {
      try {
        console.log(`   → ${migration.name}...`);
        await client.query(migration.sql);
        console.log(`   ✅ ${migration.name} complete`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log(`   ⚠️  ${migration.name} - already applied or not needed`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n🔍 Verifying columns...\n');

    // Verify trading_agents columns
    const { rows: agentCols } = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'trading_agents' 
      AND column_name IN ('xp', 'level')
      ORDER BY column_name;
    `);

    console.log('trading_agents columns:');
    if (agentCols.length === 0) {
      console.log('   ⚠️  No xp/level columns found!');
    } else {
      agentCols.forEach(row => {
        console.log(`   ✅ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }

    // Verify agent_tasks tokenMint
    const { rows: taskCols } = await client.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'agent_tasks' 
      AND column_name = 'tokenMint';
    `);

    console.log('\nagent_tasks tokenMint:');
    if (taskCols.length === 0) {
      console.log('   ⚠️  tokenMint column not found!');
    } else {
      taskCols.forEach(row => {
        console.log(`   ✅ ${row.column_name}: nullable=${row.is_nullable}`);
      });
    }

    console.log('\n✅ Migration complete!');
    console.log('\n🚀 Ready to deploy backend changes\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
