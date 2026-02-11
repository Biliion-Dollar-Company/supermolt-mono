/**
 * BSC Trade Monitor — Full Trade Pipeline (RPC-based)
 *
 * Uses direct RPC eth_getLogs to detect ERC-20 Transfer events for tracked BSC wallets.
 * No BSCscan API key required — uses PublicNode free BSC RPC.
 *
 * Creates AgentTrade + PaperTrade records, updates positions, FIFO PnL on sells.
 */

import { db } from '../lib/db';
import { Prisma } from '@prisma/client';
import { estimateBnbValue, getBscTokenPrice, getBnbPrice } from '../lib/bsc-prices';
import { PositionTracker } from './position-tracker';
import { autoCompleteOnboardingTask } from './onboarding.service';

const positionTracker = new PositionTracker(db);

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com';
const BLOCK_RANGE = 35; // ~1.75 min of BSC blocks (3s each)

// ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Known DEX routers on BSC (lowercase)
const PANCAKESWAP_V2_ROUTER = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
const PANCAKESWAP_V3_ROUTER = '0x1b81d678ffb9c0263b24a97847620c99d213eb14';
const FOUR_MEME_FACTORY = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
const WBNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

const DEX_ROUTERS = new Set([
  PANCAKESWAP_V2_ROUTER,
  PANCAKESWAP_V3_ROUTER,
  '0x13f4ea83d0bd40e75c8222255bc855a974568dd4', // PancakeSwap Universal Router
]);

interface RpcLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  blockTimestamp?: string;
}

interface TokenTransfer {
  tokenAddress: string; // ERC-20 contract
  from: string;
  to: string;
  value: bigint;
  txHash: string;
  blockNumber: number;
}

// Cache token metadata to avoid repeated RPC calls
const tokenMetadataCache = new Map<string, { name: string; symbol: string; decimals: number }>();

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
 * Pad address to 32-byte topic format
 */
function padAddress(addr: string): string {
  const clean = addr.toLowerCase().replace('0x', '');
  return '0x' + clean.padStart(64, '0');
}

/**
 * Extract address from 32-byte topic
 */
function unpadAddress(topic: string): string {
  return '0x' + topic.slice(26).toLowerCase();
}

/**
 * Fetch token metadata (name, symbol, decimals) via RPC eth_call
 */
async function getTokenMetadata(tokenAddress: string): Promise<{ name: string; symbol: string; decimals: number }> {
  const cached = tokenMetadataCache.get(tokenAddress);
  if (cached) return cached;

  let name = 'Unknown';
  let symbol = 'UNKNOWN';
  let decimals = 18;

  try {
    // Call name()
    const nameResult = await rpcCall('eth_call', [
      { to: tokenAddress, data: '0x06fdde03' }, // name() selector
      'latest',
    ]);
    if (nameResult && nameResult !== '0x') {
      name = decodeStringResult(nameResult);
    }
  } catch { /* name() failed */ }

  try {
    // Call symbol()
    const symbolResult = await rpcCall('eth_call', [
      { to: tokenAddress, data: '0x95d89b41' }, // symbol() selector
      'latest',
    ]);
    if (symbolResult && symbolResult !== '0x') {
      symbol = decodeStringResult(symbolResult);
    }
  } catch { /* symbol() failed */ }

  try {
    // Call decimals()
    const decimalsResult = await rpcCall('eth_call', [
      { to: tokenAddress, data: '0x313ce567' }, // decimals() selector
      'latest',
    ]);
    if (decimalsResult && decimalsResult !== '0x') {
      decimals = parseInt(decimalsResult, 16);
      if (isNaN(decimals) || decimals > 77) decimals = 18;
    }
  } catch { /* decimals() failed */ }

  const meta = { name, symbol, decimals };
  tokenMetadataCache.set(tokenAddress, meta);

  // Cap cache size
  if (tokenMetadataCache.size > 500) {
    const first = tokenMetadataCache.keys().next().value;
    if (first) tokenMetadataCache.delete(first);
  }

  return meta;
}

/**
 * Decode a string return value from eth_call
 */
function decodeStringResult(hex: string): string {
  const d = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (d.length < 128) return '';
  try {
    const offset = parseInt(d.slice(0, 64), 16) * 2;
    const length = parseInt(d.slice(offset, offset + 64), 16);
    const strHex = d.slice(offset + 64, offset + 64 + length * 2);
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export class BSCTradeMonitor {
  private trackedWallets: Map<string, string> = new Map(); // evmAddress (lowercase) → agentId
  private lastBlock: number = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  // Accept apiKey for backwards-compat but it's no longer needed for RPC
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  /**
   * Add a BSC wallet to track
   */
  addWallet(evmAddress: string, agentId: string) {
    const addr = evmAddress.toLowerCase();
    this.trackedWallets.set(addr, agentId);
    console.log(`[BSCMonitor] Tracking wallet ${addr.slice(0, 10)}... (agent ${agentId})`);
  }

  /**
   * Remove a BSC wallet from tracking
   */
  removeWallet(evmAddress: string) {
    this.trackedWallets.delete(evmAddress.toLowerCase());
  }

  /**
   * Start polling for all tracked wallets
   */
  async start() {
    // Load existing BSC agents into tracking
    const bscAgents = await db.tradingAgent.findMany({
      where: { chain: 'BSC', evmAddress: { not: null } },
      select: { id: true, evmAddress: true },
    });

    for (const agent of bscAgents) {
      if (agent.evmAddress) {
        this.addWallet(agent.evmAddress, agent.id);
      }
    }

    // Resume from persisted block or start from current
    try {
      const blockHex = await rpcCall('eth_blockNumber', []);
      const currentBlock = parseInt(blockHex, 16);

      const saved = await db.monitorState.findUnique({ where: { id: 'bsc-trade-monitor' } });
      if (saved && saved.lastBlock > 0) {
        this.lastBlock = saved.lastBlock;
        const gap = currentBlock - saved.lastBlock;
        console.log(`[BSCMonitor] Resuming from persisted block ${saved.lastBlock} (${gap} blocks behind, ~${Math.round(gap * 3 / 60)} min gap)`);
      } else {
        this.lastBlock = currentBlock;
        console.log(`[BSCMonitor] No saved state, starting from current block ${currentBlock}`);
      }
    } catch (error) {
      console.warn('[BSCMonitor] Could not get current block:', error);
      return;
    }

    console.log(`[BSCMonitor] Starting RPC-based monitor with ${this.trackedWallets.size} wallets from block ${this.lastBlock} (${BSC_RPC_URL})`);

    // Start polling loop
    this.pollTimer = setInterval(() => this.pollAllWallets(), POLL_INTERVAL_MS);
    this.pollTimer.unref();
  }

  /**
   * Stop the monitor
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[BSCMonitor] Stopped');
  }

  /**
   * Poll for new Transfer events involving any tracked wallet.
   *
   * Strategy: for each tracked wallet, query recent blocks for transactions
   * involving that wallet, then parse their receipts for Transfer events.
   *
   * NOTE: Free public BSC RPCs (PublicNode) require an `address` field in
   * eth_getLogs. Since we need to track transfers across ALL token contracts,
   * we query per-block transactions instead.
   */
  private async pollAllWallets() {
    if (this.trackedWallets.size === 0) return;

    try {
      // Get latest block
      const latestHex = await rpcCall('eth_blockNumber', []);
      const latestBlock = parseInt(latestHex, 16);

      if (latestBlock <= this.lastBlock) return;

      const fromBlock = this.lastBlock + 1;
      const toBlock = Math.min(latestBlock, fromBlock + BLOCK_RANGE - 1);

      // For each block in range, get full block with transactions
      // and check if any tx involves a tracked wallet
      const allTransfers: TokenTransfer[] = [];

      for (let block = fromBlock; block <= toBlock; block++) {
        const blockHex = '0x' + block.toString(16);
        const blockData = await rpcCall('eth_getBlockByNumber', [blockHex, true]);
        if (!blockData || !blockData.transactions) continue;

        // Filter transactions involving tracked wallets
        for (const tx of blockData.transactions) {
          const from = (tx.from || '').toLowerCase();
          const to = (tx.to || '').toLowerCase();

          const fromIsTracked = this.trackedWallets.has(from);
          const toIsTracked = this.trackedWallets.has(to);

          if (!fromIsTracked && !toIsTracked) continue;

          // Get receipt to parse Transfer events
          try {
            const receipt = await rpcCall('eth_getTransactionReceipt', [tx.hash]);
            if (!receipt || !receipt.logs) continue;

            for (const log of receipt.logs) {
              if (!log.topics || log.topics.length < 3) continue;
              if (log.topics[0] !== TRANSFER_TOPIC) continue;

              const tokenAddress = (log.address || '').toLowerCase();
              if (tokenAddress === WBNB) continue; // Skip WBNB

              const transferFrom = unpadAddress(log.topics[1]);
              const transferTo = unpadAddress(log.topics[2]);
              const value = BigInt(log.data || '0x0');

              // Only include if our tracked wallet is the from or to
              if (this.trackedWallets.has(transferFrom) || this.trackedWallets.has(transferTo)) {
                allTransfers.push({
                  tokenAddress,
                  from: transferFrom,
                  to: transferTo,
                  value,
                  txHash: tx.hash,
                  blockNumber: block,
                });
              }
            }
          } catch {
            // Receipt fetch failed for this tx, skip
          }
        }
      }

      this.lastBlock = toBlock;
      db.monitorState.upsert({
        where: { id: 'bsc-trade-monitor' },
        create: { id: 'bsc-trade-monitor', lastBlock: toBlock },
        update: { lastBlock: toBlock },
      }).catch(() => {}); // fire-and-forget

      if (allTransfers.length === 0) return;

      // Group by txHash to detect multi-token swaps
      const txGroups = new Map<string, TokenTransfer[]>();
      for (const t of allTransfers) {
        const group = txGroups.get(t.txHash) || [];
        // Deduplicate (same log can appear in both incoming + outgoing queries for token-to-token)
        if (!group.some((g) => g.tokenAddress === t.tokenAddress && g.from === t.from && g.to === t.to)) {
          group.push(t);
        }
        txGroups.set(t.txHash, group);
      }

      // Process each transaction group
      for (const [txHash, transfers] of txGroups) {
        await this.processTransactionGroup(txHash, transfers);
      }
    } catch (error) {
      console.error('[BSCMonitor] Poll error:', error);
    }
  }

  /**
   * Process a group of token transfers from the same transaction.
   */
  private async processTransactionGroup(txHash: string, transfers: TokenTransfer[]) {
    // Check if we already recorded this trade
    const existing = await db.agentTrade.findUnique({
      where: { signature: txHash },
    });
    if (existing) return;

    // Find which tracked wallet is involved
    let walletAddress = '';
    let agentId = '';
    for (const t of transfers) {
      if (this.trackedWallets.has(t.from)) {
        walletAddress = t.from;
        agentId = this.trackedWallets.get(t.from)!;
        break;
      }
      if (this.trackedWallets.has(t.to)) {
        walletAddress = t.to;
        agentId = this.trackedWallets.get(t.to)!;
        break;
      }
    }
    if (!agentId) return;

    // Separate incoming vs outgoing
    const incoming = transfers.filter((t) => t.to === walletAddress);
    const outgoing = transfers.filter((t) => t.from === walletAddress);

    // Check for DEX router involvement
    const isDexSwap = transfers.some((t) =>
      DEX_ROUTERS.has(t.from) || DEX_ROUTERS.has(t.to)
    );

    const bnbPrice = await getBnbPrice();

    if (incoming.length > 0 && outgoing.length > 0) {
      await this.handleTokenToTokenSwap(txHash, incoming, outgoing, walletAddress, agentId, bnbPrice);
    } else if (incoming.length > 0) {
      for (const t of incoming) {
        await this.handleBuy(txHash, t, agentId, bnbPrice, isDexSwap);
      }
    } else if (outgoing.length > 0) {
      for (const t of outgoing) {
        await this.handleSell(txHash, t, agentId, bnbPrice, isDexSwap);
      }
    }
  }

  /**
   * Handle a BUY trade
   */
  private async handleBuy(
    txHash: string,
    transfer: TokenTransfer,
    agentId: string,
    bnbPrice: number,
    isDexSwap: boolean
  ) {
    const tokenMint = transfer.tokenAddress;
    const meta = await getTokenMetadata(tokenMint);
    const tokenAmount = Number(transfer.value) / Math.pow(10, meta.decimals);

    if (tokenAmount <= 0) return;

    let bnbValue = 0;
    let tokenPriceUsd = 0;
    try {
      const price = await getBscTokenPrice(tokenMint);
      if (price) {
        tokenPriceUsd = price.priceUsd;
        bnbValue = price.priceBnb * tokenAmount;
      } else {
        bnbValue = await estimateBnbValue(tokenMint, tokenAmount);
      }
    } catch { /* price fetch failed */ }

    try {
      await db.agentTrade.create({
        data: {
          agentId, tokenMint, tokenSymbol: meta.symbol, tokenName: meta.name,
          action: 'BUY', chain: 'BSC', tokenAmount, solAmount: bnbValue,
          signature: txHash,
        },
      });

      await db.paperTrade.create({
        data: {
          agentId, tokenMint, tokenSymbol: meta.symbol, tokenName: meta.name,
          action: 'BUY', chain: 'BSC',
          entryPrice: bnbPrice, tokenPrice: tokenPriceUsd || null,
          amount: bnbValue, tokenAmount,
          signalSource: isDexSwap ? 'pancakeswap' : 'transfer',
          confidence: isDexSwap ? 100 : 50,
          metadata: { source: 'bsc-monitor', txHash, isDexSwap } as Record<string, string | number | boolean>,
        },
      });

      await positionTracker.onBuy(agentId, tokenMint, meta.symbol, meta.name, tokenAmount, tokenPriceUsd);

      await db.tradingAgent.update({
        where: { id: agentId },
        data: { totalTrades: { increment: 1 } },
      });

      autoCompleteOnboardingTask(agentId, 'FIRST_TRADE', { tradeId: txHash, tokenSymbol: meta.symbol }).catch(() => {});

      console.log(`[BSCMonitor] BUY ${tokenAmount.toFixed(2)} ${meta.symbol} (≈${bnbValue.toFixed(4)} BNB) — ${txHash.slice(0, 10)}...`);
    } catch (error: any) {
      if (error.code === 'P2002') return;
      console.error(`[BSCMonitor] BUY error:`, error.message);
    }
  }

  /**
   * Handle a SELL trade
   */
  private async handleSell(
    txHash: string,
    transfer: TokenTransfer,
    agentId: string,
    bnbPrice: number,
    isDexSwap: boolean
  ) {
    const tokenMint = transfer.tokenAddress;
    const meta = await getTokenMetadata(tokenMint);
    const tokenAmount = Number(transfer.value) / Math.pow(10, meta.decimals);

    if (tokenAmount <= 0) return;

    let bnbValue = 0;
    try {
      const price = await getBscTokenPrice(tokenMint);
      if (price) bnbValue = price.priceBnb * tokenAmount;
      else bnbValue = await estimateBnbValue(tokenMint, tokenAmount);
    } catch { /* price fetch failed */ }

    try {
      await db.agentTrade.create({
        data: {
          agentId, tokenMint, tokenSymbol: meta.symbol, tokenName: meta.name,
          action: 'SELL', chain: 'BSC', tokenAmount, solAmount: bnbValue,
          signature: txHash,
        },
      });

      await positionTracker.onSell(agentId, tokenMint, tokenAmount, 0);
      await this.closePaperTradesForSell(agentId, tokenMint, tokenAmount, bnbValue, bnbPrice);

      console.log(`[BSCMonitor] SELL ${tokenAmount.toFixed(2)} ${meta.symbol} (≈${bnbValue.toFixed(4)} BNB) — ${txHash.slice(0, 10)}...`);
    } catch (error: any) {
      if (error.code === 'P2002') return;
      console.error(`[BSCMonitor] SELL error:`, error.message);
    }
  }

  /**
   * Handle a token-to-token swap
   */
  private async handleTokenToTokenSwap(
    txHash: string,
    incoming: TokenTransfer[],
    outgoing: TokenTransfer[],
    walletAddress: string,
    agentId: string,
    bnbPrice: number
  ) {
    const sellTransfer = outgoing[0];
    const buyTransfer = incoming[0];

    const sellMeta = await getTokenMetadata(sellTransfer.tokenAddress);
    const buyMeta = await getTokenMetadata(buyTransfer.tokenAddress);
    const sellAmount = Number(sellTransfer.value) / Math.pow(10, sellMeta.decimals);
    const buyAmount = Number(buyTransfer.value) / Math.pow(10, buyMeta.decimals);

    let bnbValue = 0;
    try {
      const sellPrice = await getBscTokenPrice(sellTransfer.tokenAddress);
      if (sellPrice) bnbValue = sellPrice.priceBnb * sellAmount;
      else bnbValue = await estimateBnbValue(sellTransfer.tokenAddress, sellAmount);
    } catch { /* price fetch failed */ }

    let buyTokenPriceUsd = 0;
    try {
      const buyPrice = await getBscTokenPrice(buyTransfer.tokenAddress);
      if (buyPrice) buyTokenPriceUsd = buyPrice.priceUsd;
    } catch { /* price fetch failed */ }

    console.log(`[BSCMonitor] Token-to-token: ${sellAmount.toFixed(2)} ${sellMeta.symbol} → ${buyAmount.toFixed(2)} ${buyMeta.symbol}`);

    try {
      // SELL side AgentTrade
      await db.agentTrade.create({
        data: {
          agentId, tokenMint: sellTransfer.tokenAddress,
          tokenSymbol: sellMeta.symbol, tokenName: sellMeta.name,
          action: 'SELL', chain: 'BSC', tokenAmount: sellAmount, solAmount: bnbValue,
          signature: txHash,
        },
      });

      // BUY side AgentTrade
      try {
        await db.agentTrade.create({
          data: {
            agentId, tokenMint: buyTransfer.tokenAddress,
            tokenSymbol: buyMeta.symbol, tokenName: buyMeta.name,
            action: 'BUY', chain: 'BSC', tokenAmount: buyAmount, solAmount: bnbValue,
            signature: `${txHash}-buy`,
          },
        });
      } catch (e: any) {
        if (e.code !== 'P2002') console.error('[BSCMonitor] BUY side error:', e.message);
      }

      // SELL side: position close + FIFO PnL
      await positionTracker.onSell(agentId, sellTransfer.tokenAddress, sellAmount, 0);
      await this.closePaperTradesForSell(agentId, sellTransfer.tokenAddress, sellAmount, bnbValue, bnbPrice);

      // BUY side: PaperTrade + position open
      await db.paperTrade.create({
        data: {
          agentId, tokenMint: buyTransfer.tokenAddress,
          tokenSymbol: buyMeta.symbol, tokenName: buyMeta.name,
          action: 'BUY', chain: 'BSC',
          entryPrice: bnbPrice, tokenPrice: buyTokenPriceUsd || null,
          amount: bnbValue, tokenAmount: buyAmount,
          signalSource: 'pancakeswap', confidence: 100,
          metadata: { source: 'bsc-monitor', txHash, type: 'token-to-token' } as Record<string, string | number | boolean>,
        },
      });

      await positionTracker.onBuy(agentId, buyTransfer.tokenAddress, buyMeta.symbol, buyMeta.name, buyAmount, buyTokenPriceUsd);

      await db.tradingAgent.update({
        where: { id: agentId },
        data: { totalTrades: { increment: 2 } },
      });
    } catch (error: any) {
      if (error.code === 'P2002') return;
      console.error(`[BSCMonitor] Token-to-token error:`, error.message);
    }
  }

  /**
   * FIFO close PaperTrades for a sell — atomic Prisma $transaction
   */
  private async closePaperTradesForSell(
    agentId: string,
    tokenMint: string,
    tokensSold: number,
    bnbReceived: number,
    currentBnbPrice: number
  ): Promise<void> {
    if (tokensSold <= 0) return;

    const openTrades = await db.paperTrade.findMany({
      where: { agentId, tokenMint, status: 'OPEN' },
      orderBy: { openedAt: 'asc' },
    });

    if (openTrades.length === 0) {
      console.log(`[BSCMonitor] No OPEN PaperTrades for ${tokenMint.slice(0, 10)}... — no PnL to calculate`);
      return;
    }

    await db.$transaction(async (tx) => {
      let remaining = tokensSold;

      for (const trade of openTrades) {
        if (remaining <= 0) break;

        const tradeTokens = parseFloat((trade.tokenAmount ?? 0).toString());
        if (tradeTokens <= 0) continue;

        const tokensToClose = Math.min(remaining, tradeTokens);
        const fraction = tokensToClose / tradeTokens;

        const bnbSpent = parseFloat(trade.amount.toString());
        const bnbPriceAtBuy = parseFloat(trade.entryPrice.toString());
        const costBasisUSD = bnbSpent * fraction * bnbPriceAtBuy;
        const fractionOfSell = tokensSold > 0 ? tokensToClose / tokensSold : 0;
        const proceedsUSD = bnbReceived * fractionOfSell * currentBnbPrice;
        const pnl = costBasisUSD > 0 ? proceedsUSD - costBasisUSD : 0;
        const pnlPercent = costBasisUSD > 0 ? (pnl / costBasisUSD) * 100 : 0;

        if (fraction >= 0.999) {
          await tx.paperTrade.update({
            where: { id: trade.id },
            data: { exitPrice: currentBnbPrice, pnl, pnlPercent, status: 'CLOSED', closedAt: new Date() },
          });
        } else {
          const remainderFraction = 1 - fraction;
          await tx.paperTrade.update({
            where: { id: trade.id },
            data: { tokenAmount: tradeTokens * remainderFraction, amount: bnbSpent * remainderFraction },
          });

          await tx.paperTrade.create({
            data: {
              agentId: trade.agentId, tokenMint: trade.tokenMint,
              tokenSymbol: trade.tokenSymbol, tokenName: trade.tokenName,
              action: trade.action, chain: 'BSC',
              entryPrice: parseFloat(trade.entryPrice.toString()),
              amount: bnbSpent * fraction, tokenAmount: tokensToClose,
              exitPrice: currentBnbPrice, pnl, pnlPercent,
              status: 'CLOSED', closedAt: new Date(), openedAt: trade.openedAt,
              signalSource: trade.signalSource, confidence: trade.confidence,
              metadata: (trade.metadata ?? {}) as Record<string, string | number | boolean | null>,
            },
          });
        }

        remaining -= tokensToClose;
      }

      // Recalculate agent stats
      const closedFilter = { agentId, status: 'CLOSED' as const };
      const stats = await tx.paperTrade.aggregate({ where: closedFilter, _count: true, _sum: { pnl: true } });
      const winCount = await tx.paperTrade.count({ where: { ...closedFilter, pnl: { gt: 0 } } });
      const totalTrades = stats._count;
      const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

      await tx.tradingAgent.update({
        where: { id: agentId },
        data: { totalTrades, winRate, totalPnl: stats._sum.pnl ?? 0 },
      });
    });
  }
}

// Singleton instance
let bscMonitor: BSCTradeMonitor | null = null;

export function getBSCMonitor(): BSCTradeMonitor | null {
  return bscMonitor;
}

export function createBSCMonitor(apiKey?: string): BSCTradeMonitor {
  bscMonitor = new BSCTradeMonitor(apiKey);
  return bscMonitor;
}
