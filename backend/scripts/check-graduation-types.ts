/**
 * Check ALL graduation-related events from Four.Meme V2 factory
 * Looking for different pair types (BNB, USDT, USD1)
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

const V2 = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";
const LIQUIDITY_ADDED = "0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0";

// The unknown topic with same count as LiquidityAdded (3)
const UNKNOWN_3 = "0x8f9ab4bd7eff0d085f91575d50cd83f97aa5258e24ded7630d4fd6739e857132";

// The two unknown topics with ~6500 count each
const UNKNOWN_6500_A = "0x0a5575b3648bae2210cee56bf33254cc1ddfbc7bf637c0af2ac18b14fb1bae19";
const UNKNOWN_6500_B = "0x741ffc4605df23259462547defeab4f6e755bdc5fbb6d0820727d6d3400c7e0d";

const latestHex = await rpc("eth_blockNumber", []);
const latest = parseInt(latestHex, 16);
const from24h = latest - 28800;

// Check ALL events from V2 factory in last 24h
const allLogs = await rpc("eth_getLogs", [{
  address: V2,
  fromBlock: "0x" + from24h.toString(16),
  toBlock: "0x" + latest.toString(16),
}]);

console.log("Total V2 factory events in 24h:", allLogs.length);

const topics: Record<string, number> = {};
for (const l of allLogs) {
  topics[l.topics[0]] = (topics[l.topics[0]] || 0) + 1;
}

console.log("\nEvent breakdown:");
for (const [t, c] of Object.entries(topics).sort((a, b) => b[1] - a[1])) {
  console.log("  " + t + " → " + c);
}

// Now decode ALL LiquidityAdded events
console.log("\n=== ALL LiquidityAdded EVENTS (24h) ===");
const liqLogs = allLogs.filter((l: any) => l.topics[0] === LIQUIDITY_ADDED);
console.log("Count:", liqLogs.length);

for (const log of liqLogs) {
  const d = log.data.slice(2);
  const base = "0x" + d.slice(24, 64);     // token address
  const offers = BigInt("0x" + d.slice(64, 128));
  const quote = "0x" + d.slice(152, 192);   // quote token (WBNB, USDT, USD1?)
  const funds = BigInt("0x" + d.slice(192, 256));
  const block = parseInt(log.blockNumber, 16);

  const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
  const USDT = "0x55d398326f99059ff775485246999027b3197955";

  let quoteLabel = "UNKNOWN";
  if (quote.toLowerCase() === WBNB.toLowerCase()) quoteLabel = "WBNB";
  else if (quote.toLowerCase() === USDT.toLowerCase()) quoteLabel = "USDT";
  else quoteLabel = quote.slice(0, 14) + "...";

  console.log(`  Block ${block} | Token: ${base.slice(0, 14)}... | Quote: ${quoteLabel} | Funds: ${(Number(funds) / 1e18).toFixed(2)} | TX: ${log.transactionHash.slice(0, 20)}...`);
}

// Check the UNKNOWN_3 topic — might be another graduation event type
console.log("\n=== UNKNOWN TOPIC (same count as LiquidityAdded) ===");
const unk3Logs = allLogs.filter((l: any) => l.topics[0] === UNKNOWN_3);
console.log("Topic:", UNKNOWN_3);
console.log("Count:", unk3Logs.length);

for (const log of unk3Logs) {
  const d = log.data.slice(2);
  console.log("  Data length:", d.length / 2, "bytes (" + d.length / 64 + " slots)");
  console.log("  Block:", parseInt(log.blockNumber, 16));
  console.log("  TX:", log.transactionHash.slice(0, 20) + "...");
  // Decode first few slots
  if (d.length >= 64) console.log("  Slot 0 (addr?):", "0x" + d.slice(24, 64));
  if (d.length >= 128) console.log("  Slot 1:", BigInt("0x" + d.slice(64, 128)).toString());
  if (d.length >= 192) console.log("  Slot 2 (addr?):", "0x" + d.slice(152, 192));
  if (d.length >= 256) console.log("  Slot 3:", BigInt("0x" + d.slice(192, 256)).toString());
}

// Also check UNKNOWN_6500_A — these might be buy/sell-related
console.log("\n=== UNKNOWN HIGH-COUNT TOPICS ===");
const unkALogs = allLogs.filter((l: any) => l.topics[0] === UNKNOWN_6500_A);
console.log("Topic A:", UNKNOWN_6500_A.slice(0, 18) + "...");
console.log("Count:", unkALogs.length);
if (unkALogs.length > 0) {
  const sample = unkALogs[0];
  const d = sample.data.slice(2);
  console.log("  Sample data length:", d.length / 2, "bytes");
  if (d.length >= 64) console.log("  Slot 0:", "0x" + d.slice(24, 64));
  if (d.length >= 128) console.log("  Slot 1:", BigInt("0x" + d.slice(64, 128)).toString());
}

const unkBLogs = allLogs.filter((l: any) => l.topics[0] === UNKNOWN_6500_B);
console.log("\nTopic B:", UNKNOWN_6500_B.slice(0, 18) + "...");
console.log("Count:", unkBLogs.length);
if (unkBLogs.length > 0) {
  const sample = unkBLogs[0];
  const d = sample.data.slice(2);
  console.log("  Sample data length:", d.length / 2, "bytes");
  if (d.length >= 64) console.log("  Slot 0:", "0x" + d.slice(24, 64));
  if (d.length >= 128) console.log("  Slot 1:", BigInt("0x" + d.slice(64, 128)).toString());
}

// Check: how many tokens from user's list are in the LiquidityAdded events?
const userTokens = [
  "0xf28c", // 在吉尔吉斯斯坦骑马 ...594444
  "0xa5cb", // 中文狗 ...df4444
  "0x97f8", // 长鹏策马踏平川 ...384444
  "0x568f", // meme ...7d4444
  "0x69cf", // YDDM ...d9ffff
  "0x6614", // DINO ...14ffff
];

console.log("\n=== CHECKING USER'S TOKENS IN FACTORY EVENTS ===");
for (const prefix of userTokens) {
  let found = false;
  for (const log of allLogs) {
    if (log.data.toLowerCase().includes(prefix.slice(2).toLowerCase())) {
      const topic = log.topics[0];
      let topicName = "unknown";
      if (topic === LIQUIDITY_ADDED) topicName = "LiquidityAdded";
      else if (topic === UNKNOWN_3) topicName = "UNKNOWN_3";
      else if (topic === "0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20") topicName = "TokenCreate";
      console.log("  " + prefix + "... found in " + topicName + " event at block " + parseInt(log.blockNumber, 16));
      found = true;
    }
  }
  if (!found) {
    console.log("  " + prefix + "... NOT FOUND in any V2 factory event");
  }
}
