#!/usr/bin/env tsx
import pg from 'pg';

async function checkSchema() {
  const client = new pg.Client({
    connectionString: 'postgresql://henry@localhost:5432/supermolt'
  });
  
  await client.connect();
  
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'trading_agents' 
    ORDER BY ordinal_position
  `);
  
  console.log('Columns in trading_agents:');
  res.rows.forEach(r => console.log('-', r.column_name));
  
  await client.end();
}

checkSchema().catch(console.error);
