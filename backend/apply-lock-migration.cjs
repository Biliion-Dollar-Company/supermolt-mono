#!/usr/bin/env node
/**
 * Apply Job Execution Locks Migration
 */

const { Client } = require('pg');

const migration = `
  CREATE TABLE IF NOT EXISTS "job_execution_locks" (
    "jobKey" TEXT PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS "job_execution_locks_expiresAt_idx"
    ON "job_execution_locks"("expiresAt");
`;

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

        console.log('📝 Creating job_execution_locks table...\n');
        await client.query(migration);
        console.log('✅ Migration complete!');

        // Verify
        const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'job_execution_locks';
    `);

        console.log('\nTable columns:');
        rows.forEach(row => {
            console.log(`   ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
