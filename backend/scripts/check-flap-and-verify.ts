/**
 * Check Flap platform + Verify which user tokens actually have DEX pairs
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

const FLAP_FACTORY = "0x36023a50ae3f00407970ac8c2b130ba6bd1c9f93";
const V2_FACTORY = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";
const PANCAKE_FACTORY = "0xca143ce32fe78f1f7019d7d551a6402fc5350c73";
const PAIR_CREATED = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

const latestHex = await rpc("eth_blockNumber", []);
const latest = parseInt(latestHex, 16);
const from24h = latest - 28800;

// ============================================
// PART 1: Flap Factory Events
// ============================================
console.log("=== FLAP FACTORY EVENTS (24h) ===\n");

try {
  const flapLogs = await rpc("eth_getLogs", [{
    address: FLAP_FACTORY,
    fromBlock: "0x" + from24h.toString(16),
    toBlock: "0x" + latest.toString(16),
  }]);
  
  console.log("Total Flap factory events in 24h:", flapLogs.length);
  
  // Group by topic
  const flapTopics: Record<string, number> = {};
  for (const l of flapLogs) {
    flapTopics[l.topics[0]] = (flapTopics[l.topics[0]] || 0) + 1;
  }
  
  console.log("\nEvent breakdown:");
  for (const [t, c] of Object.entries(flapTopics).sort((a: any, b: any) => b[1] - a[1])) {
    console.log(`  ${t.slice(0, 18)}... → ${c}`);
  }
} catch (e: any) {
  console.log("Flap query error:", e.message?.slice(0, 200));
}

// ============================================
// PART 2: Check PancakeSwap PairCreated for tokens by suffix
// ============================================
console.log("\n=== PANCAKESWAP PAIRS FOR PLATFORM TOKENS (24h) ===\n");

const pairLogs = await rpc("eth_getLogs", [{
  address: PANCAKE_FACTORY,
  topics: [[PAIR_CREATED]],
  fromBlock: "0x" + from24h.toString(16),
  toBlock: "0x" + latest.toString(16),
}]);

console.log("Total PairCreated events in 24h:", pairLogs.length);

const fourMemePairs: any[] = [];
const flapPairs: any[] = [];

for (const log of pairLogs) {
  const token0 = ("0x" + log.topics[1].slice(26)).toLowerCase();
  const token1 = ("0x" + log.topics[2].slice(26)).toLowerCase();
  const nonWbnb = token0 === WBNB ? token1 : token1 === WBNB ? token0 : null;
  const tokenAddr = nonWbnb || token0; // if neither is WBNB, use token0
  const quoteAddr = nonWbnb ? WBNB : token1;
  
  if (tokenAddr.endsWith("4444") || tokenAddr.endsWith("ffff")) {
    fourMemePairs.push({ token: tokenAddr, quote: quoteAddr, tx: log.transactionHash, block: parseInt(log.blockNumber, 16) });
  }
  if (tokenAddr.endsWith("7777")) {
    flapPairs.push({ token: tokenAddr, quote: quoteAddr, tx: log.transactionHash, block: parseInt(log.blockNumber, 16) });
  }
}

console.log("\nFour.Meme tokens that got PancakeSwap pairs (24h):", fourMemePairs.length);
for (const p of fourMemePairs) {
  let quoteLabel = p.quote === WBNB ? "WBNB" : p.quote.slice(0, 14) + "...";
  console.log(`  ${p.token.slice(0, 14)}... | Quote: ${quoteLabel} | Block: ${p.block}`);
}

console.log("\nFlap tokens that got PancakeSwap pairs (24h):", flapPairs.length);
for (const p of flapPairs) {
  let quoteLabel = p.quote === WBNB ? "WBNB" : p.quote.slice(0, 14) + "...";
  console.log(`  ${p.token.slice(0, 14)}... | Quote: ${quoteLabel} | Block: ${p.block}`);
}

// ============================================
// PART 3: Match user's specific tokens
// ============================================
console.log("\n=== MATCHING USER'S SPECIFIC TOKENS ===\n");

const userTokens = [
  { name: "在吉尔吉斯斯坦骑马", suffix: "594444", platform: "Four.meme" },
  { name: "中文狗", suffix: "df4444", platform: "Four.meme" },
  { name: "长鹏策马踏平川", suffix: "384444", platform: "Four.meme" },
  { name: "meme", suffix: "7d4444", platform: "Four.meme" },
  { name: "YDDM", suffix: "d9ffff", platform: "Four.meme" },
  { name: "DINO", suffix: "14ffff", platform: "Four.meme" },
  { name: "MARA", suffix: "ae7777", platform: "Flap" },
  { name: "KAAL", suffix: "157777", platform: "Flap" },
  { name: "过年好", suffix: "ea7777", platform: "Flap" },
  { name: "VIDAI", suffix: "0c7777", platform: "Flap" },
];

const allPlatformPairs = [...fourMemePairs, ...flapPairs];

for (const ut of userTokens) {
  const match = allPlatformPairs.find(p => p.token.endsWith(ut.suffix.toLowerCase()));
  if (match) {
    let quoteLabel = match.quote === WBNB ? "WBNB" : match.quote.slice(0, 14) + "...";
    console.log(`  ✅ ${ut.name} (${ut.platform}) → PancakeSwap pair exists | ${match.token} | Quote: ${quoteLabel}`);
    
    // Check who triggered graduation
    const tx = await rpc("eth_getTransactionByHash", [match.tx]);
    console.log(`     TX to: ${tx.to} | From: ${tx.from}`);
  } else {
    console.log(`  ❌ ${ut.name} (${ut.platform}) → NO PancakeSwap pair in last 24h`);
  }
}

// ============================================
// PART 4: For Flap graduation, check what contract triggers it
// ============================================
console.log("\n=== FLAP GRADUATION MECHANISM ===\n");

if (flapPairs.length > 0) {
  const firstFlap = flapPairs[0];
  const receipt = await rpc("eth_getTransactionReceipt", [firstFlap.tx]);
  console.log("Flap graduation TX events:");
  
  for (let i = 0; i < receipt.logs.length; i++) {
    const l = receipt.logs[i];
    const addr = l.address.toLowerCase();
    let label = addr.slice(0, 14) + "...";
    if (addr === FLAP_FACTORY) label = "FLAP_FACTORY";
    if (addr === WBNB) label = "WBNB";
    if (addr === PANCAKE_FACTORY.toLowerCase()) label = "PCS_V2_FACTORY";
    if (addr === "0x10ed43c718714eb63d5aa57b78b54c9502d2c5d4") label = "PCS_V2_ROUTER";
    
    const knownTopics: Record<string, string> = {
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Transfer",
      "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9": "PairCreated",
      "0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0": "LiquidityAdded",
      "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": "Approval",
      "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c": "Deposit",
      "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f": "Mint",
      "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1": "Sync",
    };
    
    const topicName = knownTopics[l.topics[0]] || l.topics[0].slice(0, 18) + "...";
    console.log(`  [${i}] ${label.padEnd(20)} | ${topicName}`);
  }
  
  // Check if Flap emits its own graduation event
  const flapEvents = receipt.logs.filter((l: any) => l.address.toLowerCase() === FLAP_FACTORY);
  console.log("\nFlap factory events in graduation TX:", flapEvents.length);
  for (const fe of flapEvents) {
    console.log("  Topic:", fe.topics[0]);
  }
} else {
  console.log("No Flap graduation TXs found in 24h to analyze.");
}

// ============================================
// PART 5: Summary — total graduation rates by platform
// ============================================
console.log("\n=== 24H GRADUATION SUMMARY ===\n");
console.log("Four.Meme tokens → PancakeSwap pairs: ", fourMemePairs.length);
console.log("Flap tokens → PancakeSwap pairs:      ", flapPairs.length);
console.log("Total platform graduations:            ", fourMemePairs.length + flapPairs.length);
console.log("\nUser's matched tokens:");
console.log("  Four.meme matched: ", userTokens.filter(t => t.platform === "Four.meme" && allPlatformPairs.some(p => p.token.endsWith(t.suffix.toLowerCase()))).length, "/", userTokens.filter(t => t.platform === "Four.meme").length);
console.log("  Flap matched:      ", userTokens.filter(t => t.platform === "Flap" && allPlatformPairs.some(p => p.token.endsWith(t.suffix.toLowerCase()))).length, "/", userTokens.filter(t => t.platform === "Flap").length);
