/**
 * Agent Trading Loop — Kraken Edition
 *
 * Autonomous trading system that makes agents trade every 15-30 minutes.
 * Uses Kraken REST API for live market signals instead of Birdeye/DexScreener.
 * ERC-8004 validation artifacts are emitted after each paper trade (fire-and-forget).
 *
 * The conversation reactor (agent-signal-reactor.ts) automatically generates
 * conversations when trades are created.
 */

import { db } from '../lib/db';
import { scoreTokenForAgent, type TokenData } from '../lib/token-scorer';
import {
  getTickerData,
  placeOrder,
  closePosition,
  KRAKEN_DEFAULT_PAIRS,
  type KrakenTickerData,
} from './kraken-cli.service';
import { proveTradeIntent } from './erc8004-validation.service';
import { submitTradeFeedback } from './erc8004-reputation.service';

// Position size in USD per trade (replaces positionSizeSOL for Kraken)
const KRAKEN_POSITION_USD = parseFloat(process.env.KRAKEN_POSITION_USD || '150');

// ── Configuration ────────────────────────────────────────

interface TradingLoopConfig {
  intervalMinutes: number;
  agentsPerCycle: number;
  minConfidence: number;
  maxTradesPerCycle: number;
  positionSizeSOL: number; // Kept for API compatibility; maps to KRAKEN_POSITION_USD internally
}

const DEFAULT_CONFIG: TradingLoopConfig = {
  intervalMinutes: 20,
  agentsPerCycle: 3,
  minConfidence: 70,
  maxTradesPerCycle: 5,
  positionSizeSOL: 1.5,
};

// ── State ────────────────────────────────────────────────

let loopInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let cycleCount = 0;
let totalTradesCreated = 0;

// ── Market Signal Fetching (Kraken) ──────────────────────

/**
 * Fetch live market signals from Kraken REST API.
 * Maps KrakenTickerData → TokenData so the existing LLM scoring layer
 * works without any changes (scoring is chain-agnostic).
 */
async function fetchKrakenMarketSignals(): Promise<TokenData[]> {
  try {
    const tickers = await getTickerData(KRAKEN_DEFAULT_PAIRS);
    const tokens = tickers.map((t): TokenData => krakenTickerToTokenData(t));
    const valid = tokens.filter((t) => t.priceUsd > 0);
    console.log(`[TradingLoop] Kraken: ${valid.length} market signals (${KRAKEN_DEFAULT_PAIRS.join(', ')})`);
    return valid;
  } catch (err) {
    console.error('[TradingLoop] Kraken market signals failed:', err);
    return [];
  }
}

/**
 * Map a Kraken ticker into the TokenData shape expected by scoreTokenForAgent.
 * "mint" holds the pair key (XBTUSD) as a stable unique identifier.
 */
function krakenTickerToTokenData(t: KrakenTickerData): TokenData {
  const priceChange24hPct =
    t.openPrice24h > 0 ? ((t.price - t.openPrice24h) / t.openPrice24h) * 100 : 0;

  // Map Kraken pair keys to human-readable symbol/name
  const symbolMap: Record<string, { symbol: string; name: string }> = {
    XBTUSD: { symbol: 'BTC', name: 'Bitcoin' },
    ETHUSD: { symbol: 'ETH', name: 'Ethereum' },
    SOLUSD: { symbol: 'SOL', name: 'Solana' },
    XBTEUR: { symbol: 'BTC', name: 'Bitcoin' },
    ETHEUR: { symbol: 'ETH', name: 'Ethereum' },
  };

  const meta = symbolMap[t.pair] ?? { symbol: t.pair.slice(0, 3), name: t.pair };

  return {
    mint: t.pair,                          // pair key as stable ID
    symbol: meta.symbol,
    name: meta.name,
    priceUsd: t.price,
    volume24h: t.volume24h * t.price,      // convert to USD volume
    priceChange24h: priceChange24hPct,
    liquidity: t.volume24h * t.price * 0.1, // rough liquidity proxy
  };
}

// ── Agent Selection ──────────────────────────────────────

/**
 * Pick random active agents for this trading cycle
 */
export async function selectRandomAgents(count: number): Promise<any[]> {
  try {
    // Get all active trading agents (not observers)
    const allAgents = await db.tradingAgent.findMany({
      where: {
        status: 'ACTIVE',
        archetypeId: {
          not: 'observer',
        },
      },
      select: {
        id: true,
        archetypeId: true,
        name: true,
        displayName: true,
        totalTrades: true,
        winRate: true,
        totalPnl: true,
        privyWalletId: true,
        config: true,
      },
    });

    if (allAgents.length === 0) {
      console.warn('[TradingLoop] No active trading agents found');
      return [];
    }

    // Shuffle and pick N agents
    const shuffled = allAgents.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, allAgents.length));

    console.log(`[TradingLoop] Selected ${selected.length} agents:`, 
      selected.map(a => a.displayName || a.name).join(', '));

    return selected;
  } catch (error) {
    console.error('[TradingLoop] Failed to select agents:', error);
    return [];
  }
}

// ── Trading Logic ────────────────────────────────────────

/**
 * Execute one trading cycle
 */
async function executeTradingCycle(config: TradingLoopConfig): Promise<void> {
  cycleCount++;
  console.log(`\n[TradingLoop] === Cycle #${cycleCount} starting ===`);

  try {
    // 1. Fetch Kraken market signals
    const tokens = await fetchKrakenMarketSignals();

    if (tokens.length === 0) {
      console.warn('[TradingLoop] No tokens available, skipping cycle');
      return;
    }

    // 2. Manage existing positions (EXIT logic)
    await manageExistingPositions(tokens);

    // 3. Select random agents (ENTRY logic)
    const agents = await selectRandomAgents(config.agentsPerCycle);
    
    if (agents.length === 0) {
      console.warn('[TradingLoop] No agents available, skipping cycle');
      return;
    }

    // 4. For each agent, score tokens and trade
    let tradesThisCycle = 0;

    for (const agent of agents) {
      if (tradesThisCycle >= config.maxTradesPerCycle) {
        console.log(`[TradingLoop] Max trades per cycle reached (${config.maxTradesPerCycle})`);
        break;
      }

      try {
        // Score all tokens for this agent
        const scoredTokens = tokens.map(token => ({
          token,
          score: scoreTokenForAgent(token, agent.archetypeId),
        }));

        // Filter tokens that meet confidence threshold
        const tradableTokens = scoredTokens.filter(
          st => st.score.shouldTrade && st.score.confidence >= config.minConfidence
        );

        if (tradableTokens.length === 0) {
          console.log(`[TradingLoop] ${agent.displayName || agent.name}: No tradable tokens found`);
          continue;
        }

        // Pick best token by score
        const best = tradableTokens.sort((a, b) => b.score.confidence - a.score.confidence)[0];
        
        console.log(
          `[TradingLoop] ${agent.displayName || agent.name} trading ${best.token.symbol}:`,
          `score=${best.score.confidence}, reason="${best.score.reasoning}"`
        );

        // Execute trade (real if Privy wallet, paper otherwise)
        await executeAgentTrade(agent, best.token, best.score.confidence, best.score.reasoning, config);
        
        tradesThisCycle++;
        totalTradesCreated++;

      } catch (error) {
        console.error(`[TradingLoop] Failed to process agent ${agent.name}:`, error);
      }
    }

    console.log(`[TradingLoop] === Cycle #${cycleCount} complete: ${tradesThisCycle} trades created ===`);

  } catch (error) {
    console.error('[TradingLoop] Cycle failed:', error);
  }
}

/**
 * Manage existing open positions.
 * For this hackathon, we use a simple "time-based exit" or "take profit/stop loss".
 * Default: Close any position older than 1 hour.
 */
async function manageExistingPositions(currentPrices: TokenData[]): Promise<void> {
  try {
    const openTrades = await db.paperTrade.findMany({
      where: {
        status: 'OPEN',
        signalSource: 'kraken_trading_loop',
      },
      include: { agent: true },
    });

    if (openTrades.length === 0) return;

    console.log(`[TradingLoop] Checking ${openTrades.length} open positions for exit signals...`);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const trade of openTrades) {
      const currentToken = currentPrices.find(p => p.mint === trade.tokenMint);
      if (!currentToken) continue;

      const currentPrice = currentToken.priceUsd;
      const entryPrice = Number(trade.entryPrice);
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

      // Exit conditions:
      // 1. Profit > 5% (Take Profit)
      // 2. Loss > 3% (Stop Loss)
      // 3. Time > 1 hour (Time Exit)
      const shouldExit = pnlPercent >= 5 || pnlPercent <= -3 || trade.openedAt < oneHourAgo;

      if (shouldExit) {
        const reason = pnlPercent >= 5 ? 'TP' : (pnlPercent <= -3 ? 'SL' : 'TIME');
        console.log(`[TradingLoop] EXIT trade ${trade.id} (${trade.tokenSymbol}): ${reason} @ ${pnlPercent.toFixed(2)}%`);
        await closeAgentPosition(trade, currentPrice, pnlPercent);
      }
    }
  } catch (error) {
    console.error('[TradingLoop] Position management failed:', error);
  }
}

/**
 * Close a paper trade and execute offsetting order on Kraken.
 */
export async function closeAgentPosition(trade: any, exitPrice: number, pnlPercent: number): Promise<void> {
  try {
    const entryPrice = Number(trade.entryPrice);
    const amountUsd = Number(trade.amount);
    const pnlUsd = (exitPrice - entryPrice) * Number(trade.tokenAmount);

    // 1. Update DB
    await db.paperTrade.update({
      where: { id: trade.id },
      data: {
        status: 'CLOSED',
        exitPrice,
        pnl: pnlUsd,
        pnlPercent,
        closedAt: new Date(),
      },
    });

    // 2. Kraken Order (Offsetting) — fire-and-forget
    closePosition(trade.tokenMint, 'buy', Number(trade.tokenAmount), exitPrice)
      .then((result) => {
        console.log(`[Kraken] Exit order ${result.orderId} placed for trade ${trade.id}`);
      })
      .catch((err) => {
        console.warn(`[Kraken] Exit order placement failed (trade ${trade.id}):`, err.message);
      });

    // 3. ERC-8004 Feedback (fire-and-forget)
    submitTradeFeedback(trade.id).catch((err) =>
      console.warn(`[ERC8004] submitTradeFeedback failed (trade ${trade.id}):`, err.message),
    );

  } catch (error) {
    console.error(`[TradingLoop] Failed to close position ${trade.id}:`, error);
  }
}

/**
 * Execute trade via Kraken (sandbox or real) and record as paper trade.
 * ERC-8004 validation artifacts are emitted fire-and-forget after recording.
 */
async function executeAgentTrade(
  agent: any,
  token: TokenData,
  confidence: number,
  reasoning: string,
  config: TradingLoopConfig,
): Promise<void> {
  console.log(`[TradingLoop] KRAKEN TRADE: ${agent.displayName || agent.name} → ${token.symbol}`);

  // 1. Record paper trade in DB first (fast, never fails the loop)
  const trade = await createPaperTrade(agent, token, confidence, reasoning, config);

  if (!trade) return;

  // 2. Place order on Kraken (sandbox by default) — fire-and-forget
  placeOrder(token.mint, 'buy', KRAKEN_POSITION_USD, token.priceUsd)
    .then((result) => {
      console.log(`[Kraken] Order ${result.orderId} placed for trade ${trade.id}`);
    })
    .catch((err) => {
      console.warn(`[Kraken] Order placement failed (trade ${trade.id}):`, err.message);
    });

  // 3. ERC-8004: emit validation artifact — fire-and-forget
  proveTradeIntent(trade.id).catch((err) =>
    console.warn(`[ERC8004] proveTradeIntent failed (trade ${trade.id}):`, err.message),
  );

  submitTradeFeedback(trade.id).catch((err) =>
    console.warn(`[ERC8004] submitTradeFeedback failed (trade ${trade.id}):`, err.message),
  );
}

/**
 * Create a paper trade in the database.
 * Returns the created record so the caller can fire ERC-8004 events against its ID.
 */
async function createPaperTrade(
  agent: any,
  token: TokenData,
  confidence: number,
  reasoning: string,
  config: TradingLoopConfig,
): Promise<any | null> {
  try {
    const positionUsd = KRAKEN_POSITION_USD;
    const tokenAmount = positionUsd / token.priceUsd;

    const trade = await db.paperTrade.create({
      data: {
        agentId: agent.id,
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        action: 'BUY',
        chain: 'BSC',              // EVM chain — Kraken trades validated via ERC-8004 on Sepolia
        entryPrice: token.priceUsd,
        tokenPrice: token.priceUsd,
        amount: positionUsd,
        tokenAmount,
        marketCap: token.marketCap,
        liquidity: token.liquidity,
        status: 'OPEN',
        signalSource: 'kraken_trading_loop',
        confidence,
        metadata: {
          source: 'kraken_trading_loop',
          reasoning,
          cycleId: cycleCount,
          timestamp: new Date().toISOString(),
          tokenData: {
            volume24h: token.volume24h,
            priceChange24h: token.priceChange24h,
            priceChange1h: token.priceChange1h,
          },
        },
      },
    });

    console.log(
      `[TradingLoop] ✅ Trade created: ${agent.displayName || agent.name} bought ` +
        `${tokenAmount.toFixed(4)} ${token.symbol} @ $${token.priceUsd.toFixed(2)} ` +
        `($${positionUsd} USD, confidence: ${confidence})`,
    );

    return trade;
  } catch (error) {
    console.error('[TradingLoop] Failed to create paper trade:', error);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────

/**
 * Start the autonomous trading loop
 */
export function startTradingLoop(options?: Partial<TradingLoopConfig>): void {
  if (isRunning) {
    console.warn('[TradingLoop] Already running');
    return;
  }

  const config: TradingLoopConfig = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  console.log('[TradingLoop] Starting autonomous trading loop');
  console.log(`  Interval: ${config.intervalMinutes} minutes`);
  console.log(`  Agents per cycle: ${config.agentsPerCycle}`);
  console.log(`  Min confidence: ${config.minConfidence}`);
  console.log(`  Max trades per cycle: ${config.maxTradesPerCycle}`);
  console.log(`  Position size: ${config.positionSizeSOL} SOL`);

  // Run first cycle immediately (after 30 seconds)
  setTimeout(() => {
    executeTradingCycle(config).catch(err => {
      console.error('[TradingLoop] Initial cycle failed:', err);
    });
  }, 30000);

  // Then run every N minutes
  const intervalMs = config.intervalMinutes * 60 * 1000;
  loopInterval = setInterval(() => {
    executeTradingCycle(config).catch(err => {
      console.error('[TradingLoop] Cycle failed:', err);
    });
  }, intervalMs);

  isRunning = true;
  console.log(`✅ [TradingLoop] Started (first cycle in 30 seconds, then every ${config.intervalMinutes}min)`);
}

/**
 * Stop the trading loop
 */
export function stopTradingLoop(): void {
  if (!isRunning) {
    console.warn('[TradingLoop] Not running');
    return;
  }

  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }

  isRunning = false;
  console.log(`[TradingLoop] Stopped after ${cycleCount} cycles (${totalTradesCreated} trades created)`);
}

/**
 * Get trading loop status
 */
export function getTradingLoopStatus() {
  return {
    isRunning,
    cycleCount,
    totalTradesCreated,
  };
}

/**
 * Manually trigger one cycle (for testing)
 */
export async function triggerManualCycle(options?: Partial<TradingLoopConfig>): Promise<void> {
  const config: TradingLoopConfig = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  console.log('[TradingLoop] Manual cycle triggered');
  await executeTradingCycle(config);
}
