#!/usr/bin/env node
/**
 * Run XP System Migration on Railway Database
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
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  console.log('🔄 Connecting to Railway database...\n');

  const client = new Client({
    connectionString: DATABASE_URL,
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
    agentCols.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Verify agent_tasks tokenMint
    const { rows: taskCols } = await client.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'agent_tasks' 
      AND column_name = 'tokenMint';
    `);

    console.log('\nagent_tasks tokenMint:');
    taskCols.forEach(row => {
      console.log(`   ${row.column_name}: nullable=${row.is_nullable}`);
    });

    console.log('\n✅ Migration complete!');
    console.log('\n🚀 Ready to deploy backend changes\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
