/**
 * Base Chain Trade Monitor — Full Trade Pipeline (RPC-based)
 *
 * Uses direct RPC eth_getLogs to detect ERC-20 Transfer events for tracked Base wallets.
 * Creates AgentTrade + PaperTrade records, updates positions, FIFO PnL on sells.
 *
 * Base has 2-second block times so we poll every 6s with a 3-block range.
 */

import { db } from '../lib/db';
import { estimateEthValue, getBaseTokenPrice, getEthPrice } from '../lib/base-prices';
import { PositionTracker } from './position-tracker';
import { autoCompleteOnboardingTask } from './onboarding.service';
import { evaluateTriggers } from './trigger-engine';

const positionTracker = new PositionTracker(db);

const POLL_INTERVAL_MS = 6_000; // 6 seconds (Base = 2s blocks)
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const BLOCK_RANGE = 3; // ~6 seconds of Base blocks (2s each)

// ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Known DEX routers on Base (lowercase)
const UNISWAP_UNIVERSAL_ROUTER = '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad';
const AERODROME_ROUTER = '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43';
const WETH_BASE = '0x4200000000000000000000000000000000000006';

const DEX_ROUTERS = new Set([
  UNISWAP_UNIVERSAL_ROUTER,
  AERODROME_ROUTER,
  '0x2626664c2603336e57b271c5c0b26f421741e481', // Uniswap V3 SwapRouter02
]);

// Exponential backoff state
let consecutiveErrors = 0;
const MAX_BACKOFF_MS = 60_000;

interface RpcLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  blockTimestamp?: string;
}

interface TokenTransfer {
  tokenAddress: string;
  from: string;
  to: string;
  value: bigint;
  txHash: string;
  blockNumber: number;
}

// Cache token metadata to avoid repeated RPC calls
const tokenMetadataCache = new Map<string, { name: string; symbol: string; decimals: number }>();

/**
 * Call Base RPC via fetch
 */
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
    const nameResult = await rpcCall('eth_call', [
      { to: tokenAddress, data: '0x06fdde03' },
      'latest',
    ]);
    if (nameResult && nameResult !== '0x') {
      name = decodeStringResult(nameResult);
    }
  } catch { /* name() failed */ }

  try {
    const symbolResult = await rpcCall('eth_call', [
      { to: tokenAddress, data: '0x95d89b41' },
      'latest',
    ]);
    if (symbolResult && symbolResult !== '0x') {
      symbol = decodeStringResult(symbolResult);
    }
  } catch { /* symbol() failed */ }

  try {
    const decimalsResult = await rpcCall('eth_call', [
      { to: tokenAddress, data: '0x313ce567' },
      'latest',
    ]);
    if (decimalsResult && decimalsResult !== '0x') {
      decimals = parseInt(decimalsResult, 16);
      if (isNaN(decimals) || decimals > 77) decimals = 18;
    }
  } catch { /* decimals() failed */ }

  const meta = { name, symbol, decimals };
  tokenMetadataCache.set(tokenAddress, meta);

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

export class BaseTradeMonitor {
  private trackedWallets: Map<string, string> = new Map(); // evmAddress (lowercase) -> agentId
  private lastBlock: number = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Add a Base wallet to track
   */
  addWallet(evmAddress: string, agentId: string) {
    const addr = evmAddress.toLowerCase();
    this.trackedWallets.set(addr, agentId);
    console.log(`[Base Monitor] Tracking wallet ${addr.slice(0, 10)}... (agent ${agentId})`);
  }

  /**
   * Remove a Base wallet from tracking
   */
  removeWallet(evmAddress: string) {
    this.trackedWallets.delete(evmAddress.toLowerCase());
  }

  /**
   * Start polling for all tracked wallets
   */
  async start() {
    // Load existing Base agents into tracking
    const baseAgents = await db.tradingAgent.findMany({
      where: { chain: 'BASE', evmAddress: { not: null } },
      select: { id: true, evmAddress: true },
    });

    for (const agent of baseAgents) {
      if (agent.evmAddress) {
        this.addWallet(agent.evmAddress, agent.id);
      }
    }

    // Resume from persisted block or start from current
    try {
      const blockHex = await rpcCall('eth_blockNumber', []);
      const currentBlock = parseInt(blockHex, 16);

      const saved = await db.monitorState.findUnique({ where: { id: 'base-trade-monitor' } });
      if (saved && saved.lastBlock > 0) {
        this.lastBlock = saved.lastBlock;
        const gap = currentBlock - saved.lastBlock;
        console.log(`[Base Monitor] Resuming from persisted block ${saved.lastBlock} (${gap} blocks behind, ~${Math.round(gap * 2 / 60)} min gap)`);
      } else {
        this.lastBlock = currentBlock;
        console.log(`[Base Monitor] No saved state, starting from current block ${currentBlock}`);
      }
    } catch (error) {
      console.warn('[Base Monitor] Could not get current block:', error);
      return;
    }

    console.log(`[Base Monitor] Started polling with ${this.trackedWallets.size} wallets from block ${this.lastBlock} (${BASE_RPC_URL})`);

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
    console.log('[Base Monitor] Stopped');
  }

  /**
   * Poll for new Transfer events involving any tracked wallet.
   */
  private async pollAllWallets() {
    if (this.trackedWallets.size === 0) return;

    try {
      const latestHex = await rpcCall('eth_blockNumber', []);
      const latestBlock = parseInt(latestHex, 16);

      if (latestBlock <= this.lastBlock) return;

      const fromBlock = this.lastBlock + 1;
      const toBlock = Math.min(latestBlock, fromBlock + BLOCK_RANGE - 1);

      const allTransfers: TokenTransfer[] = [];

      for (let block = fromBlock; block <= toBlock; block++) {
        const blockHex = '0x' + block.toString(16);
        const blockData = await rpcCall('eth_getBlockByNumber', [blockHex, true]);
        if (!blockData || !blockData.transactions) continue;

        for (const tx of blockData.transactions) {
          const from = (tx.from || '').toLowerCase();
          const to = (tx.to || '').toLowerCase();

          const fromIsTracked = this.trackedWallets.has(from);
          const toIsTracked = this.trackedWallets.has(to);

          if (!fromIsTracked && !toIsTracked) continue;

          try {
            const receipt = await rpcCall('eth_getTransactionReceipt', [tx.hash]);
            if (!receipt || !receipt.logs) continue;

            for (const log of receipt.logs) {
              if (!log.topics || log.topics.length < 3) continue;
              if (log.topics[0] !== TRANSFER_TOPIC) continue;

              const tokenAddress = (log.address || '').toLowerCase();
              if (tokenAddress === WETH_BASE) continue; // Skip WETH

              const transferFrom = unpadAddress(log.topics[1]);
              const transferTo = unpadAddress(log.topics[2]);
              const value = BigInt(log.data || '0x0');

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
        where: { id: 'base-trade-monitor' },
        create: { id: 'base-trade-monitor', lastBlock: toBlock },
        update: { lastBlock: toBlock },
      }).catch(() => {}); // fire-and-forget

      // Reset backoff on success
      consecutiveErrors = 0;

      if (allTransfers.length === 0) return;

      // Group by txHash to detect multi-token swaps
      const txGroups = new Map<string, TokenTransfer[]>();
      for (const t of allTransfers) {
        const group = txGroups.get(t.txHash) || [];
        if (!group.some((g) => g.tokenAddress === t.tokenAddress && g.from === t.from && g.to === t.to)) {
          group.push(t);
        }
        txGroups.set(t.txHash, group);
      }

      for (const [txHash, transfers] of txGroups) {
        await this.processTransactionGroup(txHash, transfers);
      }
    } catch (error) {
      consecutiveErrors++;
      const backoff = Math.min(1000 * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS);
      console.error(`[Base Monitor] Poll error (retry in ${backoff}ms):`, error);
    }
  }

  /**
   * Process a group of token transfers from the same transaction.
   */
  private async processTransactionGroup(txHash: string, transfers: TokenTransfer[]) {
    const existing = await db.agentTrade.findUnique({
      where: { signature: txHash },
    });
    if (existing) return;

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

    const incoming = transfers.filter((t) => t.to === walletAddress);
    const outgoing = transfers.filter((t) => t.from === walletAddress);

    const isDexSwap = transfers.some((t) =>
      DEX_ROUTERS.has(t.from) || DEX_ROUTERS.has(t.to)
    );

    const ethPrice = await getEthPrice();

    if (incoming.length > 0 && outgoing.length > 0) {
      await this.handleTokenToTokenSwap(txHash, incoming, outgoing, walletAddress, agentId, ethPrice);
    } else if (incoming.length > 0) {
      for (const t of incoming) {
        await this.handleBuy(txHash, t, agentId, ethPrice, isDexSwap, walletAddress);
      }
    } else if (outgoing.length > 0) {
      for (const t of outgoing) {
        await this.handleSell(txHash, t, agentId, ethPrice, isDexSwap);
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
    ethPrice: number,
    isDexSwap: boolean,
    walletAddress?: string
  ) {
    const tokenMint = transfer.tokenAddress;
    const meta = await getTokenMetadata(tokenMint);
    const tokenAmount = Number(transfer.value) / Math.pow(10, meta.decimals);

    if (tokenAmount <= 0) return;

    let ethValue = 0;
    let tokenPriceUsd = 0;
    try {
      const price = await getBaseTokenPrice(tokenMint);
      if (price) {
        tokenPriceUsd = price.priceUsd;
        ethValue = price.priceEth * tokenAmount;
      } else {
        ethValue = await estimateEthValue(tokenMint, tokenAmount);
      }
    } catch { /* price fetch failed */ }

    try {
      await db.agentTrade.create({
        data: {
          agentId, tokenMint, tokenSymbol: meta.symbol, tokenName: meta.name,
          action: 'BUY', chain: 'BASE', tokenAmount, solAmount: ethValue,
          signature: txHash,
        },
      });

      await db.paperTrade.create({
        data: {
          agentId, tokenMint, tokenSymbol: meta.symbol, tokenName: meta.name,
          action: 'BUY', chain: 'BASE',
          entryPrice: ethPrice, tokenPrice: tokenPriceUsd || null,
          amount: ethValue, tokenAmount,
          signalSource: isDexSwap ? 'uniswap' : 'transfer',
          confidence: isDexSwap ? 100 : 50,
          metadata: { source: 'base-monitor', txHash, isDexSwap } as Record<string, string | number | boolean>,
        },
      });

      await positionTracker.onBuy(agentId, tokenMint, meta.symbol, meta.name, tokenAmount, tokenPriceUsd);

      await db.tradingAgent.update({
        where: { id: agentId },
        data: { totalTrades: { increment: 1 } },
      });

      autoCompleteOnboardingTask(agentId, 'FIRST_TRADE', { tradeId: txHash, tokenSymbol: meta.symbol }).catch(() => {});

      if (walletAddress) {
        evaluateTriggers({
          walletAddress,
          tokenMint,
          tokenSymbol: meta.symbol,
          action: 'BUY',
          amount: ethValue,
          chain: 'BASE',
          signature: txHash,
        }).catch((err) => console.error('[TriggerEngine] Base evaluation failed:', err));
      }

      console.log(`[Base Monitor] BUY ${tokenAmount.toFixed(2)} ${meta.symbol} (~${ethValue.toFixed(4)} ETH) - ${txHash.slice(0, 10)}...`);
    } catch (error: any) {
      if (error.code === 'P2002') return;
      console.error(`[Base Monitor] BUY error:`, error.message);
    }
  }

  /**
   * Handle a SELL trade
   */
  private async handleSell(
    txHash: string,
    transfer: TokenTransfer,
    agentId: string,
    ethPrice: number,
    isDexSwap: boolean
  ) {
    const tokenMint = transfer.tokenAddress;
    const meta = await getTokenMetadata(tokenMint);
    const tokenAmount = Number(transfer.value) / Math.pow(10, meta.decimals);

    if (tokenAmount <= 0) return;

    let ethValue = 0;
    try {
      const price = await getBaseTokenPrice(tokenMint);
      if (price) ethValue = price.priceEth * tokenAmount;
      else ethValue = await estimateEthValue(tokenMint, tokenAmount);
    } catch { /* price fetch failed */ }

    try {
      await db.agentTrade.create({
        data: {
          agentId, tokenMint, tokenSymbol: meta.symbol, tokenName: meta.name,
          action: 'SELL', chain: 'BASE', tokenAmount, solAmount: ethValue,
          signature: txHash,
        },
      });

      await positionTracker.onSell(agentId, tokenMint, tokenAmount, 0);
      await this.closePaperTradesForSell(agentId, tokenMint, tokenAmount, ethValue, ethPrice);

      console.log(`[Base Monitor] SELL ${tokenAmount.toFixed(2)} ${meta.symbol} (~${ethValue.toFixed(4)} ETH) - ${txHash.slice(0, 10)}...`);
    } catch (error: any) {
      if (error.code === 'P2002') return;
      console.error(`[Base Monitor] SELL error:`, error.message);
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
    ethPrice: number
  ) {
    const sellTransfer = outgoing[0];
    const buyTransfer = incoming[0];

    const sellMeta = await getTokenMetadata(sellTransfer.tokenAddress);
    const buyMeta = await getTokenMetadata(buyTransfer.tokenAddress);
    const sellAmount = Number(sellTransfer.value) / Math.pow(10, sellMeta.decimals);
    const buyAmount = Number(buyTransfer.value) / Math.pow(10, buyMeta.decimals);

    let ethValue = 0;
    try {
      const sellPrice = await getBaseTokenPrice(sellTransfer.tokenAddress);
      if (sellPrice) ethValue = sellPrice.priceEth * sellAmount;
      else ethValue = await estimateEthValue(sellTransfer.tokenAddress, sellAmount);
    } catch { /* price fetch failed */ }

    let buyTokenPriceUsd = 0;
    try {
      const buyPrice = await getBaseTokenPrice(buyTransfer.tokenAddress);
      if (buyPrice) buyTokenPriceUsd = buyPrice.priceUsd;
    } catch { /* price fetch failed */ }

    console.log(`[Base Monitor] Token-to-token: ${sellAmount.toFixed(2)} ${sellMeta.symbol} -> ${buyAmount.toFixed(2)} ${buyMeta.symbol}`);

    try {
      // SELL side AgentTrade
      await db.agentTrade.create({
        data: {
          agentId, tokenMint: sellTransfer.tokenAddress,
          tokenSymbol: sellMeta.symbol, tokenName: sellMeta.name,
          action: 'SELL', chain: 'BASE', tokenAmount: sellAmount, solAmount: ethValue,
          signature: txHash,
        },
      });

      // BUY side AgentTrade
      try {
        await db.agentTrade.create({
          data: {
            agentId, tokenMint: buyTransfer.tokenAddress,
            tokenSymbol: buyMeta.symbol, tokenName: buyMeta.name,
            action: 'BUY', chain: 'BASE', tokenAmount: buyAmount, solAmount: ethValue,
            signature: `${txHash}-buy`,
          },
        });
      } catch (e: any) {
        if (e.code !== 'P2002') console.error('[Base Monitor] BUY side error:', e.message);
      }

      // SELL side: position close + FIFO PnL
      await positionTracker.onSell(agentId, sellTransfer.tokenAddress, sellAmount, 0);
      await this.closePaperTradesForSell(agentId, sellTransfer.tokenAddress, sellAmount, ethValue, ethPrice);

      // BUY side: PaperTrade + position open
      await db.paperTrade.create({
        data: {
          agentId, tokenMint: buyTransfer.tokenAddress,
          tokenSymbol: buyMeta.symbol, tokenName: buyMeta.name,
          action: 'BUY', chain: 'BASE',
          entryPrice: ethPrice, tokenPrice: buyTokenPriceUsd || null,
          amount: ethValue, tokenAmount: buyAmount,
          signalSource: 'uniswap', confidence: 100,
          metadata: { source: 'base-monitor', txHash, type: 'token-to-token' } as Record<string, string | number | boolean>,
        },
      });

      await positionTracker.onBuy(agentId, buyTransfer.tokenAddress, buyMeta.symbol, buyMeta.name, buyAmount, buyTokenPriceUsd);

      await db.tradingAgent.update({
        where: { id: agentId },
        data: { totalTrades: { increment: 2 } },
      });

      // Fire trigger engine for the BUY side
      evaluateTriggers({
        walletAddress,
        tokenMint: buyTransfer.tokenAddress,
        tokenSymbol: buyMeta.symbol,
        action: 'BUY',
        amount: ethValue,
        chain: 'BASE',
        signature: `${txHash}-buy`,
      }).catch((err) => console.error('[TriggerEngine] Base token-to-token evaluation failed:', err));
    } catch (error: any) {
      if (error.code === 'P2002') return;
      console.error(`[Base Monitor] Token-to-token error:`, error.message);
    }
  }

  /**
   * FIFO close PaperTrades for a sell — atomic Prisma $transaction
   */
  private async closePaperTradesForSell(
    agentId: string,
    tokenMint: string,
    tokensSold: number,
    ethReceived: number,
    currentEthPrice: number
  ): Promise<void> {
    if (tokensSold <= 0) return;

    const openTrades = await db.paperTrade.findMany({
      where: { agentId, tokenMint, status: 'OPEN' },
      orderBy: { openedAt: 'asc' },
    });

    if (openTrades.length === 0) {
      console.log(`[Base Monitor] No OPEN PaperTrades for ${tokenMint.slice(0, 10)}... — no PnL to calculate`);
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

        const ethSpent = parseFloat(trade.amount.toString());
        const ethPriceAtBuy = parseFloat(trade.entryPrice.toString());
        const costBasisUSD = ethSpent * fraction * ethPriceAtBuy;
        const fractionOfSell = tokensSold > 0 ? tokensToClose / tokensSold : 0;
        const proceedsUSD = ethReceived * fractionOfSell * currentEthPrice;
        const pnl = costBasisUSD > 0 ? proceedsUSD - costBasisUSD : 0;
        const pnlPercent = costBasisUSD > 0 ? (pnl / costBasisUSD) * 100 : 0;

        if (fraction >= 0.999) {
          await tx.paperTrade.update({
            where: { id: trade.id },
            data: { exitPrice: currentEthPrice, pnl, pnlPercent, status: 'CLOSED', closedAt: new Date() },
          });
        } else {
          const remainderFraction = 1 - fraction;
          await tx.paperTrade.update({
            where: { id: trade.id },
            data: { tokenAmount: tradeTokens * remainderFraction, amount: ethSpent * remainderFraction },
          });

          await tx.paperTrade.create({
            data: {
              agentId: trade.agentId, tokenMint: trade.tokenMint,
              tokenSymbol: trade.tokenSymbol, tokenName: trade.tokenName,
              action: trade.action, chain: 'BASE',
              entryPrice: parseFloat(trade.entryPrice.toString()),
              amount: ethSpent * fraction, tokenAmount: tokensToClose,
              exitPrice: currentEthPrice, pnl, pnlPercent,
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
let baseMonitor: BaseTradeMonitor | null = null;

export function getBaseMonitor(): BaseTradeMonitor | null {
  return baseMonitor;
}

export function createBaseMonitor(): BaseTradeMonitor {
  baseMonitor = new BaseTradeMonitor();
  return baseMonitor;
}
