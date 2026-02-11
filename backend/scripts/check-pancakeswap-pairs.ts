/**
 * Cross-reference PancakeSwap V2 PairCreated events with Four.Meme factory
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

const PAIR_CREATED = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const FOUR_MEME = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

const latestHex = await rpc("eth_blockNumber", []);
const latest = parseInt(latestHex, 16);
const from = latest - 9600; // ~8h

const logs = await rpc("eth_getLogs", [{
  address: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
  topics: [[PAIR_CREATED]],
  fromBlock: "0x" + from.toString(16),
  toBlock: "0x" + latest.toString(16),
}]);

console.log("PancakeSwap V2 PairCreated in last 8h:", logs.length);
console.log();

// Check which transactions were sent to Four.Meme
let fourMemeCount = 0;
let otherContracts: Record<string, number> = {};
const seen = new Set<string>();

for (const log of logs.slice(0, 50)) {
  if (seen.has(log.transactionHash)) continue;
  seen.add(log.transactionHash);

  const tx = await rpc("eth_getTransactionByHash", [log.transactionHash]);
  const to = (tx.to || "").toLowerCase();

  if (to === FOUR_MEME) {
    fourMemeCount++;
    const token0 = "0x" + log.topics[1].slice(26);
    const token1 = "0x" + log.topics[2].slice(26);
    const tokenAddr = token0.toLowerCase() === WBNB ? token1 : token0;
    console.log("[FOUR.MEME] Token:", tokenAddr.slice(0, 14) + "... | TX:", log.transactionHash.slice(0, 20) + "...");
  } else {
    otherContracts[to] = (otherContracts[to] || 0) + 1;
  }
}

console.log();
console.log("=== RESULTS (first 50 pairs) ===");
console.log("Four.Meme triggered:", fourMemeCount);
console.log("Other contracts:");
const sorted = Object.entries(otherContracts).sort((a, b) => b[1] - a[1]);
for (const [addr, count] of sorted.slice(0, 10)) {
  console.log("  " + addr.slice(0, 14) + "... → " + count + " pairs");
}
