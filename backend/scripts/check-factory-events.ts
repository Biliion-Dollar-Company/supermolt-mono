/**
 * Analyze ALL events from Four.Meme factory in last 8 hours
 */

async function rpc(method: string, params: any[]): Promise<any> {
  const resp = await fetch("https://bsc-rpc.publicnode.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const data = await resp.json() as any;
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

const TOKEN_CREATE = "0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20";
const LIQUIDITY_ADDED = "0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0";
const TOKEN_PURCHASE = "0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942";

const latestHex = await rpc("eth_blockNumber", []);
const latest = parseInt(latestHex, 16);
console.log("Current block:", latest);

// Last ~8 hours (~9600 blocks)
const from = latest - 9600;
console.log("Scanning blocks", from, "to", latest, "(~8 hours)\n");

const logs = await rpc("eth_getLogs", [{
  address: "0x5c952063c7fc8610ffdb798152d69f0b9550762b",
  fromBlock: "0x" + from.toString(16),
  toBlock: "0x" + latest.toString(16),
}]);

console.log("Total events from factory in last ~8h:", logs.length);

// Group by topic
const topics: Record<string, number> = {};
for (const log of logs) {
  const t = log.topics[0];
  topics[t] = (topics[t] || 0) + 1;
}

console.log("\nEvent breakdown by topic:");
const sorted = Object.entries(topics).sort((a, b) => (b[1] as number) - (a[1] as number));
for (const [topic, count] of sorted) {
  let label = "UNKNOWN";
  if (topic === TOKEN_CREATE) label = "TokenCreate";
  else if (topic === LIQUIDITY_ADDED) label = "LiquidityAdded (graduation)";
  else if (topic === TOKEN_PURCHASE) label = "TokenPurchase";
  console.log(`  ${label.padEnd(35)} ${topic.slice(0, 18)}... → ${count} events`);
}

console.log("\nSummary:");
console.log("  TokenCreate:", topics[TOKEN_CREATE] || 0);
console.log("  LiquidityAdded (graduation):", topics[LIQUIDITY_ADDED] || 0);
console.log("  TokenPurchase:", topics[TOKEN_PURCHASE] || 0);

// List unknown topics
const unknownTopics = Object.keys(topics).filter(
  (t) => t !== TOKEN_CREATE && t !== LIQUIDITY_ADDED && t !== TOKEN_PURCHASE
);
if (unknownTopics.length > 0) {
  console.log("\n  UNKNOWN EVENTS WE'RE NOT TRACKING:");
  for (const t of unknownTopics) {
    console.log(`    ${t} → ${topics[t]} events`);
  }
}

// Show all LiquidityAdded events with details
const liqLogs = logs.filter((l: any) => l.topics[0] === LIQUIDITY_ADDED);
if (liqLogs.length > 0) {
  console.log(`\n=== ALL ${liqLogs.length} GRADUATIONS IN LAST 8H ===`);
  for (const log of liqLogs) {
    const block = parseInt(log.blockNumber, 16);
    const d = log.data.slice(2);
    const tokenAddr = "0x" + d.slice(24, 64);
    const funds = BigInt("0x" + d.slice(192, 256));
    const bnb = (Number(funds) / 1e18).toFixed(2);
    console.log(`  Block ${block} | Token: ${tokenAddr.slice(0, 14)}... | ${bnb} BNB | TX: ${log.transactionHash.slice(0, 20)}...`);
  }
}
