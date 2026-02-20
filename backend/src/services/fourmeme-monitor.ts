/**
 * BSC Token Graduation Monitor
 *
 * Monitors TWO event sources:
 * 1. Four.Meme TokenManager2 factory — for token creations (TokenCreate events)
 * 2. PancakeSwap V2 Factory — for ALL platform token graduations (PairCreated events)
 *
 * Detects platform by token address suffix:
 *   - 4444 / ffff = Four.Meme tokens
 *   - 7777 = Flap tokens
 *
 * This catches ALL BSC meme platform graduations regardless of which launchpad
 * triggers them, because they all graduate to PancakeSwap V2.
 *
 * Uses direct RPC eth_getLogs — no BSCscan API key required.
 * Default RPC: PublicNode BSC (free, no auth).
 */

import { db } from '../lib/db';

const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com';
const FOUR_MEME_FACTORY = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
const PANCAKE_V2_FACTORY = '0xca143ce32fe78f1f7019d7d551a6402fc5350c73';
const POLL_INTERVAL_MS = 15_000; // 15 seconds
const BLOCK_RANGE = 50; // ~2.5 min of BSC blocks (3s each)
const CATCHUP_BLOCK_RANGE = 5000; // Larger range when catching up
const GRADUATION_POLL_INTERVAL_MS = 10_000; // 10 seconds for graduation detection

// Well-known tokens
const WBNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const USDT = '0x55d398326f99059ff775485246999027b3197955';
const USD1 = '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d'; // Usual USD1

// Event topic hashes
// TokenCreate(address,address,uint256,string,string,uint256,uint256,uint256)
const TOKEN_CREATE_TOPIC = '0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20';
// LiquidityAdded(address,uint256,address,uint256) — Four.Meme's own graduation event
const LIQUIDITY_ADDED_TOPIC = '0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0';
// PairCreated(address indexed token0, address indexed token1, address pair, uint) — PancakeSwap V2
const PAIR_CREATED_TOPIC = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';

// Platform detection by address suffix
function detectPlatform(tokenAddress: string): string | null {
  const addr = tokenAddress.toLowerCase();
  if (addr.endsWith('4444') || addr.endsWith('ffff')) return 'four.meme';
  if (addr.endsWith('7777')) return 'flap';
  return null;
}

function getQuoteLabel(quoteAddress: string): string {
  const addr = quoteAddress.toLowerCase();
  if (addr === WBNB) return 'WBNB';
  if (addr === USDT) return 'USDT';
  if (addr === USD1) return 'USD1';
  return addr.slice(0, 14) + '...';
}

interface MigrationEvent {
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  pairAddress?: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

interface RpcLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  blockTimestamp?: string;
}

/**
 * Call BSC RPC via fetch
 */
async function rpcCall(method: string, params: any[]): Promise<any> {
  const resp = await fetch(BSC_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await resp.json() as { result?: any; error?: any };
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  return data.result;
}

/**
 * Decode ABI-encoded data (non-indexed params)
 * Simple hex → value decoder for common types
 */
function decodeAddress(hex: string, offset: number): string {
  return '0x' + hex.slice(offset + 24, offset + 64).toLowerCase();
}

function decodeUint256(hex: string, offset: number): bigint {
  return BigInt('0x' + hex.slice(offset, offset + 64));
}

function decodeString(hex: string, dataOffset: number): string {
  // Read the offset pointer
  const strOffset = Number(decodeUint256(hex, dataOffset)) * 2;
  // Read length at that offset
  const strLen = Number(decodeUint256(hex, strOffset));
  // Read string bytes
  const strHex = hex.slice(strOffset + 64, strOffset + 64 + strLen * 2);
  // Convert hex to UTF-8
  const bytes = new Uint8Array(strLen);
  for (let i = 0; i < strLen; i++) {
    bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Decode TokenCreate event data
 * TokenCreate(address creator, address token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime, uint256 launchFee)
 */
function decodeTokenCreateEvent(data: string): {
  creator: string;
  token: string;
  requestId: bigint;
  name: string;
  symbol: string;
  totalSupply: bigint;
  launchTime: bigint;
  launchFee: bigint;
} | null {
  try {
    // Strip 0x prefix
    const d = data.startsWith('0x') ? data.slice(2) : data;
    // Each ABI slot is 64 hex chars (32 bytes)
    // Slots: 0=creator, 1=token, 2=requestId, 3=nameOffset, 4=symbolOffset, 5=totalSupply, 6=launchTime, 7=launchFee
    const creator = decodeAddress(d, 0);
    const token = decodeAddress(d, 64);
    const requestId = decodeUint256(d, 128);
    const name = decodeString(d, 192);
    const symbol = decodeString(d, 256);
    const totalSupply = decodeUint256(d, 320);
    const launchTime = decodeUint256(d, 384);
    const launchFee = decodeUint256(d, 448);
    return { creator, token, requestId, name, symbol, totalSupply, launchTime, launchFee };
  } catch {
    return null;
  }
}

/**
 * Decode LiquidityAdded event data
 * LiquidityAdded(address base, uint256 offers, address quote, uint256 funds)
 */
function decodeLiquidityAddedEvent(data: string): {
  base: string;
  offers: bigint;
  quote: string;
  funds: bigint;
} | null {
  try {
    const d = data.startsWith('0x') ? data.slice(2) : data;
    const base = decodeAddress(d, 0);
    const offers = decodeUint256(d, 64);
    const quote = decodeAddress(d, 128);
    const funds = decodeUint256(d, 192);
    return { base, offers, quote, funds };
  } catch {
    return null;
  }
}

export class FourMemeMonitor {
  private lastBlock: number = 0;
  private graduationLastBlock: number = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private graduationPollTimer: ReturnType<typeof setInterval> | null = null;
  private seenTxHashes: Set<string> = new Set();
  private seenGraduationTxHashes: Set<string> = new Set();
  private onMigrationCallbacks: ((event: MigrationEvent) => void)[] = [];

  // Backoff state — slows polling when RPC is rate-limited
  private pollBackoff: number = 0; // 0 = normal, each rate-limit doubles interval
  private gradBackoff: number = 0;
  private pollSkipsRemaining: number = 0;
  private gradSkipsRemaining: number = 0;
  private lastRateLimitLog: number = 0; // suppress repeated logs

  // Accept apiKey for backwards-compat but it's no longer needed
  constructor(_apiKey?: string) {}

  /**
   * Register a callback for when a 4meme token migrates
   */
  onMigration(callback: (event: MigrationEvent) => void) {
    this.onMigrationCallbacks.push(callback);
  }

  /**
   * Start monitoring for 4meme token events + PancakeSwap graduations
   * Resumes from last persisted block if available (catches up on missed events)
   */
  async start() {
    try {
      const blockHex = await rpcCall('eth_blockNumber', []);
      const currentBlock = parseInt(blockHex, 16);

      // Check for persisted block state — resume from where we left off
      const saved = await db.monitorState.findUnique({ where: { id: 'fourmeme-monitor' } });
      if (saved && saved.lastBlock > 0) {
        this.lastBlock = saved.lastBlock;
        const gap = currentBlock - saved.lastBlock;
        console.log(`[4meme] Resuming from persisted block ${saved.lastBlock} (${gap} blocks behind, ~${Math.round(gap * 3 / 60)} min gap)`);
      } else {
        this.lastBlock = currentBlock;
        console.log(`[4meme] No saved state, starting from current block ${currentBlock}`);
      }

      // Graduation monitor — separate persisted block
      const savedGrad = await db.monitorState.findUnique({ where: { id: 'graduation-monitor' } });
      if (savedGrad && savedGrad.lastBlock > 0) {
        this.graduationLastBlock = savedGrad.lastBlock;
        const gap = currentBlock - savedGrad.lastBlock;
        console.log(`[graduation] Resuming from persisted block ${savedGrad.lastBlock} (${gap} blocks behind)`);
      } else {
        this.graduationLastBlock = currentBlock;
        console.log(`[graduation] No saved state, starting from current block ${currentBlock}`);
      }
    } catch (error) {
      console.warn('[4meme] Could not get current block:', error);
      return;
    }

    console.log(`[4meme] Starting RPC-based monitor from block ${this.lastBlock} (${BSC_RPC_URL})`);
    console.log(`[graduation] Starting PancakeSwap graduation monitor from block ${this.graduationLastBlock}`);

    // Start polling loops
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.pollTimer.unref();

    this.graduationPollTimer = setInterval(() => this.pollGraduations(), GRADUATION_POLL_INTERVAL_MS);
    this.graduationPollTimer.unref();
  }

  /**
   * Stop all monitors
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.graduationPollTimer) {
      clearInterval(this.graduationPollTimer);
      this.graduationPollTimer = null;
    }
    console.log('[4meme] Stopped');
    console.log('[graduation] Stopped');
  }

  /**
   * Poll for new events from the Four.Meme factory
   * Uses larger block range when catching up from a gap
   */
  private async poll() {
    try {
      // Skip ticks during backoff
      if (this.pollSkipsRemaining > 0) {
        this.pollSkipsRemaining--;
        return;
      }

      // Get latest block
      const latestHex = await rpcCall('eth_blockNumber', []);
      const latestBlock = parseInt(latestHex, 16);

      // Stay 2 blocks behind tip to avoid querying unfinalized blocks
      const safeLatest = latestBlock - 2;
      if (safeLatest <= this.lastBlock) {
        return;
      }

      // Use larger range when catching up (eth_getLogs with address filter handles big ranges)
      const gap = safeLatest - this.lastBlock;
      const range = gap > 200 ? CATCHUP_BLOCK_RANGE : BLOCK_RANGE;
      if (gap > 200) {
        console.log(`[4meme] Catching up: ${gap} blocks behind, using ${range}-block range`);
      }

      const fromBlock = this.lastBlock + 1;
      const toBlock = Math.min(safeLatest, fromBlock + range - 1);

      const fromHex = '0x' + fromBlock.toString(16);
      const toHex = '0x' + toBlock.toString(16);

      // Query only TokenCreate and LiquidityAdded events (filter by topic)
      // Using topic array for OR: either TokenCreate OR LiquidityAdded
      const logs: RpcLogEntry[] = await rpcCall('eth_getLogs', [{
        fromBlock: fromHex,
        toBlock: toHex,
        address: FOUR_MEME_FACTORY,
        topics: [[TOKEN_CREATE_TOPIC, LIQUIDITY_ADDED_TOPIC]],
      }]);

      // Success — reset backoff
      this.pollBackoff = 0;

      // Update last processed block (in memory + DB)
      this.lastBlock = toBlock;
      db.monitorState.upsert({
        where: { id: 'fourmeme-monitor' },
        create: { id: 'fourmeme-monitor', lastBlock: toBlock },
        update: { lastBlock: toBlock },
      }).catch(() => {}); // fire-and-forget, non-blocking

      if (!logs || logs.length === 0) return;

      console.log(`[4meme] Found ${logs.length} events in blocks ${fromBlock}-${toBlock}`);

      // Process each log
      for (const log of logs) {
        const topic0 = log.topics[0];
        const txHash = log.transactionHash;
        const blockNum = parseInt(log.blockNumber, 16);
        const timestamp = log.blockTimestamp
          ? parseInt(log.blockTimestamp, 16)
          : Math.floor(Date.now() / 1000);

        if (topic0 === TOKEN_CREATE_TOPIC) {
          await this.handleTokenCreate(log, txHash, blockNum, timestamp);
        } else if (topic0 === LIQUIDITY_ADDED_TOPIC) {
          await this.handleLiquidityAdded(log, txHash, blockNum, timestamp);
        }
      }
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('limit exceeded') || error?.message?.includes('-32005');
      if (isRateLimit) {
        this.pollBackoff = Math.min(this.pollBackoff + 1, 5); // max 5 = ~8 min backoff
        const skipTicks = Math.pow(2, this.pollBackoff); // 2, 4, 8, 16, 32
        this.pollSkipsRemaining = skipTicks;
        const backoffSec = Math.round(skipTicks * POLL_INTERVAL_MS / 1000);
        // Log rate-limit at most once per 60s
        const now = Date.now();
        if (now - this.lastRateLimitLog > 60_000) {
          console.warn(`[4meme] BSC RPC rate-limited, backing off ${backoffSec}s (level ${this.pollBackoff})`);
          this.lastRateLimitLog = now;
        }
      } else {
        console.error('[4meme] Poll error:', error?.message || error);
      }
    }
  }

  /**
   * Handle TokenCreate event — new token launched on Four.Meme
   */
  private async handleTokenCreate(log: RpcLogEntry, txHash: string, blockNum: number, timestamp: number) {
    if (this.seenTxHashes.has(txHash)) return;
    this.seenTxHashes.add(txHash);

    const decoded = decodeTokenCreateEvent(log.data);
    if (!decoded) {
      console.warn(`[4meme] Failed to decode TokenCreate in tx ${txHash.slice(0, 16)}...`);
      return;
    }

    console.log(
      `[4meme] New token created: ${decoded.symbol} "${decoded.name}" at ${decoded.token.slice(0, 10)}... — tx: ${txHash.slice(0, 16)}...`
    );

    const migration: MigrationEvent = {
      tokenAddress: decoded.token,
      tokenName: decoded.name,
      tokenSymbol: decoded.symbol,
      txHash,
      blockNumber: blockNum,
      timestamp,
    };

    // Notify listeners
    for (const cb of this.onMigrationCallbacks) {
      try { cb(migration); } catch (err) { console.error('[4meme] Callback error:', err); }
    }

    // Store in database
    await this.recordTokenCreation(decoded, txHash, blockNum, timestamp);
  }

  /**
   * Handle LiquidityAdded event — token graduated to PancakeSwap
   */
  private async handleLiquidityAdded(log: RpcLogEntry, txHash: string, blockNum: number, timestamp: number) {
    const decoded = decodeLiquidityAddedEvent(log.data);
    if (!decoded) return;

    const tokenAddress = decoded.base.toLowerCase();
    const fundsWei = decoded.funds;
    const fundsBNB = Number(fundsWei) / 1e18;

    console.log(
      `[4meme] Graduation! Token ${tokenAddress.slice(0, 10)}... added liquidity (${fundsBNB.toFixed(2)} BNB) — tx: ${txHash.slice(0, 16)}...`
    );

    // Update existing TokenDeployment record if it exists
    try {
      const existing = await db.tokenDeployment.findFirst({
        where: { tokenAddress },
      });

      if (existing && !existing.bondingCurveGraduated) {
        await db.tokenDeployment.update({
          where: { id: existing.id },
          data: {
            bondingCurveGraduated: true,
            graduationTxHash: txHash,
            graduationTime: new Date(timestamp * 1000),
          },
        });
        console.log(`[4meme] Marked ${existing.tokenSymbol} as graduated (agent: ${existing.agentId})`);
      }
    } catch (err) {
      console.error('[4meme] Failed to update graduation:', err);
    }
  }

  /**
   * Record a new token creation in the database
   */
  private async recordTokenCreation(
    decoded: NonNullable<ReturnType<typeof decodeTokenCreateEvent>>,
    txHash: string,
    blockNum: number,
    timestamp: number
  ) {
    const tokenAddress = decoded.token.toLowerCase();

    try {
      // Check if already exists (agent-deployed or already recorded)
      const existing = await db.tokenDeployment.findFirst({
        where: { tokenAddress },
      });
      if (existing) return; // Already tracked

      // Create new system-detected token
      const totalSupply = (Number(decoded.totalSupply) / 1e18).toString();
      await db.tokenDeployment.create({
        data: {
          agentId: 'system-fourmeme',
          tokenAddress,
          tokenName: decoded.name || 'Unknown',
          tokenSymbol: decoded.symbol || 'UNKNOWN',
          totalSupply,
          factoryTxHash: txHash,
          chain: 'BSC',
          platform: 'four.meme',
          bondingCurveGraduated: false,
        },
      });

      console.log(`[4meme] Recorded: ${decoded.symbol} at ${tokenAddress.slice(0, 10)}...`);
    } catch (error: any) {
      if (error.code !== 'P2002') {
        console.error('[4meme] Failed to record token:', error.message);
      }
    }
  }

  /**
   * Poll PancakeSwap V2 Factory for PairCreated events involving meme platform tokens.
   * Detects graduations from Four.Meme (4444/ffff) and Flap (7777).
   */
  private async pollGraduations() {
    try {
      // Skip ticks during backoff
      if (this.gradSkipsRemaining > 0) {
        this.gradSkipsRemaining--;
        return;
      }

      const latestHex = await rpcCall('eth_blockNumber', []);
      const latestBlock = parseInt(latestHex, 16);
      const safeLatest = latestBlock - 2;

      if (safeLatest <= this.graduationLastBlock) return;

      const gap = safeLatest - this.graduationLastBlock;
      const range = gap > 200 ? CATCHUP_BLOCK_RANGE : BLOCK_RANGE;
      if (gap > 200) {
        console.log(`[graduation] Catching up: ${gap} blocks behind, using ${range}-block range`);
      }

      const fromBlock = this.graduationLastBlock + 1;
      const toBlock = Math.min(safeLatest, fromBlock + range - 1);

      const logs: RpcLogEntry[] = await rpcCall('eth_getLogs', [{
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + toBlock.toString(16),
        address: PANCAKE_V2_FACTORY,
        topics: [[PAIR_CREATED_TOPIC]],
      }]);

      // Success — reset backoff
      this.gradBackoff = 0;

      // Persist block progress
      this.graduationLastBlock = toBlock;
      db.monitorState.upsert({
        where: { id: 'graduation-monitor' },
        create: { id: 'graduation-monitor', lastBlock: toBlock },
        update: { lastBlock: toBlock },
      }).catch(() => {});

      if (!logs || logs.length === 0) return;

      // Filter for platform tokens
      for (const log of logs) {
        const token0 = ('0x' + log.topics[1].slice(26)).toLowerCase();
        const token1 = ('0x' + log.topics[2].slice(26)).toLowerCase();

        // Determine which is the meme token and which is the quote
        const platform0 = detectPlatform(token0);
        const platform1 = detectPlatform(token1);

        if (!platform0 && !platform1) continue; // Not a platform token

        const memeToken = platform0 ? token0 : token1;
        const quoteTokenAddr = platform0 ? token1 : token0;
        const platform = platform0 || platform1;
        const txHash = log.transactionHash;

        if (this.seenGraduationTxHashes.has(txHash)) continue;
        this.seenGraduationTxHashes.add(txHash);

        // Decode pair address from data (PairCreated data = address pair, uint allPairsLength)
        const pairAddress = ('0x' + log.data.slice(26, 66)).toLowerCase();
        const blockNum = parseInt(log.blockNumber, 16);
        const quoteLabel = getQuoteLabel(quoteTokenAddr);

        console.log(
          `[graduation] ${platform} token graduated! ${memeToken.slice(0, 14)}... → ${quoteLabel} pair | ` +
          `Pair: ${pairAddress.slice(0, 14)}... | Block: ${blockNum} | TX: ${txHash.slice(0, 16)}...`
        );

        await this.handlePancakeGraduation(memeToken, platform!, pairAddress, quoteTokenAddr, quoteLabel, txHash, blockNum);
      }
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('limit exceeded') || error?.message?.includes('-32005');
      if (isRateLimit) {
        this.gradBackoff = Math.min(this.gradBackoff + 1, 5);
        const skipTicks = Math.pow(2, this.gradBackoff);
        this.gradSkipsRemaining = skipTicks;
        const backoffSec = Math.round(skipTicks * GRADUATION_POLL_INTERVAL_MS / 1000);
        const now = Date.now();
        if (now - this.lastRateLimitLog > 60_000) {
          console.warn(`[graduation] BSC RPC rate-limited, backing off ${backoffSec}s (level ${this.gradBackoff})`);
          this.lastRateLimitLog = now;
        }
      } else {
        console.error('[graduation] Poll error:', error?.message || error);
      }
    }
  }

  /**
   * Handle a PancakeSwap graduation detected via PairCreated event
   */
  private async handlePancakeGraduation(
    tokenAddress: string,
    platform: string,
    pairAddress: string,
    quoteTokenAddr: string,
    quoteLabel: string,
    txHash: string,
    blockNum: number,
  ) {
    try {
      // Check if token already exists in our DB (from Four.Meme TokenCreate)
      const existing = await db.tokenDeployment.findFirst({
        where: { tokenAddress },
      });

      let tokenSymbol = 'UNKNOWN';
      let tokenName = 'Unknown';

      if (existing) {
        tokenSymbol = existing.tokenSymbol;
        tokenName = existing.tokenName;
        
        // Update existing record with graduation info
        if (!existing.bondingCurveGraduated) {
          await db.tokenDeployment.update({
            where: { id: existing.id },
            data: {
              bondingCurveGraduated: true,
              graduationTxHash: txHash,
              graduationTime: new Date(),
              pairAddress,
              quoteToken: quoteLabel,
              platform: existing.platform || platform,
            },
          });
          console.log(`[graduation] Marked ${tokenSymbol} (${platform}) as graduated → ${quoteLabel}`);
        }
      } else {
        // New token we haven't seen (e.g. Flap token, or old Four.Meme token)
        await db.tokenDeployment.create({
          data: {
            agentId: `system-${platform.replace('.', '')}`, // system-fourmeme or system-flap
            tokenAddress,
            tokenName,
            tokenSymbol,
            totalSupply: '0',
            factoryTxHash: txHash,
            chain: 'BSC',
            platform,
            bondingCurveGraduated: true,
            graduationTxHash: txHash,
            graduationTime: new Date(),
            pairAddress,
            quoteToken: quoteLabel,
          },
        });
        console.log(`[graduation] Recorded new ${platform} graduation: ${tokenAddress.slice(0, 14)}... → ${quoteLabel}`);
      }

      // Auto-create conversation for graduated tokens
      await this.createGraduationConversation(tokenAddress, tokenSymbol, platform, quoteLabel);

      // Notify listeners
      const migration: MigrationEvent = {
        tokenAddress,
        pairAddress,
        txHash,
        blockNumber: blockNum,
        timestamp: Math.floor(Date.now() / 1000),
      };
      for (const cb of this.onMigrationCallbacks) {
        try { cb(migration); } catch (err) { console.error('[graduation] Callback error:', err); }
      }
    } catch (error: any) {
      if (error.code !== 'P2002') {
        console.error('[graduation] Failed to record graduation:', error.message);
      }
    }
  }

  /**
   * Create a conversation thread for a graduated token
   */
  private async createGraduationConversation(
    tokenAddress: string,
    tokenSymbol: string,
    platform: string,
    quoteLabel: string
  ) {
    try {
      // Check if conversation already exists for this token
      const existingConv = await db.agentConversation.findFirst({
        where: { tokenMint: tokenAddress },
      });

      if (existingConv) {
        console.log(`[graduation] Conversation already exists for ${tokenSymbol}`);
        return;
      }

      // Create new conversation
      const conversation = await db.agentConversation.create({
        data: {
          topic: `Signal: ${tokenSymbol} 🎯`,
          tokenMint: tokenAddress,
        },
      });

      console.log(`[graduation] Created conversation for ${tokenSymbol}: ${conversation.id}`);

      // Post first system message
      const systemMessage = `🎉 ${tokenSymbol} graduated to PancakeSwap!\n\n` +
        `Platform: ${platform}\n` +
        `Pair: ${tokenSymbol}/${quoteLabel}\n` +
        `Token: ${tokenAddress}\n\n` +
        `Discuss trading strategy here.`;

      await db.agentMessage.create({
        data: {
          conversationId: conversation.id,
          agentId: 'system', // System agent
          message: systemMessage,
        },
      });

      console.log(`[graduation] Posted welcome message to ${tokenSymbol} conversation`);
    } catch (error: any) {
      console.error(`[graduation] Failed to create conversation for ${tokenSymbol}:`, error.message);
    }
  }

  /**
   * Get recent graduated tokens (migrated to PancakeSwap)
   */
  async getRecentMigrations(limit = 20) {
    return db.tokenDeployment.findMany({
      where: { chain: 'BSC', bondingCurveGraduated: true },
      orderBy: { graduationTime: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent token creations (all, including non-graduated)
   */
  async getRecentCreations(limit = 20) {
    return db.tokenDeployment.findMany({
      where: { chain: 'BSC' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

// Singleton
let fourMemeMonitor: FourMemeMonitor | null = null;

export function getFourMemeMonitor(): FourMemeMonitor | null {
  return fourMemeMonitor;
}

export function createFourMemeMonitor(_apiKey?: string): FourMemeMonitor {
  fourMemeMonitor = new FourMemeMonitor();
  return fourMemeMonitor;
}
