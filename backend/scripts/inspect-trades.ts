#!/usr/bin/env tsx
import pg from 'pg';

const AGENT_ID = 'cmlum02bv0000kqst8b1wsmf8'; // @henrylatham

async function inspect() {
  const client = new pg.Client({
    connectionString: 'postgresql://henry@localhost:5432/supermolt'
  });

  await client.connect();

  const res = await client.query(`
    SELECT 
      id, "tokenSymbol", action, status,
      "entryPrice", "exitPrice", amount, "tokenAmount",
      pnl, "pnlPercent", "openedAt", "closedAt"
    FROM paper_trades
    WHERE "agentId" = $1
    ORDER BY "openedAt" DESC
    LIMIT 10
  `, [AGENT_ID]);

  console.log(`\n📊 Sample of ${res.rows.length} most recent trades:\n`);
  
  res.rows.forEach((t, i) => {
    console.log(`${i + 1}. ${t.tokenSymbol} (${t.action})`);
    console.log(`   Status: ${t.status}`);
    console.log(`   Entry Price: ${t.entryPrice}`);
    console.log(`   Exit Price: ${t.exitPrice}`);
    console.log(`   Amount: ${t.amount}`);
    console.log(`   Token Amount: ${t.tokenAmount}`);
    console.log(`   PnL: ${t.pnl}`);
    console.log(`   PnL %: ${t.pnlPercent}`);
    console.log(`   Opened: ${t.openedAt}`);
    console.log(`   Closed: ${t.closedAt}\n`);
  });

  // Check status distribution
  const statusRes = await client.query(`
    SELECT status, COUNT(*) as count
    FROM paper_trades
    WHERE "agentId" = $1
    GROUP BY status
  `, [AGENT_ID]);

  console.log('📈 Status Distribution:\n');
  statusRes.rows.forEach(r => {
    console.log(`   ${r.status}: ${r.count} trades`);
  });

  // Check action distribution
  const actionRes = await client.query(`
    SELECT action, COUNT(*) as count
    FROM paper_trades
    WHERE "agentId" = $1
    GROUP BY action
  `, [AGENT_ID]);

  console.log('\n📊 Action Distribution:\n');
  actionRes.rows.forEach(r => {
    console.log(`   ${r.action}: ${r.count} trades`);
  });

  await client.end();
}

inspect().catch(console.error);
