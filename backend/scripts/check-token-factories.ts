/**
 * Check which factory created specific tokens from the user's screener data
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

// Tokens from the user's screener data
const tokens = [
  // Four.meme tokens ending in 4444
  { name: "团圆令", addr: "0x6a9c", suffix: "044444", platform: "Four.meme" },
  { name: "团圆令", addr: "0x734a", suffix: "6f4444", platform: "Four.meme" },
  { name: "团圆令", addr: "0x302f", suffix: "1d4444", platform: "Four.meme" },
  { name: "在吉尔吉斯斯坦骑马", addr: "0xf28c", suffix: "594444", platform: "Four.meme" },
  { name: "中文狗", addr: "0xa5cb", suffix: "df4444", platform: "Four.meme" },
  { name: "长鹏策马踏平川", addr: "0x97f8", suffix: "384444", platform: "Four.meme" },
  { name: "meme", addr: "0x568f", suffix: "7d4444", platform: "Four.meme" },
  // Four.meme tokens ending in ffff
  { name: "YDDM", addr: "0x69cf", suffix: "d9ffff", platform: "Four.meme" },
  { name: "DINO", addr: "0x6614", suffix: "14ffff", platform: "Four.meme" },
  // Flap tokens ending in 7777
  { name: "MARA", addr: "0xb8f5", suffix: "ae7777", platform: "Flap" },
  { name: "KAAL", addr: "0x0f4a", suffix: "157777", platform: "Flap" },
  { name: "过年好", addr: "0x893b", suffix: "ea7777", platform: "Flap" },
  { name: "VIDAI", addr: "0x964c", suffix: "0c7777", platform: "Flap" },
];

const V1_FACTORY = "0xec4549cadce5da21df6e6422d448034b5233bfbc";
const V2_FACTORY = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";
const TOKEN_CREATE = "0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20";

const latestHex = await rpc("eth_blockNumber", []);
const latest = parseInt(latestHex, 16);

// For the recent tokens (seconds/minutes old), check their creation tx
// We can find them by looking for TokenCreate events that contain their address
console.log("=== CHECKING FACTORY FOR RECENT FOUR.MEME TOKENS ===\n");

// Search recent blocks for the 团圆令 tokens (just created seconds ago)
const recentLogs = await rpc("eth_getLogs", [{
  address: V2_FACTORY,
  topics: [[TOKEN_CREATE]],
  fromBlock: "0x" + (latest - 100).toString(16), // last ~5 min
  toBlock: "0x" + latest.toString(16),
}]);
console.log("V2 factory TokenCreate events in last 5 min:", recentLogs.length);

// Check if the 团圆令 tokens are in there
for (const log of recentLogs) {
  const d = log.data.slice(2);
  const tokenAddr = "0x" + d.slice(24 + 64, 64 + 64);
  console.log("  Created:", tokenAddr);
}

// Now check: what factory created the ffff tokens?
// Get creation tx for YDDM (0x69cf...d9ffff) by checking its first internal tx
console.log("\n=== CHECKING ffff TOKEN ORIGINS ===\n");

// Check if ffff tokens were created by V2 factory
const from24h = latest - 28800;
const v2Creates24h = await rpc("eth_getLogs", [{
  address: V2_FACTORY,
  topics: [[TOKEN_CREATE]],
  fromBlock: "0x" + from24h.toString(16),
  toBlock: "0x" + latest.toString(16),
}]);

let foundFfff = 0;
let found4444 = 0;
for (const log of v2Creates24h) {
  const d = log.data.slice(2);
  const tokenAddr = ("0x" + d.slice(24 + 64, 64 + 64)).toLowerCase();
  if (tokenAddr.endsWith("ffff")) foundFfff++;
  if (tokenAddr.endsWith("4444")) found4444++;
}
console.log("V2 factory tokens ending in 4444:", found4444);
console.log("V2 factory tokens ending in ffff:", foundFfff);
console.log("Total V2 creates in 24h:", v2Creates24h.length);

// Now search for Flap — check what created the 7777 tokens
console.log("\n=== SEARCHING FOR FLAP FACTORY ===\n");

// Get the creation tx for a Flap token by checking the nonce/code deployment
// Use eth_getTransactionByHash on a known Flap graduation tx
// First, find a PairCreated for a 7777 token
const PAIR_CREATED = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const pairLogs = await rpc("eth_getLogs", [{
  address: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
  topics: [[PAIR_CREATED]],
  fromBlock: "0x" + from24h.toString(16),
  toBlock: "0x" + latest.toString(16),
}]);

for (const log of pairLogs) {
  const token0 = "0x" + log.topics[1].slice(26);
  const token1 = "0x" + log.topics[2].slice(26);
  const tokenAddr = token0.toLowerCase() === "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" ? token1 : token0;

  if (tokenAddr.toLowerCase().endsWith("7777")) {
    // Found a Flap token graduation! Check what contract triggered it
    const tx = await rpc("eth_getTransactionByHash", [log.transactionHash]);
    console.log("Flap graduation found!");
    console.log("  Token:", tokenAddr);
    console.log("  TX to (factory?):", tx.to);
    console.log("  TX hash:", log.transactionHash.slice(0, 20) + "...");
    break; // just need one
  }

  if (tokenAddr.toLowerCase().endsWith("ffff")) {
    const tx = await rpc("eth_getTransactionByHash", [log.transactionHash]);
    console.log("ffff token graduation found!");
    console.log("  Token:", tokenAddr);
    console.log("  TX to (factory?):", tx.to);
    console.log("  TX hash:", log.transactionHash.slice(0, 20) + "...");
  }
}
