/**
 * Live test: Query Base mainnet RPC for recent token launches from ALL platforms.
 * Verifies event topic hashes are correct and we can decode real data.
 *
 * Usage: npx tsx scripts/test-base-launch-monitor.ts
 */

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// ── Factory addresses ──────────────────────────────────────

const FACTORIES = {
  clanker_v4: '0xE85A59c628F7d27878ACeB4bf3b35733630083a9',
  clanker_v41: '0x9B84fcE5Dcd9a38d2D01d5D72373F6b6b067c3e1',
  clanker_v3: '0x375C15db32D28cEcdcAB5C03Ab889bf15cbD2c5E',
  clanker_v31: '0x2A787b2362021cC3eEa3C24C4748a6cD5B687382',
  zora: '0x777777751622c0d3258f214F9DF38E35BF45baF3',
  flaunch: '0xf785bb58059fab6fb19bdda2cb9078d9e546efdc',
  virtuals: '0xF66DeA7b3e897cD44A5a231c61B6B4423d613259',
};

// ── Compute keccak256 topic hashes ──────────────────────────

async function keccak256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data); // placeholder
  // We need actual keccak256, not SHA-256. Use viem.
  const { keccak256: viemKeccak, toHex, toBytes } = await import('viem');
  return viemKeccak(toHex(toBytes(text)));
}

// ── RPC helper ──────────────────────────────────────────────

async function rpcCall(method: string, params: any[]): Promise<any> {
  const resp = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await resp.json() as any;
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  return data.result;
}

function unpadAddress(topic: string): string {
  return '0x' + topic.slice(26).toLowerCase();
}

function decodeAbiString(dataHex: string, slotIndex: number): string {
  try {
    const pointerHex = dataHex.slice(slotIndex * 64, slotIndex * 64 + 64);
    const pointer = parseInt(pointerHex, 16) * 2;
    const lengthHex = dataHex.slice(pointer, pointer + 64);
    const length = parseInt(lengthHex, 16);
    if (length === 0 || length > 10000) return '';
    const strHex = dataHex.slice(pointer + 64, pointer + 64 + length * 2);
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function decodeAbiAddress(dataHex: string, slotIndex: number): string {
  const raw = dataHex.slice(slotIndex * 64, slotIndex * 64 + 64);
  return '0x' + raw.slice(24).toLowerCase();
}

// ── Main test ──────────────────────────────────────────────

async function main() {
  console.log('=== Base Launch Monitor - Live RPC Test ===\n');
  console.log(`RPC: ${BASE_RPC_URL}\n`);

  // Step 1: Compute topic hashes
  console.log('--- Step 1: Computing event topic hashes ---\n');

  const eventSignatures: Record<string, string> = {
    // Clanker v4 TokenCreated
    'clanker_TokenCreated': 'TokenCreated(address,address,address,string,string,string,string,string,int24,address,bytes32,address,address,address,uint256,address[])',
    // Zora CoinCreatedV4 — PoolKey is (Currency,Currency,uint24,int24,IHooks) but in events it's a tuple
    'zora_CoinCreatedV4': 'CoinCreatedV4(address,address,address,address,string,string,string,address,(address,address,uint24,int24,address),bytes32,string)',
    // Zora CoinCreated (legacy v3)
    'zora_CoinCreated': 'CoinCreated(address,address,address,address,string,string,string,address,address,string)',
    // Zora CreatorCoinCreated
    'zora_CreatorCoinCreated': 'CreatorCoinCreated(address,address,address,address,string,string,string,address,(address,address,uint24,int24,address),bytes32,string)',
    // Flaunch PoolCreated — FlaunchParams is a struct, but let's try the raw signature
    'flaunch_PoolCreated': 'PoolCreated(bytes32,address,address,uint256,bool,uint256,(string,string,string,address,uint256,uint256,address,uint24,uint256,bool))',
    // Virtuals Launched
    'virtuals_Launched': 'Launched(address,address,uint256)',
  };

  const topics: Record<string, string> = {};
  const { keccak256: viemKeccak, toHex, toBytes } = await import('viem');

  for (const [name, sig] of Object.entries(eventSignatures)) {
    const hash = viemKeccak(toHex(toBytes(sig)));
    topics[name] = hash;
    console.log(`  ${name}: ${hash}`);
  }
  console.log('');

  // Step 2: Get current block
  const latestHex = await rpcCall('eth_blockNumber', []);
  const latestBlock = parseInt(latestHex, 16);
  console.log(`--- Step 2: Current block: ${latestBlock} ---\n`);

  // Look back ~30 minutes (~900 blocks at 2s each)
  const lookbackBlocks = 900;
  const fromBlock = latestBlock - lookbackBlocks;
  const fromHex = '0x' + fromBlock.toString(16);
  const toHex2 = '0x' + latestBlock.toString(16);

  console.log(`Scanning blocks ${fromBlock} -> ${latestBlock} (~30 min window)\n`);

  // Step 3: Query each factory
  console.log('--- Step 3: Querying factories ---\n');

  const results: Record<string, any[]> = {};

  for (const [name, address] of Object.entries(FACTORIES)) {
    try {
      const logs = await rpcCall('eth_getLogs', [{
        fromBlock: fromHex,
        toBlock: toHex2,
        address: address,
      }]);
      results[name] = logs || [];
      console.log(`  ${name} (${address.slice(0, 14)}...): ${(logs || []).length} events`);

      // Show topic0 distribution
      if (logs && logs.length > 0) {
        const topicCounts: Record<string, number> = {};
        for (const log of logs) {
          const t0 = log.topics[0] || 'no-topic';
          topicCounts[t0] = (topicCounts[t0] || 0) + 1;
        }
        for (const [t, count] of Object.entries(topicCounts)) {
          // Try to match to known event
          const match = Object.entries(topics).find(([_, hash]) => hash === t);
          const label = match ? match[0] : 'unknown';
          console.log(`    topic0 ${t.slice(0, 18)}... (${label}): ${count} events`);
        }
      }
    } catch (err: any) {
      console.log(`  ${name}: ERROR - ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('');

  // Step 4: Decode sample events from each platform
  console.log('--- Step 4: Decoding sample events ---\n');

  // Clanker
  for (const factoryName of ['clanker_v4', 'clanker_v41', 'clanker_v3', 'clanker_v31']) {
    const logs = results[factoryName] || [];
    const tokenCreatedLogs = logs.filter((l: any) =>
      l.topics[0] === topics['clanker_TokenCreated']
    );
    if (tokenCreatedLogs.length > 0) {
      const log = tokenCreatedLogs[0];
      const d = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
      const tokenAddress = unpadAddress(log.topics[1]);
      const name = decodeAbiString(d, 2);
      const symbol = decodeAbiString(d, 3);
      const image = decodeAbiString(d, 1);
      console.log(`  [${factoryName}] Token: ${symbol} "${name}" at ${tokenAddress}`);
      if (image) console.log(`    Image: ${image.slice(0, 80)}...`);
      console.log(`    TX: ${log.transactionHash}`);
    } else if (logs.length > 0) {
      // Show raw topic0 for debugging
      console.log(`  [${factoryName}] ${logs.length} events but none match expected TokenCreated topic`);
      console.log(`    First event topic0: ${logs[0].topics[0]}`);
    }
  }

  // Zora
  const zoraLogs = results['zora'] || [];
  if (zoraLogs.length > 0) {
    // Try all 3 Zora event topics
    for (const eventName of ['zora_CoinCreatedV4', 'zora_CoinCreated', 'zora_CreatorCoinCreated']) {
      const matched = zoraLogs.filter((l: any) => l.topics[0] === topics[eventName]);
      if (matched.length > 0) {
        console.log(`  [zora/${eventName}] ${matched.length} events found`);
        const log = matched[0];
        console.log(`    TX: ${log.transactionHash}`);
        console.log(`    Topics: ${log.topics.length}, Data length: ${log.data.length}`);
      }
    }
    // Show unmatched topics
    const allZoraTopics = new Set(zoraLogs.map((l: any) => l.topics[0]));
    const knownZora = new Set([topics['zora_CoinCreatedV4'], topics['zora_CoinCreated'], topics['zora_CreatorCoinCreated']]);
    for (const t of allZoraTopics) {
      if (!knownZora.has(t)) {
        const count = zoraLogs.filter((l: any) => l.topics[0] === t).length;
        console.log(`  [zora/UNKNOWN] topic0: ${t} — ${count} events`);
      }
    }
  }

  // Flaunch
  const flaunchLogs = results['flaunch'] || [];
  if (flaunchLogs.length > 0) {
    const matched = flaunchLogs.filter((l: any) => l.topics[0] === topics['flaunch_PoolCreated']);
    console.log(`  [flaunch] ${flaunchLogs.length} total events, ${matched.length} PoolCreated`);
    if (matched.length > 0) {
      console.log(`    First TX: ${matched[0].transactionHash}`);
    }
    // Show unmatched
    const allFlaunchTopics = new Set(flaunchLogs.map((l: any) => l.topics[0]));
    for (const t of allFlaunchTopics) {
      if (t !== topics['flaunch_PoolCreated']) {
        const count = flaunchLogs.filter((l: any) => l.topics[0] === t).length;
        console.log(`    UNKNOWN topic0: ${t.slice(0, 18)}... — ${count} events`);
      }
    }
  }

  // Virtuals
  const virtualsLogs = results['virtuals'] || [];
  if (virtualsLogs.length > 0) {
    const matched = virtualsLogs.filter((l: any) => l.topics[0] === topics['virtuals_Launched']);
    console.log(`  [virtuals] ${virtualsLogs.length} total events, ${matched.length} Launched`);
    if (matched.length > 0) {
      const log = matched[0];
      const tokenAddr = unpadAddress(log.topics[1]);
      console.log(`    Token: ${tokenAddr}, TX: ${log.transactionHash}`);
    }
    // Show unmatched
    const allVirtualsTopics = new Set(virtualsLogs.map((l: any) => l.topics[0]));
    for (const t of allVirtualsTopics) {
      if (t !== topics['virtuals_Launched']) {
        const count = virtualsLogs.filter((l: any) => l.topics[0] === t).length;
        console.log(`    UNKNOWN topic0: ${t.slice(0, 18)}... — ${count} events`);
      }
    }
  }

  console.log('\n=== Test Complete ===');

  // Step 5: Wider lookback if 30min was too short
  const totalEvents = Object.values(results).reduce((sum, logs) => sum + (logs?.length || 0), 0);
  if (totalEvents === 0) {
    console.log('\nNo events in 30min window. Trying 6-hour lookback...\n');

    const widerFrom = latestBlock - 10800; // ~6 hours
    const widerFromHex = '0x' + widerFrom.toString(16);

    for (const [name, address] of Object.entries(FACTORIES)) {
      try {
        const logs = await rpcCall('eth_getLogs', [{
          fromBlock: widerFromHex,
          toBlock: toHex2,
          address: address,
        }]);
        if (logs && logs.length > 0) {
          console.log(`  ${name}: ${logs.length} events in last 6h`);
          // Show first event details
          const first = logs[0];
          console.log(`    First: block ${parseInt(first.blockNumber, 16)}, topic0: ${first.topics[0].slice(0, 18)}...`);
          console.log(`    TX: ${first.transactionHash}`);
        } else {
          console.log(`  ${name}: 0 events in last 6h`);
        }
      } catch (err: any) {
        console.log(`  ${name}: ERROR - ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

main().catch(console.error);
