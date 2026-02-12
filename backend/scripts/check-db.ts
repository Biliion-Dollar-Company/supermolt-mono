
import { db } from '../src/lib/db';

async function checkDb() {
  const url = process.env.DATABASE_URL || 'NOT_SET';
  console.log(`DB Host: ${url.split('@')[1]?.split(':')[0] || 'UNKNOWN'}`);

  const agentCount = await db.tradingAgent.count();
  const scannerCount = await db.scanner.count();
  const tradeCount = await db.agentTrade.count();
  const paperTradeCount = await db.paperTrade.count();

  console.log(`
  Stats:
  - TradingAgents: ${agentCount}
  - Scanners: ${scannerCount}
  - AgentTrades: ${tradeCount}
  - PaperTrades: ${paperTradeCount}
  `);

  if (tradeCount > 0) {
    console.log('Sample Trade:');
    const t = await db.agentTrade.findFirst();
    console.log(JSON.stringify(t, null, 2));
  } else if (paperTradeCount > 0) {
    console.log('Sample PaperTrade:');
    const t = await db.paperTrade.findFirst();
    console.log(JSON.stringify(t, null, 2));
  }
}

checkDb();
