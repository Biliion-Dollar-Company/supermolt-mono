/**
 * Base Chain Token Launch Monitor — Multi-Platform
 *
 * Monitors ALL major Base launchpads for new token creations:
 *
 * 1. CLANKER (v4 + v4.1) — TokenCreated event, direct Uniswap v4
 *    - v4:   0xE85A59c628F7d27878ACeB4bf3b35733630083a9
 *    - v4.1: 0x9B84fcE5Dcd9a38d2D01d5D72373F6b6b067c3e1
 *    - ~35 launches / 30min
 *
 * 2. ZORA COINS — CoinCreatedV4 + CreatorCoinCreated events, direct Uniswap v4
 *    - Factory: 0x777777751622c0d3258f214F9DF38E35BF45baF3
 *    - ~1000 launches / 30min (MASSIVE volume)
 *
 * 3. FLAUNCH — Pool creation via Uniswap v4 hook
 *    - PositionManager: 0xf785bb58059fab6fb19bdda2cb9078d9e546efdc
 *    - ~4 launches / 30min
 *
 * Detected tokens are:
 *   1. Recorded in TokenDeployment (chain: BASE, platform: clanker|zora|flaunch)
 *   2. Fed into agent-signal-reactor for conversation generation
 *   3. Broadcast via WebSocket for real-time frontend updates
 *
 * Uses direct RPC eth_getLogs — no API key required.
 * Base has 2s blocks; we poll every 6s with a 3-block range.
 */

import { db } from '../lib/db';

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://base-mainnet.public.blastapi.io';

// ── Factory Addresses ──────────────────────────────────────

const CLANKER_V4_FACTORY = '0xe85a59c628f7d27878aceb4bf3b35733630083a9';
const CLANKER_V41_FACTORY = '0x9b84fce5dcd9a38d2d01d5d72373f6b6b067c3e1';
const ZORA_FACTORY = '0x777777751622c0d3258f214f9df38e35bf45baf3';
const FLAUNCH_POSITION_MANAGER = '0xf785bb58059fab6fb19bdda2cb9078d9e546efdc';

// ── Event Topic Hashes (verified against live Base RPC) ────

// Clanker TokenCreated(address,address indexed,address indexed,string,string,string,string,string,int24,address,bytes32,address,address,address,uint256,address[])
const CLANKER_TOKEN_CREATED = '0x9299d1d1a88d8e1abdc591ae7a167a6bc63a8f17d695804e9091ee33aa89fb67';

// Zora CoinCreatedV4(address indexed,address indexed,address indexed,address,string,string,string,address,(address,address,uint24,int24,address),bytes32,string)
const ZORA_COIN_CREATED_V4 = '0x2de436107c2096e039c98bbcc3c5a2560583738ce15c234557eecb4d3221aa81';

// Zora CreatorCoinCreated (same factory, different coin type)
const ZORA_CREATOR_COIN_CREATED = '0x74b670d628e152daa36ca95dda7cb0002d6ea7a37b55afe4593db7abd1515781';

// Flaunch pool creation event (custom hook event, appears once per new pool)
const FLAUNCH_POOL_CREATED = '0xc7241a69d3660bdfe5f36bdcca3b2da1fe8844366e46adb58be95171ab0665ad';

// ── Polling Config ─────────────────────────────────────────

const POLL_INTERVAL_MS = 6_000;
const BLOCK_RANGE = 3;
const CATCHUP_BLOCK_RANGE = 500;
const MONITOR_STATE_ID = 'base-launch-monitor';

// ── Types ──────────────────────────────────────────────────

interface TokenLaunchEvent {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImage?: string;
  pairedToken?: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  platform: 'clanker' | 'zora' | 'flaunch';
  factory: string;
}

interface RpcLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  blockTimestamp?: string;
}

// ── RPC Helpers ────────────────────────────────────────────

async function rpcCall(method: string, params: any[]): Promise<any> {
  const resp = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await resp.json() as { result?: any; error?: any };
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  return data.result;
}

function unpadAddress(topic: string): string {
  return '0x' + topic.slice(26).toLowerCase();
}

// ── ABI Decoding Helpers ───────────────────────────────────

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

async function fallbackTokenMetadata(tokenAddress: string): Promise<{ name: string; symbol: string }> {
  let name = 'Unknown';
  let symbol = 'UNKNOWN';
  try {
    const nameResult = await rpcCall('eth_call', [{ to: tokenAddress, data: '0x06fdde03' }, 'latest']);
    if (nameResult && nameResult !== '0x') {
      const d = nameResult.startsWith('0x') ? nameResult.slice(2) : nameResult;
      if (d.length >= 128) {
        const offset = parseInt(d.slice(0, 64), 16) * 2;
        const length = parseInt(d.slice(offset, offset + 64), 16);
        if (length > 0 && length < 200) {
          const strHex = d.slice(offset + 64, offset + 64 + length * 2);
          const bytes = new Uint8Array(length);
          for (let i = 0; i < length; i++) bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
          name = new TextDecoder().decode(bytes);
        }
      }
    }
  } catch { /* ignore */ }
  try {
    const symbolResult = await rpcCall('eth_call', [{ to: tokenAddress, data: '0x95d89b41' }, 'latest']);
    if (symbolResult && symbolResult !== '0x') {
      const d = symbolResult.startsWith('0x') ? symbolResult.slice(2) : symbolResult;
      if (d.length >= 128) {
        const offset = parseInt(d.slice(0, 64), 16) * 2;
        const length = parseInt(d.slice(offset, offset + 64), 16);
        if (length > 0 && length < 200) {
          const strHex = d.slice(offset + 64, offset + 64 + length * 2);
          const bytes = new Uint8Array(length);
          for (let i = 0; i < length; i++) bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
          symbol = new TextDecoder().decode(bytes);
        }
      }
    }
  } catch { /* ignore */ }
  return { name, symbol };
}

// ── Platform-Specific Decoders ─────────────────────────────

/**
 * Decode Clanker TokenCreated event.
 * Indexed: topics[1] = tokenAddress, topics[2] = tokenAdmin
 * Data slots: 0=msgSender, 1=tokenImage(ptr), 2=tokenName(ptr), 3=tokenSymbol(ptr),
 *   4=tokenMetadata(ptr), 5=tokenContext(ptr), 6=startingTick, 7=poolHook,
 *   8=poolId, 9=pairedToken, 10=locker, 11=mevModule, 12=extensionsSupply, 13=extensions(ptr)
 */
function decodeClankerEvent(topics: string[], data: string): {
  tokenAddress: string; tokenName: string; tokenSymbol: string;
  tokenImage: string; pairedToken: string;
} | null {
  try {
    if (topics.length < 3) return null;
    const d = data.startsWith('0x') ? data.slice(2) : data;
    return {
      tokenAddress: unpadAddress(topics[1]),
      tokenImage: decodeAbiString(d, 1),
      tokenName: decodeAbiString(d, 2),
      tokenSymbol: decodeAbiString(d, 3),
      pairedToken: decodeAbiAddress(d, 9),
    };
  } catch {
    return null;
  }
}

/**
 * Decode Zora CoinCreatedV4 / CreatorCoinCreated event.
 * Indexed: topics[1]=caller, topics[2]=payoutRecipient, topics[3]=platformReferrer
 * Data layout: 0=currency(addr), 1=uri(ptr), 2=name(ptr), 3=symbol(ptr), 4=coin(addr),
 *   5-9=poolKey tuple, 10=poolKeyHash, 11=version(ptr)
 */
function decodeZoraEvent(topics: string[], data: string): {
  tokenAddress: string; tokenName: string; tokenSymbol: string; tokenUri: string;
} | null {
  try {
    const d = data.startsWith('0x') ? data.slice(2) : data;
    const coinAddress = decodeAbiAddress(d, 4);
    const name = decodeAbiString(d, 2);
    const symbol = decodeAbiString(d, 3);
    const uri = decodeAbiString(d, 1);
    if (!coinAddress || coinAddress === '0x0000000000000000000000000000000000000000') return null;
    return { tokenAddress: coinAddress, tokenName: name, tokenSymbol: symbol, tokenUri: uri };
  } catch {
    return null;
  }
}

/**
 * Handle Flaunch pool creation. The event itself doesn't contain the token address
 * directly, so we fetch the TX receipt and look for ERC20 contracts involved.
 * Returns null if we can't determine the token.
 */
async function decodeFlaunchEvent(log: RpcLogEntry): Promise<{
  tokenAddress: string; tokenName: string; tokenSymbol: string;
} | null> {
  try {
    const receipt = await rpcCall('eth_getTransactionReceipt', [log.transactionHash]);
    if (!receipt?.logs) return null;

    // Find ERC20 contracts in the TX that aren't known infrastructure
    const knownContracts = new Set([
      FLAUNCH_POSITION_MANAGER,
      '0x4200000000000000000000000000000000000006', // WETH
      '0x000000000d564d5be76f7f0d28fe52605afc7cf8', // Uniswap PoolManager
      '0x498581ff718922c3f8e6a244956af099b2652b2b', // Flaunch util
      '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc', // Clanker Hook
      '0xf3622742b1e446d92e45e22923ef11c2fcd55d68', // Clanker FeeLocker
    ]);

    // Collect unique unknown contract addresses from the TX
    const candidates = new Set<string>();
    for (const txLog of receipt.logs) {
      const addr = txLog.address.toLowerCase();
      if (!knownContracts.has(addr)) {
        candidates.add(addr);
      }
    }

    // Try to find one that's an ERC20 with name/symbol
    for (const addr of candidates) {
      try {
        const meta = await fallbackTokenMetadata(addr);
        if (meta.name !== 'Unknown' && meta.symbol !== 'UNKNOWN') {
          return { tokenAddress: addr, tokenName: meta.name, tokenSymbol: meta.symbol };
        }
      } catch { /* not an ERC20, skip */ }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Monitor Class ──────────────────────────────────────────

export class ClankerMonitor {
  private lastBlock: number = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private seenTxHashes: Set<string> = new Set();
  private onMigrationCallbacks: ((event: TokenLaunchEvent) => void)[] = [];

  // Backoff state
  private backoffLevel: number = 0;
  private skipsRemaining: number = 0;
  private lastRateLimitLog: number = 0;

  // Stats
  private stats = { clanker: 0, zora: 0, flaunch: 0, total: 0 };

  onMigration(callback: (event: TokenLaunchEvent) => void) {
    this.onMigrationCallbacks.push(callback);
  }

  getStats() { return { ...this.stats }; }

  async start() {
    try {
      const blockHex = await rpcCall('eth_blockNumber', []);
      const currentBlock = parseInt(blockHex, 16);

      const saved = await db.monitorState.findUnique({ where: { id: MONITOR_STATE_ID } });
      if (saved && saved.lastBlock > 0) {
        this.lastBlock = saved.lastBlock;
        const gap = currentBlock - saved.lastBlock;
        console.log(`[Base Launch Monitor] Resuming from block ${saved.lastBlock} (${gap} blocks behind, ~${Math.round(gap * 2 / 60)} min gap)`);
      } else {
        this.lastBlock = currentBlock;
        console.log(`[Base Launch Monitor] No saved state, starting from current block ${currentBlock}`);
      }
    } catch (error) {
      console.warn('[Base Launch Monitor] Could not get current block:', error);
      return;
    }

    console.log(`[Base Launch Monitor] Started polling from block ${this.lastBlock}`);
    console.log(`[Base Launch Monitor] RPC: ${BASE_RPC_URL}`);
    console.log(`[Base Launch Monitor] Platforms: Clanker (v4+v4.1), Zora, Flaunch`);

    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.pollTimer.unref();
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[Base Launch Monitor] Stopped');
  }

  private async poll() {
    try {
      if (this.skipsRemaining > 0) {
        this.skipsRemaining--;
        return;
      }

      const latestHex = await rpcCall('eth_blockNumber', []);
      const latestBlock = parseInt(latestHex, 16);
      const safeLatest = latestBlock - 2;

      if (safeLatest <= this.lastBlock) return;

      const gap = safeLatest - this.lastBlock;
      const range = gap > 200 ? CATCHUP_BLOCK_RANGE : BLOCK_RANGE;
      if (gap > 200) {
        console.log(`[Base Launch Monitor] Catching up: ${gap} blocks behind`);
      }

      const fromBlock = this.lastBlock + 1;
      const toBlock = Math.min(safeLatest, fromBlock + range - 1);
      const fromHex = '0x' + fromBlock.toString(16);
      const toHex = '0x' + toBlock.toString(16);

      // Query all platforms in parallel
      const [clankerV4, clankerV41, zoraV4, zoraCreator, flaunchLogs] = await Promise.all([
        rpcCall('eth_getLogs', [{
          fromBlock: fromHex, toBlock: toHex,
          address: CLANKER_V4_FACTORY,
          topics: [CLANKER_TOKEN_CREATED],
        }]).catch(() => [] as RpcLogEntry[]),
        rpcCall('eth_getLogs', [{
          fromBlock: fromHex, toBlock: toHex,
          address: CLANKER_V41_FACTORY,
          topics: [CLANKER_TOKEN_CREATED],
        }]).catch(() => [] as RpcLogEntry[]),
        rpcCall('eth_getLogs', [{
          fromBlock: fromHex, toBlock: toHex,
          address: ZORA_FACTORY,
          topics: [ZORA_COIN_CREATED_V4],
        }]).catch(() => [] as RpcLogEntry[]),
        rpcCall('eth_getLogs', [{
          fromBlock: fromHex, toBlock: toHex,
          address: ZORA_FACTORY,
          topics: [ZORA_CREATOR_COIN_CREATED],
        }]).catch(() => [] as RpcLogEntry[]),
        rpcCall('eth_getLogs', [{
          fromBlock: fromHex, toBlock: toHex,
          address: FLAUNCH_POSITION_MANAGER,
          topics: [FLAUNCH_POOL_CREATED],
        }]).catch(() => [] as RpcLogEntry[]),
      ]);

      // Reset backoff on success
      this.backoffLevel = 0;

      // Persist block progress
      this.lastBlock = toBlock;
      db.monitorState.upsert({
        where: { id: MONITOR_STATE_ID },
        create: { id: MONITOR_STATE_ID, lastBlock: toBlock },
        update: { lastBlock: toBlock },
      }).catch(() => {});

      // Process Clanker events
      const clankerLogs = [
        ...(clankerV4 || []).map((l: RpcLogEntry) => ({ log: l, version: 'v4' })),
        ...(clankerV41 || []).map((l: RpcLogEntry) => ({ log: l, version: 'v4.1' })),
      ];
      for (const { log, version } of clankerLogs) {
        await this.handleClankerToken(log, version);
      }

      // Process Zora events
      const allZoraLogs = [
        ...(zoraV4 || []).map((l: RpcLogEntry) => ({ log: l, type: 'coin' as const })),
        ...(zoraCreator || []).map((l: RpcLogEntry) => ({ log: l, type: 'creator' as const })),
      ];
      for (const { log, type } of allZoraLogs) {
        await this.handleZoraToken(log, type);
      }

      // Process Flaunch events
      for (const log of (flaunchLogs || [])) {
        await this.handleFlaunchToken(log);
      }

      const totalInBatch = clankerLogs.length + allZoraLogs.length + (flaunchLogs || []).length;
      if (totalInBatch > 0) {
        console.log(
          `[Base Launch Monitor] Blocks ${fromBlock}-${toBlock}: ` +
          `${clankerLogs.length} clanker, ${allZoraLogs.length} zora, ${(flaunchLogs || []).length} flaunch`
        );
      }
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('limit exceeded')
        || error?.message?.includes('-32005')
        || error?.message?.includes('429')
        || error?.message?.includes('-32011');

      if (isRateLimit) {
        this.backoffLevel = Math.min(this.backoffLevel + 1, 5);
        const skipTicks = Math.pow(2, this.backoffLevel);
        this.skipsRemaining = skipTicks;
        const now = Date.now();
        if (now - this.lastRateLimitLog > 60_000) {
          console.warn(`[Base Launch Monitor] RPC rate-limited, backing off ${Math.round(skipTicks * POLL_INTERVAL_MS / 1000)}s`);
          this.lastRateLimitLog = now;
        }
      } else {
        console.error('[Base Launch Monitor] Poll error:', error?.message || error);
      }
    }
  }

  // ── Clanker Handler ────────────────────────────────────

  private async handleClankerToken(log: RpcLogEntry, version: string) {
    const txHash = log.transactionHash;
    if (this.seenTxHashes.has(txHash)) return;
    this.seenTxHashes.add(txHash);
    this.trimSeenSet();

    const blockNum = parseInt(log.blockNumber, 16);
    const timestamp = log.blockTimestamp ? parseInt(log.blockTimestamp, 16) : Math.floor(Date.now() / 1000);

    const decoded = decodeClankerEvent(log.topics, log.data);

    let tokenAddress: string;
    let tokenName: string;
    let tokenSymbol: string;
    let tokenImage = '';

    if (decoded && decoded.tokenName && decoded.tokenSymbol) {
      tokenAddress = decoded.tokenAddress;
      tokenName = decoded.tokenName;
      tokenSymbol = decoded.tokenSymbol;
      tokenImage = decoded.tokenImage;
    } else {
      tokenAddress = unpadAddress(log.topics[1]);
      const meta = await fallbackTokenMetadata(tokenAddress);
      tokenName = meta.name;
      tokenSymbol = meta.symbol;
    }

    console.log(`[Clanker ${version}] ${tokenSymbol} "${tokenName}" at ${tokenAddress.slice(0, 14)}...`);
    this.stats.clanker++;
    this.stats.total++;

    await this.recordToken({
      tokenAddress, tokenName, tokenSymbol, tokenImage,
      txHash, blockNumber: blockNum, timestamp,
      platform: 'clanker', factory: CLANKER_V4_FACTORY,
    });
  }

  // ── Zora Handler ───────────────────────────────────────

  private async handleZoraToken(log: RpcLogEntry, type: 'coin' | 'creator') {
    const txHash = log.transactionHash;
    if (this.seenTxHashes.has(txHash)) return;
    this.seenTxHashes.add(txHash);
    this.trimSeenSet();

    const blockNum = parseInt(log.blockNumber, 16);
    const timestamp = log.blockTimestamp ? parseInt(log.blockTimestamp, 16) : Math.floor(Date.now() / 1000);

    const decoded = decodeZoraEvent(log.topics, log.data);
    if (!decoded) return;

    // Zora has VERY high volume — only log occasionally
    this.stats.zora++;
    this.stats.total++;
    if (this.stats.zora % 50 === 1) {
      console.log(`[Zora ${type}] ${decoded.tokenSymbol} "${decoded.tokenName}" at ${decoded.tokenAddress.slice(0, 14)}... (${this.stats.zora} total)`);
    }

    await this.recordToken({
      tokenAddress: decoded.tokenAddress,
      tokenName: decoded.tokenName,
      tokenSymbol: decoded.tokenSymbol,
      tokenImage: decoded.tokenUri || '',
      txHash, blockNumber: blockNum, timestamp,
      platform: 'zora', factory: ZORA_FACTORY,
    });
  }

  // ── Flaunch Handler ────────────────────────────────────

  private async handleFlaunchToken(log: RpcLogEntry) {
    const txHash = log.transactionHash;
    if (this.seenTxHashes.has(txHash)) return;
    this.seenTxHashes.add(txHash);
    this.trimSeenSet();

    const blockNum = parseInt(log.blockNumber, 16);
    const timestamp = log.blockTimestamp ? parseInt(log.blockTimestamp, 16) : Math.floor(Date.now() / 1000);

    // Flaunch requires TX receipt analysis to find the token
    const decoded = await decodeFlaunchEvent(log);
    if (!decoded) {
      console.log(`[Flaunch] New pool in tx ${txHash.slice(0, 16)}... (could not resolve token)`);
      return;
    }

    console.log(`[Flaunch] ${decoded.tokenSymbol} "${decoded.tokenName}" at ${decoded.tokenAddress.slice(0, 14)}...`);
    this.stats.flaunch++;
    this.stats.total++;

    await this.recordToken({
      tokenAddress: decoded.tokenAddress,
      tokenName: decoded.tokenName,
      tokenSymbol: decoded.tokenSymbol,
      txHash, blockNumber: blockNum, timestamp,
      platform: 'flaunch', factory: FLAUNCH_POSITION_MANAGER,
    });
  }

  // ── Shared Recording Logic ─────────────────────────────

  private async recordToken(event: TokenLaunchEvent) {
    try {
      const existing = await db.tokenDeployment.findFirst({
        where: { tokenAddress: event.tokenAddress },
      });
      if (existing) return;

      await db.tokenDeployment.create({
        data: {
          agentId: `system-${event.platform}`,
          tokenAddress: event.tokenAddress,
          tokenName: event.tokenName || 'Unknown',
          tokenSymbol: event.tokenSymbol || 'UNKNOWN',
          totalSupply: '1000000000',
          factoryTxHash: event.txHash,
          chain: 'BASE',
          platform: event.platform,
          imageUrl: event.tokenImage || null,
          bondingCurveGraduated: true, // All Base platforms launch directly to DEX
          graduationTxHash: event.txHash,
          graduationTime: new Date(event.timestamp * 1000),
          quoteToken: 'WETH',
        },
      });

      // Create conversation thread
      await this.createTokenConversation(event);

      // Fire signal reactor (non-blocking)
      this.fireSignalReactor(event).catch(() => {});

      // Notify listeners
      for (const cb of this.onMigrationCallbacks) {
        try { cb(event); } catch (err) { console.error('[Base Launch Monitor] Callback error:', err); }
      }
    } catch (error: any) {
      if (error.code !== 'P2002') {
        console.error(`[Base Launch Monitor] Failed to record ${event.platform} token:`, error.message);
      }
    }
  }

  private async createTokenConversation(event: TokenLaunchEvent) {
    try {
      const existing = await db.agentConversation.findFirst({
        where: { tokenMint: event.tokenAddress },
      });
      if (existing) return;

      const platformLabel = event.platform === 'clanker' ? 'Clanker v4'
        : event.platform === 'zora' ? 'Zora Coins'
        : 'Flaunch';

      const explorerUrl = `https://basescan.org/address/${event.tokenAddress}`;
      const platformUrl = event.platform === 'clanker'
        ? `https://clanker.world/clanker/${event.tokenAddress}`
        : event.platform === 'zora'
        ? `https://zora.co/coin/base:${event.tokenAddress}`
        : `https://flaunch.gg/base/token/${event.tokenAddress}`;

      const conversation = await db.agentConversation.create({
        data: {
          topic: `Signal: ${event.tokenSymbol} (${platformLabel} Base)`,
          tokenMint: event.tokenAddress,
        },
      });

      await db.agentMessage.create({
        data: {
          conversationId: conversation.id,
          agentId: 'system',
          message: `${event.tokenSymbol} launched on ${platformLabel} (Base)!\n\n` +
            `Platform: ${platformLabel}\n` +
            `Pair: ${event.tokenSymbol}/WETH\n` +
            `Token: ${event.tokenAddress}\n` +
            `Explorer: ${explorerUrl}\n` +
            `Platform: ${platformUrl}\n\n` +
            `Live on Uniswap v4. Discuss trading strategy here.`,
        },
      });
    } catch (error: any) {
      // Silently skip conversation creation errors (non-critical)
    }
  }

  private async fireSignalReactor(event: TokenLaunchEvent) {
    try {
      const { agentSignalReactor } = await import('./agent-signal-reactor.js');
      await agentSignalReactor.react('new_token', {
        mint: event.tokenAddress,
        symbol: event.tokenSymbol,
        name: event.tokenName,
        marketCap: 0,
        liquidity: 0,
        chain: 'BASE',
        source: `${event.platform}_launch`,
        txHash: event.txHash,
      });
    } catch {
      // Signal reactor may not exist, that's fine
    }
  }

  // ── Utility ────────────────────────────────────────────

  private trimSeenSet() {
    if (this.seenTxHashes.size > 10000) {
      const toDelete: string[] = [];
      const iter = this.seenTxHashes.values();
      for (let i = 0; i < 3000; i++) {
        const v = iter.next();
        if (v.done) break;
        toDelete.push(v.value);
      }
      toDelete.forEach(h => this.seenTxHashes.delete(h));
    }
  }

  async getRecentCreations(limit = 20) {
    return db.tokenDeployment.findMany({
      where: { chain: 'BASE' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRecentByPlatform(platform: string, limit = 20) {
    return db.tokenDeployment.findMany({
      where: { chain: 'BASE', platform },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

// ── Singleton ──────────────────────────────────────────────

let clankerMonitor: ClankerMonitor | null = null;

export function getClankerMonitor(): ClankerMonitor | null {
  return clankerMonitor;
}

export function createClankerMonitor(): ClankerMonitor {
  clankerMonitor = new ClankerMonitor();
  return clankerMonitor;
}
