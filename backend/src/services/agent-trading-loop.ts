/**
 * Agent Trading Loop
 * 
 * Autonomous trading system that makes agents trade every 15-30 minutes.
 * Fetches trending tokens, scores them per agent archetype, and executes paper trades.
 * 
 * The conversation reactor (agent-signal-reactor.ts) automatically generates
 * conversations when trades are created.
 */

import { db } from '../lib/db';
import { scoreTokenForAgent, type TokenData } from '../lib/token-scorer';
import { getOrInitExecutor, executeDirectBuyWithPrivy } from './auto-buy-executor';
import type { AutoBuyRequest } from './trigger-engine';

const BIRDEYE_API_URL = process.env.BIRDEYE_API_URL || 'https://public-api.birdeye.so';
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

// Real well-known Solana token mints — used as DexScreener fallback
const FALLBACK_MINTS = [
  'So11111111111111111111111111111111111111112',    // SOL
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',   // MEW
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',  // RAY
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',   // ORCA
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  'HZ1JovNiVvGrCNiiYWY1ZQuAHYtmzMocHUvCYBFzEfmR',  // RENDER
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',  // USDT
];

// ── Configuration ────────────────────────────────────────

interface TradingLoopConfig {
  intervalMinutes: number;
  agentsPerCycle: number;
  minConfidence: number;
  maxTradesPerCycle: number;
  positionSizeSOL: number;
}

const DEFAULT_CONFIG: TradingLoopConfig = {
  intervalMinutes: 20,
  agentsPerCycle: 3,
  minConfidence: 70,
  maxTradesPerCycle: 5,
  positionSizeSOL: 1.5, // Each trade is ~1.5 SOL
};

// ── State ────────────────────────────────────────────────

let loopInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let cycleCount = 0;
let totalTradesCreated = 0;

// ── Token Fetching ───────────────────────────────────────

/**
 * Fetch real trending tokens from Birdeye, with DexScreener fallback.
 * No mock data — every token has a real on-chain mint and live price.
 */
async function fetchTrendingTokens(): Promise<TokenData[]> {
  // 1. Try Birdeye trending (requires API key)
  if (BIRDEYE_API_KEY) {
    try {
      const url = `${BIRDEYE_API_URL}/defi/token_trending?sort_by=volume24hUSD&sort_type=desc&offset=0&limit=20&min_liquidity=30000`;
      const res = await fetch(url, {
        headers: { 'X-API-KEY': BIRDEYE_API_KEY, 'x-chain': 'solana' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const raw: any[] = data?.data?.tokens ?? data?.data?.items ?? data?.data ?? [];
        const tokens = raw
          .map((t: any): TokenData => ({
            mint: t.address,
            symbol: t.symbol || 'UNKNOWN',
            name: t.name || t.symbol || 'Unknown Token',
            priceUsd: Number(t.price) || 0,
            marketCap: t.mc ?? t.marketCap,
            liquidity: t.liquidity,
            volume24h: t.v24hUSD ?? t.volume24hUSD ?? t.volume24h,
            priceChange24h: t.price24hChangePercent ?? t.priceChange24h,
            priceChange1h: t.price1hChangePercent ?? t.priceChange1h,
            holder: t.uniqueWallet24h ?? t.holder,
          }))
          .filter((t) => t.priceUsd > 0 && t.mint);
        if (tokens.length > 0) {
          console.log(`[TradingLoop] Birdeye: ${tokens.length} real trending tokens`);
          return tokens;
        }
      }
    } catch (err) {
      console.warn('[TradingLoop] Birdeye trending failed:', err);
    }
  }

  // 2. Fallback: DexScreener batch lookup on real known mints
  return fetchFallbackTokens();
}

/**
 * DexScreener batch fetch for known real token mints.
 * Free, no API key, always available.
 */
async function fetchFallbackTokens(): Promise<TokenData[]> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${FALLBACK_MINTS.slice(0, 10).join(',')}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const pairs: any[] = data?.pairs ?? [];

    const seen = new Set<string>();
    const tokens: TokenData[] = [];

    // Highest liquidity pair per token
    const sorted = [...pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    for (const pair of sorted) {
      const mint = pair.baseToken?.address;
      if (!mint || seen.has(mint)) continue;
      seen.add(mint);
      tokens.push({
        mint,
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        name: pair.baseToken?.name || pair.baseToken?.symbol || 'Unknown',
        priceUsd: parseFloat(pair.priceUsd) || 0,
        marketCap: pair.marketCap,
        liquidity: pair.liquidity?.usd,
        volume24h: pair.volume?.h24,
        priceChange24h: pair.priceChange?.h24,
        priceChange1h: pair.priceChange?.h1,
      });
    }

    const valid = tokens.filter((t) => t.priceUsd > 0);
    console.log(`[TradingLoop] DexScreener fallback: ${valid.length} real tokens`);
    return valid;
  } catch (err) {
    console.error('[TradingLoop] DexScreener fallback failed:', err);
    return [];
  }
}

// ── Agent Selection ──────────────────────────────────────

/**
 * Pick random active agents for this trading cycle
 */
async function selectRandomAgents(count: number): Promise<any[]> {
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
    // 1. Fetch trending tokens
    const tokens = await fetchTrendingTokens();
    console.log(`[TradingLoop] Fetched ${tokens.length} trending tokens`);

    if (tokens.length === 0) {
      console.warn('[TradingLoop] No tokens available, skipping cycle');
      return;
    }

    // 2. Select random agents
    const agents = await selectRandomAgents(config.agentsPerCycle);
    
    if (agents.length === 0) {
      console.warn('[TradingLoop] No agents available, skipping cycle');
      return;
    }

    // 3. For each agent, score tokens and trade
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
 * Route trade to real execution (Privy wallet) or paper trade (fallback).
 */
async function executeAgentTrade(
  agent: any,
  token: TokenData,
  confidence: number,
  reasoning: string,
  config: TradingLoopConfig
): Promise<void> {
  const jupiterExecutor = getOrInitExecutor();
  const hasRealWallet = agent.privyWalletId && jupiterExecutor;

  if (hasRealWallet) {
    console.log(`[TradingLoop] REAL TRADE: ${agent.displayName || agent.name} → ${token.symbol}`);
    const request: AutoBuyRequest = {
      agentId: agent.id,
      agentName: agent.displayName || agent.name,
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      solAmount: config.positionSizeSOL,
      chain: 'SOLANA',
      triggeredBy: 'trading_loop',
      sourceWallet: '',
      reason: reasoning,
    };

    try {
      await executeDirectBuyWithPrivy(request, agent.privyWalletId);
    } catch (error) {
      console.error(`[TradingLoop] Real trade failed, falling back to paper:`, error);
      await createPaperTrade(agent, token, confidence, reasoning, config);
    }
  } else {
    console.log(`[TradingLoop] PAPER TRADE: ${agent.displayName || agent.name} → ${token.symbol}`);
    await createPaperTrade(agent, token, confidence, reasoning, config);
  }
}

/**
 * Create a paper trade in the database
 */
async function createPaperTrade(
  agent: any,
  token: TokenData,
  confidence: number,
  reasoning: string,
  config: TradingLoopConfig
): Promise<void> {
  try {
    const positionSize = config.positionSizeSOL;
    const tokenAmount = positionSize / token.priceUsd;

    const trade = await db.paperTrade.create({
      data: {
        agentId: agent.id,
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        action: 'BUY',
        chain: 'SOLANA',
        entryPrice: token.priceUsd, // SOL price (for P&L calc)
        tokenPrice: token.priceUsd,  // Token price in USD
        amount: positionSize,        // SOL spent
        tokenAmount,                 // Token quantity received
        marketCap: token.marketCap,
        liquidity: token.liquidity,
        status: 'OPEN',
        signalSource: 'autonomous_trading_loop',
        confidence,
        metadata: {
          source: 'trading_loop',
          reasoning,
          cycleId: cycleCount,
          timestamp: new Date().toISOString(),
          tokenData: {
            volume24h: token.volume24h,
            priceChange24h: token.priceChange24h,
            priceChange1h: token.priceChange1h,
            holder: token.holder,
            ageMinutes: token.ageMinutes,
            socialVolume: token.socialVolume,
            twitterMentions: token.twitterMentions,
          },
        },
      },
    });

    console.log(
      `[TradingLoop] ✅ Trade created: ${agent.displayName || agent.name} bought ` +
      `${tokenAmount.toFixed(2)} ${token.symbol} @ $${token.priceUsd.toFixed(6)} ` +
      `(${positionSize} SOL, confidence: ${confidence})`
    );

    // The conversation reactor will automatically pick this up
    // and generate agent commentary within 1-2 minutes

  } catch (error) {
    console.error('[TradingLoop] Failed to create paper trade:', error);
    throw error;
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
