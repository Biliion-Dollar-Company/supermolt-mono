/**
 * Investigate WHY user's screener shows graduated tokens that we don't see in LiquidityAdded events.
 * 
 * Hypothesis: tokens graduating to USDT/USD1 pairs may use different mechanism.
 * 
 * Steps:
 * 1. Find full addresses for user's tokens from V2 factory TokenCreate events
 * 2. Check if they have PancakeSwap pairs (WBNB, USDT, USD1)
 * 3. If pair exists, find what tx created it
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

// Helper: fetch logs in chunks to avoid the 50k block range limit
async function getLogsChunked(filter: any, fromBlock: number, toBlock: number, chunkSize = 40000): Promise<any[]> {
  const allLogs: any[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);
    const logs = await rpc("eth_getLogs", [{
      ...filter,
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
    }]);
    allLogs.push(...logs);
  }
  return allLogs;
}

const V2_FACTORY = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";
const TOKEN_CREATE = "0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20";
const PANCAKE_FACTORY = "0xca143ce32fe78f1f7019d7d551a6402fc5350c73";
const PAIR_CREATED = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";

const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
const USDT = "0x55d398326f99059ff775485246999027b3197955";
const USD1 = "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d"; // Usual USD1

// User's tokens from screener (showing as graduated/Migrado)
const userTokenPrefixes = [
  { name: "在吉尔吉斯斯坦骑马", prefix: "f28c", suffix: "594444" },
  { name: "中文狗", prefix: "a5cb", suffix: "df4444" },
  { name: "长鹏策马踏平川", prefix: "97f8", suffix: "384444" },
  { name: "meme", prefix: "568f", suffix: "7d4444" },
  { name: "YDDM", prefix: "69cf", suffix: "d9ffff" },
  { name: "DINO", prefix: "6614", suffix: "14ffff" },
];

const latestHex = await rpc("eth_blockNumber", []);
const latest = parseInt(latestHex, 16);
const from48h = latest - 57600; // 48h

console.log("=== STEP 1: Find full addresses from V2 factory TokenCreate events ===\n");

// Get all TokenCreate events from last 48h (chunked)
const creates = await getLogsChunked(
  { address: V2_FACTORY, topics: [[TOKEN_CREATE]] },
  from48h, latest
);

console.log("Total TokenCreate events in 48h:", creates.length);

// Extract token addresses and match to user's tokens
const fullAddresses: Record<string, string> = {};
for (const log of creates) {
  const d = log.data.slice(2);
  // TokenCreate event data: slot0=creator(addr), slot1=token(addr), slot2=platform(uint), ...
  // The token address is in slot 1 (bytes 64-128, with addr at bytes 88-128)
  const tokenAddr = ("0x" + d.slice(24 + 64, 64 + 64)).toLowerCase();
  
  for (const t of userTokenPrefixes) {
    if (tokenAddr.startsWith("0x" + t.prefix.toLowerCase()) && tokenAddr.endsWith(t.suffix.toLowerCase())) {
      fullAddresses[t.name] = tokenAddr;
    }
  }
}

console.log("\nMatched addresses:");
for (const [name, addr] of Object.entries(fullAddresses)) {
  console.log(`  ${name}: ${addr}`);
}
for (const t of userTokenPrefixes) {
  if (!fullAddresses[t.name]) {
    console.log(`  ${t.name}: NOT FOUND in V2 TokenCreate events`);
  }
}

console.log("\n=== STEP 2: Check PancakeSwap pairs ===\n");

// getPair function: selector 0xe6a43905
async function getPair(tokenA: string, tokenB: string): Promise<string> {
  const selector = "0xe6a43905";
  const paddedA = tokenA.slice(2).toLowerCase().padStart(64, "0");
  const paddedB = tokenB.slice(2).toLowerCase().padStart(64, "0");
  const callData = selector + paddedA + paddedB;
  
  const result = await rpc("eth_call", [{
    to: PANCAKE_FACTORY,
    data: callData,
  }, "latest"]);
  
  // Result is address padded to 32 bytes
  const pairAddr = "0x" + result.slice(26);
  return pairAddr === "0x" + "0".repeat(40) ? "" : pairAddr;
}

for (const [name, tokenAddr] of Object.entries(fullAddresses)) {
  console.log(`--- ${name} (${tokenAddr.slice(0, 14)}...) ---`);
  
  try {
    const wbnbPair = await getPair(tokenAddr, WBNB);
    const usdtPair = await getPair(tokenAddr, USDT);
    const usd1Pair = await getPair(tokenAddr, USD1);
    
    console.log(`  WBNB pair: ${wbnbPair || "NONE"}`);
    console.log(`  USDT pair: ${usdtPair || "NONE"}`);
    console.log(`  USD1 pair: ${usd1Pair || "NONE"}`);
    
    // For any existing pair, find who created it
    const existingPairs = [];
    if (wbnbPair) existingPairs.push({ type: "WBNB", pair: wbnbPair });
    if (usdtPair) existingPairs.push({ type: "USDT", pair: usdtPair });
    if (usd1Pair) existingPairs.push({ type: "USD1", pair: usd1Pair });
    
    if (existingPairs.length === 0) {
      console.log("  STATUS: NO PancakeSwap pair exists — NOT actually graduated?");
    }
    
  } catch (e: any) {
    console.log("  ERROR:", e.message?.slice(0, 100));
  }
}

console.log("\n=== STEP 3: Find PairCreated events for matched tokens ===\n");

// Search PairCreated events and match against our token addresses
const from24h = latest - 28800;
const pairLogs = await getLogsChunked(
  { address: PANCAKE_FACTORY, topics: [[PAIR_CREATED]] },
  from24h, latest
);

console.log("PancakeSwap PairCreated events in 24h:", pairLogs.length);

const tokenAddrs = new Set(Object.values(fullAddresses).map(a => a.toLowerCase()));

for (const log of pairLogs) {
  const token0 = ("0x" + log.topics[1].slice(26)).toLowerCase();
  const token1 = ("0x" + log.topics[2].slice(26)).toLowerCase();
  
  if (tokenAddrs.has(token0) || tokenAddrs.has(token1)) {
    const matchedToken = tokenAddrs.has(token0) ? token0 : token1;
    const otherToken = matchedToken === token0 ? token1 : token0;
    
    let quoteLabel = otherToken;
    if (otherToken === WBNB) quoteLabel = "WBNB";
    else if (otherToken === USDT) quoteLabel = "USDT";
    else if (otherToken === USD1) quoteLabel = "USD1";
    
    // Find who triggered this
    const tx = await rpc("eth_getTransactionByHash", [log.transactionHash]);
    
    const name = Object.entries(fullAddresses).find(([_, a]) => a.toLowerCase() === matchedToken)?.[0] || "unknown";
    console.log(`  ${name} → ${quoteLabel} pair`);
    console.log(`    TX to: ${tx.to}`);
    console.log(`    TX from: ${tx.from}`);
    console.log(`    TX hash: ${log.transactionHash}`);
    console.log(`    Block: ${parseInt(log.blockNumber, 16)}`);
    
    const isV2Factory = tx.to?.toLowerCase() === V2_FACTORY;
    console.log(`    Triggered by Four.Meme V2: ${isV2Factory ? "YES" : "NO — different contract!"}`);
    console.log();
  }
}

// Also check: what if these tokens graduated via V3 helper or a different Four.Meme contract?
console.log("\n=== STEP 4: Check if there are OTHER Four.Meme contracts creating pairs ===\n");

// Get unique "to" addresses from PairCreated transactions
const creators: Record<string, number> = {};
const sampleTxs = pairLogs.slice(0, 100);
for (const log of sampleTxs) {
  const tx = await rpc("eth_getTransactionByHash", [log.transactionHash]);
  const to = (tx.to || "none").toLowerCase();
  creators[to] = (creators[to] || 0) + 1;
}

console.log("Top pair creators (from first 100 PairCreated events in 24h):");
const sortedCreators = Object.entries(creators).sort((a, b) => b[1] - a[1]);
for (const [addr, count] of sortedCreators.slice(0, 15)) {
  let label = addr.slice(0, 14) + "...";
  if (addr === V2_FACTORY) label += " [FOUR.MEME V2]";
  if (addr === WBNB) label += " [WBNB]";
  console.log(`  ${label} → ${count} pairs`);
}

console.log("\n=== STEP 5: Check USDT/USD1 LiquidityAdded events specifically ===\n");

// Get ALL LiquidityAdded events and check quote token
const LIQUIDITY_ADDED = "0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0";
const liqLogs = await getLogsChunked(
  { address: V2_FACTORY, topics: [[LIQUIDITY_ADDED]] },
  from48h, latest
);

console.log("All LiquidityAdded events in 48h:", liqLogs.length);
for (const log of liqLogs) {
  const d = log.data.slice(2);
  const baseToken = "0x" + d.slice(24, 64);
  const quoteToken = "0x" + d.slice(152, 192);
  const funds = BigInt("0x" + d.slice(192, 256));
  
  let quoteLabel = quoteToken.slice(0, 14) + "...";
  if (quoteToken.toLowerCase() === WBNB) quoteLabel = "WBNB";
  else if (quoteToken.toLowerCase() === USDT) quoteLabel = "USDT";
  else if (quoteToken.toLowerCase() === USD1) quoteLabel = "USD1";
  else if (quoteToken === "0x" + "0".repeat(40)) quoteLabel = "ZERO_ADDRESS";
  
  // Check if this is one of our tokens
  const isOurs = tokenAddrs.has(baseToken.toLowerCase());
  
  console.log(`  Block ${parseInt(log.blockNumber, 16)} | Token: ${baseToken.slice(0, 14)}... | Quote: ${quoteLabel} | Value: ${(Number(funds) / 1e18).toFixed(2)} | Ours: ${isOurs}`);
}
