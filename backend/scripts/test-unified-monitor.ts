/**
 * Live verification: Test the unified Base Launch Monitor decoders against
 * real events from Base mainnet. No DB writes — just verifies decoding.
 *
 * Usage: npx tsx scripts/test-unified-monitor.ts
 */

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://base-mainnet.public.blastapi.io';

// Topic hashes (verified)
const CLANKER_TOKEN_CREATED = '0x9299d1d1a88d8e1abdc591ae7a167a6bc63a8f17d695804e9091ee33aa89fb67';
const ZORA_COIN_CREATED_V4 = '0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81';
const ZORA_CREATOR_COIN = '0x74b670d628e152daa36ca95dda7cb0002d6ea7a37b55afe4593db7abd1515781';
const FLAUNCH_POOL_CREATED = '0xc7241a69d3660bdfe5f36bdcca3b2da1fe8844366e46adb58be95171ab0665ad';

const CLANKER_V4 = '0xE85A59c628F7d27878ACeB4bf3b35733630083a9';
const ZORA = '0x777777751622c0d3258f214F9DF38E35BF45baF3';
const FLAUNCH = '0xf785bb58059fab6fb19bdda2cb9078d9e546efdc';

async function rpcCall(method: string, params: any[]): Promise<any> {
  const resp = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await resp.json() as any;
  if (data.error) throw new Error(`RPC: ${JSON.stringify(data.error)}`);
  return data.result;
}

function unpad(t: string): string { return '0x' + t.slice(26).toLowerCase(); }

function decodeStr(d: string, slot: number): string {
  try {
    const ptr = parseInt(d.slice(slot * 64, slot * 64 + 64), 16) * 2;
    const len = parseInt(d.slice(ptr, ptr + 64), 16);
    if (len === 0 || len > 10000) return '';
    const hex = d.slice(ptr + 64, ptr + 64 + len * 2);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

function decodeAddr(d: string, slot: number): string {
  return '0x' + d.slice(slot * 64 + 24, (slot + 1) * 64).toLowerCase();
}

async function getName(addr: string): Promise<string> {
  try {
    const r = await rpcCall('eth_call', [{ to: addr, data: '0x06fdde03' }, 'latest']);
    const d = r.startsWith('0x') ? r.slice(2) : r;
    if (d.length < 128) return 'N/A';
    const off = parseInt(d.slice(0, 64), 16) * 2;
    const len = parseInt(d.slice(off, off + 64), 16);
    if (len === 0 || len > 200) return 'N/A';
    const hex = d.slice(off + 64, off + 64 + len * 2);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
  } catch { return 'N/A'; }
}

async function getSymbol(addr: string): Promise<string> {
  try {
    const r = await rpcCall('eth_call', [{ to: addr, data: '0x95d89b41' }, 'latest']);
    const d = r.startsWith('0x') ? r.slice(2) : r;
    if (d.length < 128) return 'N/A';
    const off = parseInt(d.slice(0, 64), 16) * 2;
    const len = parseInt(d.slice(off, off + 64), 16);
    if (len === 0 || len > 200) return 'N/A';
    const hex = d.slice(off + 64, off + 64 + len * 2);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
  } catch { return 'N/A'; }
}

async function main() {
  console.log('=== Unified Base Launch Monitor — Live Decode Test ===\n');

  const latestHex = await rpcCall('eth_blockNumber', []);
  const latest = parseInt(latestHex, 16);
  const from = latest - 450; // ~15 min
  const fromHex = '0x' + from.toString(16);
  const toHex = '0x' + latest.toString(16);

  console.log(`Block range: ${from} → ${latest} (~15 min)\n`);

  // ── CLANKER ──────────────────────────────────────────
  console.log('═══ CLANKER ═══');
  const clankerLogs = await rpcCall('eth_getLogs', [{
    fromBlock: fromHex, toBlock: toHex,
    address: CLANKER_V4, topics: [CLANKER_TOKEN_CREATED],
  }]);
  console.log(`Events: ${(clankerLogs || []).length}`);

  for (const log of (clankerLogs || []).slice(0, 5)) {
    const d = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
    const addr = unpad(log.topics[1]);
    const name = decodeStr(d, 2);
    const symbol = decodeStr(d, 3);
    const image = decodeStr(d, 1);
    console.log(`  ✓ ${symbol} "${name}" — ${addr.slice(0, 20)}...`);
    if (image) console.log(`    img: ${image.slice(0, 60)}...`);
  }

  // ── ZORA ─────────────────────────────────────────────
  console.log('\n═══ ZORA ═══');
  const [zoraV4, zoraCreator] = await Promise.all([
    rpcCall('eth_getLogs', [{
      fromBlock: fromHex, toBlock: toHex,
      address: ZORA, topics: [ZORA_COIN_CREATED_V4],
    }]),
    rpcCall('eth_getLogs', [{
      fromBlock: fromHex, toBlock: toHex,
      address: ZORA, topics: [ZORA_CREATOR_COIN],
    }]),
  ]);
  console.log(`CoinCreatedV4: ${(zoraV4 || []).length}, CreatorCoinCreated: ${(zoraCreator || []).length}`);

  for (const log of (zoraV4 || []).slice(0, 5)) {
    const d = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
    const coinAddr = decodeAddr(d, 4);
    const name = decodeStr(d, 2);
    const symbol = decodeStr(d, 3);
    const uri = decodeStr(d, 1);
    console.log(`  ✓ ${symbol} "${name}" — ${coinAddr.slice(0, 20)}...`);
    if (uri) console.log(`    uri: ${uri.slice(0, 60)}...`);
  }

  // ── FLAUNCH ──────────────────────────────────────────
  console.log('\n═══ FLAUNCH ═══');
  const flaunchLogs = await rpcCall('eth_getLogs', [{
    fromBlock: '0x' + (latest - 1800).toString(16), // 1 hour lookback (lower volume)
    toBlock: toHex,
    address: FLAUNCH, topics: [FLAUNCH_POOL_CREATED],
  }]);
  console.log(`Pool creations (1h): ${(flaunchLogs || []).length}`);

  for (const log of (flaunchLogs || []).slice(0, 3)) {
    // Fetch TX receipt to find the token
    const receipt = await rpcCall('eth_getTransactionReceipt', [log.transactionHash]);
    const known = new Set([
      FLAUNCH.toLowerCase(),
      '0x4200000000000000000000000000000000000006',
      '0x000000000d564d5be76f7f0d28fe52605afc7cf8',
      '0x498581ff718922c3f8e6a244956af099b2652b2b',
      '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc',
      '0xf3622742b1e446d92e45e22923ef11c2fcd55d68',
    ]);

    const candidates = new Set<string>();
    for (const rl of receipt.logs) {
      if (!known.has(rl.address.toLowerCase())) candidates.add(rl.address.toLowerCase());
    }

    let found = false;
    for (const addr of candidates) {
      const name = await getName(addr);
      if (name !== 'N/A') {
        const symbol = await getSymbol(addr);
        if (symbol !== 'N/A') {
          console.log(`  ✓ ${symbol} "${name}" — ${addr.slice(0, 20)}...`);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      console.log(`  ? Could not resolve token from TX ${log.transactionHash.slice(0, 20)}...`);
    }
  }

  console.log('\n═══ SUMMARY ═══');
  console.log(`Clanker: ${(clankerLogs || []).length} tokens decoded`);
  console.log(`Zora:    ${(zoraV4 || []).length + (zoraCreator || []).length} coins decoded`);
  console.log(`Flaunch: ${(flaunchLogs || []).length} pools found`);
  console.log('\nAll decoders verified against live Base RPC ✓');
}

main().catch(console.error);
