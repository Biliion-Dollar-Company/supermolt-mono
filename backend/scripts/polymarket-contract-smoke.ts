/**
 * Polymarket API contract smoke test.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:3001 bun run scripts/polymarket-contract-smoke.ts
 *   API_BASE_URL=https://sr-mobile-production.up.railway.app bun run scripts/polymarket-contract-smoke.ts
 *
 * Optional authenticated signal post:
 *   AGENT_BEARER_TOKEN=<jwt> API_BASE_URL=... bun run scripts/polymarket-contract-smoke.ts
 */

type Json = Record<string, unknown>;

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const AGENT_BEARER_TOKEN = process.env.AGENT_BEARER_TOKEN;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function getJson(path: string, headers: Record<string, string> = {}): Promise<Json> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  const text = await res.text();
  let data: Json = {};

  try {
    data = JSON.parse(text) as Json;
  } catch {
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 200)}`);
  }

  assert(res.ok, `${path} failed: HTTP ${res.status}`);
  return data;
}

async function postJson(path: string, body: Json, headers: Record<string, string> = {}): Promise<Json> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Json = {};
  try {
    data = JSON.parse(text) as Json;
  } catch {
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 200)}`);
  }

  assert(res.ok, `${path} failed: HTTP ${res.status}`);
  return data;
}

async function main() {
  console.log(`\n[Smoke] API base: ${API_BASE_URL}`);

  const markets = await getJson('/api/polymarket/markets?limit=3');
  assert(markets.success === true, 'markets.success must be true');
  assert(Array.isArray(markets.data), 'markets.data must be an array');
  console.log(`[Smoke] GET /api/polymarket/markets -> ok (${(markets.data as unknown[]).length} markets)`);

  const syncStatus = await getJson('/api/polymarket/sync/status');
  assert(syncStatus.success === true, 'sync.status success must be true');
  assert(typeof syncStatus.data === 'object' && syncStatus.data !== null, 'sync.status data must be object');
  console.log('[Smoke] GET /api/polymarket/sync/status -> ok');

  const signals = await getJson('/api/polymarket/signals?limit=3');
  assert(signals.success === true, 'signals.success must be true');
  assert(Array.isArray(signals.data), 'signals.data must be an array');
  console.log(`[Smoke] GET /api/polymarket/signals -> ok (${(signals.data as unknown[]).length} signals)`);

  if (!AGENT_BEARER_TOKEN) {
    console.log('[Smoke] AGENT_BEARER_TOKEN not set; skipping POST /api/polymarket/signals');
    console.log('\n[Smoke] PASS');
    return;
  }

  const marketList = markets.data as Array<Record<string, unknown>>;
  assert(marketList.length > 0, 'Need at least one market for signal post test');
  const marketId = marketList[0]?.id;
  assert(typeof marketId === 'string' && marketId.length > 0, 'First market must have an id');

  const postResult = await postJson(
    '/api/polymarket/signals',
    {
      marketId,
      side: 'YES',
      confidence: 70,
      reasoning: 'Contract smoke test signal',
      contracts: 1,
    },
    { Authorization: `Bearer ${AGENT_BEARER_TOKEN}` },
  );

  assert(postResult.success === true, 'postResult.success must be true');
  console.log('[Smoke] POST /api/polymarket/signals -> ok');

  console.log('\n[Smoke] PASS');
}

main().catch((err) => {
  console.error(`\n[Smoke] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
