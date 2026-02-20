import { db } from '../src/lib/db';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'a54aa22b-42de-43b9-aba1-e84d2d4df016';
const WALLET = '31ySFhvatv8T5PeKLeAzngVYWY1ngucUDmL9BVvUaFta';

async function fetchTransactions() {
  console.log(`Fetching transactions for ${WALLET} from Helius...`);
  
  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${WALLET}/transactions?api-key=${HELIUS_API_KEY}&limit=100&type=SWAP`
  );
  
  if (!response.ok) {
    console.error('Helius API error:', response.status, await response.text());
    process.exit(1);
  }
  
  const transactions = await response.json();
  console.log(`✅ Fetched ${transactions.length} transactions`);
  
  return transactions;
}

async function syncTrades() {
  const agent = await db.tradingAgent.findFirst({
    where: { userId: WALLET },
    select: { id: true, name: true }
  });
  
  if (!agent) {
    console.error('❌ Agent not found for wallet:', WALLET);
    process.exit(1);
  }
  
  console.log(`\nAgent found: ${agent.name} (${agent.id})`);
  
  const txs = await fetchTransactions();
  
  let swaps = 0;
  for (const tx of txs) {
    // Parse swap data from Helius response
    if (tx.type === 'SWAP' && tx.tokenTransfers?.length > 0) {
      swaps++;
      console.log(`  Swap ${swaps}: ${new Date(tx.timestamp * 1000).toISOString()}`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total transactions: ${txs.length}`);
  console.log(`   Swaps detected: ${swaps}`);
  console.log(`\nℹ️  To populate trades, we need to:`);
  console.log(`   1. Parse each swap (Jupiter/Raydium/Pump.fun)`);
  console.log(`   2. Determine buy vs sell + token + SOL amount`);
  console.log(`   3. Insert into PaperTrade table`);
  console.log(`\n💡 Want me to build the full sync script?`);
  
  process.exit(0);
}

syncTrades();
