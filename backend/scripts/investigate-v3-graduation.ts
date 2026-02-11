/**
 * Investigate PancakeSwap V3 graduation path for Four.Meme tokens
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

// Helper: query logs in chunks of 5000 blocks to avoid RPC limits
async function getLogsChunked(address: string, topics: any[], fromBlock: number, toBlock: number): Promise<any[]> {
  const CHUNK = 5000;
  const allLogs: any[] = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, toBlock);
    const logs = await rpc("eth_getLogs", [{
      address,
      topics,
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
    }]);
    allLogs.push(...logs);
  }
  return allLogs;
}

const V2_FACTORY = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";
const PANCAKE_V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const V3_POOL_CREATED = "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118";
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
const USDT = "0x55d398326f99059ff775485246999027b3197955";

const latestHex = await rpc("eth_blockNumber", []);
const latest = parseInt(latestHex, 16);
const from24h = latest - 28800;
const from48h = latest - 28800; // Use 24h to stay within RPC limits; chunk for larger

console.log(`Latest block: ${latest}`);
console.log(`24h ago block: ${from24h}`);

// ============================================
// PART 1: Check PancakeSwap V3 PoolCreated events (24h)
// ============================================
console.log("\n=== PANCAKESWAP V3 POOL CREATED (24h) ===\n");

try {
  const v3Logs = await getLogsChunked(PANCAKE_V3_FACTORY, [[V3_POOL_CREATED]], from24h, latest);
  
  console.log("V3 PoolCreated events in 24h:", v3Logs.length);
  
  // Check which ones involve tokens ending in 4444 or ffff (Four.Meme tokens)
  let fourMemeV3 = 0;
  const allV3Tokens: {token0: string, token1: string, block: number, pool: string}[] = [];
  for (const log of v3Logs) {
    const token0 = ("0x" + log.topics[1].slice(26)).toLowerCase();
    const token1 = ("0x" + log.topics[2].slice(26)).toLowerCase();
    const fee = parseInt(log.topics[3], 16);
    // Pool address is in data
    const pool = ("0x" + log.data.slice(26, 66)).toLowerCase();
    
    allV3Tokens.push({token0, token1, block: parseInt(log.blockNumber, 16), pool});
    
    if (token0.endsWith("4444") || token0.endsWith("ffff") || 
        token1.endsWith("4444") || token1.endsWith("ffff")) {
      fourMemeV3++;
      const memeToken = (token0.endsWith("4444") || token0.endsWith("ffff")) ? token0 : token1;
      const quoteToken = memeToken === token0 ? token1 : token0;
      
      let quoteLabel = quoteToken.slice(0, 14) + "...";
      if (quoteToken === WBNB) quoteLabel = "WBNB";
      if (quoteToken === USDT) quoteLabel = "USDT";
      
      console.log(`  Four.Meme token: ${memeToken} | Quote: ${quoteLabel} | Fee: ${fee} | Block: ${parseInt(log.blockNumber, 16)} | Pool: ${pool}`);
    }
  }
  console.log(`\nFour.Meme tokens in V3: ${fourMemeV3} out of ${v3Logs.length} total V3 pools`);
  
  // Show ALL V3 pools for context
  if (v3Logs.length <= 20) {
    console.log("\nAll V3 pools created in 24h:");
    for (const p of allV3Tokens) {
      let t0Label = p.token0.slice(0, 14) + "...";
      let t1Label = p.token1.slice(0, 14) + "...";
      if (p.token0 === WBNB) t0Label = "WBNB";
      if (p.token1 === WBNB) t1Label = "WBNB";
      if (p.token0 === USDT) t0Label = "USDT";
      if (p.token1 === USDT) t1Label = "USDT";
      console.log(`  ${t0Label} / ${t1Label} | Block: ${p.block} | Pool: ${p.pool}`);
    }
  }
} catch (e: any) {
  console.log("V3 query error:", e.message?.slice(0, 200));
}

// ============================================
// PART 2: Investigate KNOWN graduated tokens' transactions
// ============================================
console.log("\n=== KNOWN GRADUATION TX ANALYSIS ===\n");

const LIQUIDITY_ADDED = "0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0";
const liqLogs = await getLogsChunked(V2_FACTORY, [[LIQUIDITY_ADDED]], from24h, latest);

console.log("LiquidityAdded events in 24h:", liqLogs.length);

for (const log of liqLogs.slice(0, 5)) {
  console.log(`\n--- Graduation TX: ${log.transactionHash} ---`);
  
  const tx = await rpc("eth_getTransactionByHash", [log.transactionHash]);
  console.log("  TX to:", tx.to);
  console.log("  TX from:", tx.from);
  console.log("  Value:", (Number(BigInt(tx.value)) / 1e18).toFixed(4), "BNB");
  
  const receipt = await rpc("eth_getTransactionReceipt", [log.transactionHash]);
  console.log("  Total events in tx:", receipt.logs.length);
  
  // Categorize events by contract
  const contracts: Record<string, string[]> = {};
  for (const l of receipt.logs) {
    const addr = l.address.toLowerCase();
    if (!contracts[addr]) contracts[addr] = [];
    contracts[addr].push(l.topics[0]);
  }
  
  console.log("  Contracts involved:");
  for (const [addr, topics] of Object.entries(contracts)) {
    let label = addr;
    if (addr === V2_FACTORY) label += " [FOUR.MEME]";
    if (addr === WBNB) label += " [WBNB]";
    if (addr === PANCAKE_V3_FACTORY.toLowerCase()) label += " [PCS V3 FACTORY]";
    if (addr === "0xca143ce32fe78f1f7019d7d551a6402fc5350c73") label += " [PCS V2 FACTORY]";
    if (addr === "0x10ed43c718714eb63d5aa57b78b54c9502d2c5d4") label += " [PCS V2 ROUTER]";
    if (addr === "0x13f4ea83d0bd40e75c8222255bc855a974568dd4") label += " [PCS V3 ROUTER]";
    if (addr === "0x1b81d678ffb9c0263b24a97847620c99d213eb14") label += " [PCS POSITION MGR]";
    if (addr === "0x46a15b0b27311cedf172ab29e4f4766fbe7f4364") label += " [PCS V3 NFT POS MGR]";
    console.log(`    ${label}: ${topics.length} events`);
  }
  
  // Check for key events
  const hasPairCreated = receipt.logs.some((l: any) => 
    l.topics[0] === "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9"
  );
  const hasPoolCreated = receipt.logs.some((l: any) => 
    l.topics[0] === V3_POOL_CREATED
  );
  const hasMintV3 = receipt.logs.some((l: any) => 
    l.topics[0] === "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde"
  );
  console.log("  Has PancakeSwap V2 PairCreated:", hasPairCreated);
  console.log("  Has PancakeSwap V3 PoolCreated:", hasPoolCreated);
  console.log("  Has V3 Mint:", hasMintV3);
  
  // Extract the token that graduated
  const d = log.data.slice(2);
  const tokenAddr = "0x" + d.slice(24, 64);
  console.log("  Graduated token:", tokenAddr);
}

// ============================================
// PART 3: Graduated token addresses
// ============================================
console.log("\n=== GRADUATED TOKENS ===\n");

const graduatedTokens = new Set<string>();
for (const log of liqLogs) {
  const d = log.data.slice(2);
  const tokenAddr = ("0x" + d.slice(24, 64)).toLowerCase();
  graduatedTokens.add(tokenAddr);
}

console.log("Tokens with LiquidityAdded:", graduatedTokens.size);
for (const t of graduatedTokens) {
  console.log("  " + t);
}

// ============================================
// PART 4: Full event breakdown of first graduation tx
// ============================================
console.log("\n=== FULL EVENT BREAKDOWN (FIRST GRADUATION TX) ===\n");

if (liqLogs.length > 0) {
  const receipt = await rpc("eth_getTransactionReceipt", [liqLogs[0].transactionHash]);
  
  console.log(`TX: ${liqLogs[0].transactionHash}`);
  console.log(`Total events: ${receipt.logs.length}\n`);
  
  for (let i = 0; i < receipt.logs.length; i++) {
    const l = receipt.logs[i];
    let contractLabel = l.address.toLowerCase();
    
    // Known contracts
    const known: Record<string, string> = {
      [V2_FACTORY]: "FOUR.MEME",
      [WBNB]: "WBNB",
      [PANCAKE_V3_FACTORY.toLowerCase()]: "PCS_V3_FACTORY",
      "0xca143ce32fe78f1f7019d7d551a6402fc5350c73": "PCS_V2_FACTORY",
      "0x10ed43c718714eb63d5aa57b78b54c9502d2c5d4": "PCS_V2_ROUTER",
      "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": "PCS_V3_ROUTER",
      "0x1b81d678ffb9c0263b24a97847620c99d213eb14": "PCS_POS_MGR",
      "0x46a15b0b27311cedf172ab29e4f4766fbe7f4364": "PCS_V3_NFT_POS",
    };
    
    if (known[l.address.toLowerCase()]) {
      contractLabel = known[l.address.toLowerCase()];
    }
    
    // Known event topics
    const knownTopics: Record<string, string> = {
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Transfer",
      "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9": "PairCreated",
      "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118": "PoolCreated(V3)",
      "0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0": "LiquidityAdded",
      "0x8f9ab4bd7eff0d085f91575d50cd83f97aa5258e24ded7630d4fd6739e857132": "UNKNOWN_GRAD_EVENT",
      "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f": "Mint(V2_LP)",
      "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1": "Sync(V2)",
      "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c": "Deposit(WBNB)",
      "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822": "Swap(V2)",
      "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde": "Mint(V3)",
      "0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c": "Initialize(V3)",
      "0x98636036cb66a9c19a37435efc1e90142190214e8abeb821bdba3f2990dd4c95": "IncreaseLiquidity",
      "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": "Approval",
    };
    
    const topicName = knownTopics[l.topics[0]] || l.topics[0].slice(0, 18) + "...";
    
    // Extra details for transfers
    let extra = "";
    if (l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
      const from = "0x" + (l.topics[1]?.slice(26) || "???");
      const to = "0x" + (l.topics[2]?.slice(26) || "???");
      const val = BigInt(l.data);
      extra = ` from=${from.slice(0,10)}... to=${to.slice(0,10)}... val=${val}`;
    }
    
    console.log(`  [${String(i).padStart(2)}] ${contractLabel.padEnd(22)} | ${topicName}${extra}`);
  }
}

// ============================================
// PART 5: Mystery event analysis
// ============================================
console.log("\n=== MYSTERY EVENT 0x8f9ab4bd... ===\n");

const MYSTERY = "0x8f9ab4bd7eff0d085f91575d50cd83f97aa5258e24ded7630d4fd6739e857132";
const mysteryLogs = await getLogsChunked(V2_FACTORY, [[MYSTERY]], from24h, latest);

console.log("Mystery events in 24h:", mysteryLogs.length);
for (const log of mysteryLogs) {
  const d = log.data.slice(2);
  console.log(`  Block ${parseInt(log.blockNumber, 16)} | TX: ${log.transactionHash.slice(0, 22)}...`);
  console.log(`    Data (first 256 chars): ${d.slice(0, 256)}`);
  const tokenAddr = "0x" + d.slice(24, 64);
  console.log(`    Token: ${tokenAddr}`);
  console.log(`    Same TX as LiquidityAdded: ${liqLogs.some((l: any) => l.transactionHash === log.transactionHash)}`);
}

// ============================================
// PART 6: Check mysterious pair creators
// ============================================
console.log("\n=== MYSTERIOUS PAIR CREATORS ===\n");

const MYSTERIOUS_1 = "0x10ed43c71871f8ac529d6f1f4a7b0e987d0a64c7";
const MYSTERIOUS_2 = "0xc9b7cc619200416d66fa464f4d800ca4e46ee047";

// Check if these are PancakeSwap V3 related contracts
for (const addr of [MYSTERIOUS_1, MYSTERIOUS_2]) {
  console.log(`\nChecking ${addr}:`);
  const code = await rpc("eth_getCode", [addr, "latest"]);
  console.log(`  Has code: ${code !== "0x"}`);
  console.log(`  Code size: ${(code.length - 2) / 2} bytes`);
  
  // Check if it's a known PCS contract
  if (addr.toLowerCase() === "0x10ed43c718714eb63d5aa57b78b54c9502d2c5d4".toLowerCase()) {
    console.log("  >>> This is PancakeSwap V2 Router!");
  }
}

// ============================================
// PART 7: Check DexScreener for graduated tokens
// ============================================
console.log("\n=== DEXSCREENER CHECK FOR GRADUATED TOKENS ===\n");

for (const token of [...graduatedTokens].slice(0, 3)) {
  try {
    const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
    const data = await resp.json() as any;
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      console.log(`Token: ${token}`);
      console.log(`  DEX: ${pair.dexId}`);
      console.log(`  Pair: ${pair.pairAddress}`);
      console.log(`  Base: ${pair.baseToken?.symbol} | Quote: ${pair.quoteToken?.symbol}`);
      console.log(`  Price USD: ${pair.priceUsd}`);
      console.log(`  Liquidity: $${pair.liquidity?.usd}`);
      console.log(`  Labels: ${JSON.stringify(pair.labels || [])}`);
      console.log(`  All pairs for this token: ${data.pairs.length}`);
      for (const p of data.pairs.slice(0, 5)) {
        console.log(`    - ${p.dexId} | ${p.baseToken?.symbol}/${p.quoteToken?.symbol} | liq=$${p.liquidity?.usd}`);
      }
    } else {
      console.log(`Token: ${token} - NO pairs on DexScreener`);
    }
  } catch (e: any) {
    console.log(`Token: ${token} - DexScreener error: ${e.message}`);
  }
  console.log();
}

console.log("\n=== INVESTIGATION COMPLETE ===\n");
