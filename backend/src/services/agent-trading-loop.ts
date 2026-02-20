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
 * Fetch trending tokens from Jupiter API
 * Falls back to mock data if API fails
 */
async function fetchTrendingTokens(): Promise<TokenData[]> {
  try {
    // Jupiter Trending API (if available)
    // Note: Jupiter doesn't have a direct "trending" endpoint
    // We'll use a mock dataset for now and can integrate Birdeye later
    
    // For Phase 1, return realistic mock tokens
    return getMockTrendingTokens();
  } catch (error) {
    console.error('[TradingLoop] Failed to fetch trending tokens:', error);
    return getMockTrendingTokens();
  }
}

/**
 * Mock trending tokens with realistic metrics
 * Phase 2: Replace with Birdeye API integration
 */
function getMockTrendingTokens(): TokenData[] {
  const now = Date.now();
  
  // Generate 10-15 mock tokens with varied characteristics
  const tokens: TokenData[] = [
    {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      priceUsd: 1.0,
      marketCap: 25000000000,
      liquidity: 5000000,
      volume24h: 15000000,
      priceChange24h: 0.1,
      priceChange1h: 0.0,
      holder: 50000,
      ageMinutes: 100000,
    },
    {
      mint: randomMint(),
      symbol: 'BONK',
      name: 'Bonk Dog Token',
      priceUsd: 0.0000125,
      marketCap: 850000,
      liquidity: 120000,
      volume24h: 340000,
      priceChange24h: 28.5,
      priceChange1h: 8.2,
      holder: 4200,
      ageMinutes: 180,
      socialVolume: 850,
      twitterMentions: 620,
    },
    {
      mint: randomMint(),
      symbol: 'PUMP',
      name: 'Pump It Up',
      priceUsd: 0.042,
      marketCap: 420000,
      liquidity: 65000,
      volume24h: 580000,
      priceChange24h: 145.2,
      priceChange1h: 52.3,
      holder: 890,
      ageMinutes: 45,
      socialVolume: 320,
      twitterMentions: 180,
    },
    {
      mint: randomMint(),
      symbol: 'WHALE',
      name: 'Whale Accumulation',
      priceUsd: 1.85,
      marketCap: 12500000,
      liquidity: 280000,
      volume24h: 420000,
      priceChange24h: 12.3,
      priceChange1h: 3.2,
      holder: 3200,
      ageMinutes: 720,
      socialVolume: 150,
    },
    {
      mint: randomMint(),
      symbol: 'MOON',
      name: 'Moon Shot',
      priceUsd: 0.0085,
      marketCap: 180000,
      liquidity: 42000,
      volume24h: 95000,
      priceChange24h: 8.5,
      priceChange1h: 2.1,
      holder: 650,
      ageMinutes: 15,
      socialVolume: 45,
    },
    {
      mint: randomMint(),
      symbol: 'STABLE',
      name: 'Stable Growth',
      priceUsd: 2.45,
      marketCap: 8200000,
      liquidity: 520000,
      volume24h: 980000,
      priceChange24h: 5.2,
      priceChange1h: 1.1,
      holder: 5800,
      ageMinutes: 2400,
      socialVolume: 280,
      twitterMentions: 150,
    },
    {
      mint: randomMint(),
      symbol: 'DEGEN',
      name: 'Degen Play',
      priceUsd: 0.0012,
      marketCap: 95000,
      liquidity: 28000,
      volume24h: 180000,
      priceChange24h: 220.5,
      priceChange1h: 85.3,
      holder: 420,
      ageMinutes: 8,
      socialVolume: 95,
    },
    {
      mint: randomMint(),
      symbol: 'LIQ',
      name: 'Liquidity King',
      priceUsd: 0.52,
      marketCap: 650000,
      liquidity: 185000,
      volume24h: 420000,
      priceChange24h: 15.8,
      priceChange1h: 4.2,
      holder: 1850,
      ageMinutes: 22,
      socialVolume: 120,
    },
    {
      mint: randomMint(),
      symbol: 'SLOW',
      name: 'Slow and Steady',
      priceUsd: 5.20,
      marketCap: 15000000,
      liquidity: 650000,
      volume24h: 1200000,
      priceChange24h: 3.5,
      priceChange1h: 0.8,
      holder: 8200,
      ageMinutes: 7200,
      socialVolume: 520,
      twitterMentions: 380,
    },
    {
      mint: randomMint(),
      symbol: 'SCALP',
      name: 'Scalper Dream',
      priceUsd: 1.12,
      marketCap: 2200000,
      liquidity: 320000,
      volume24h: 850000,
      priceChange24h: 4.2,
      priceChange1h: 1.5,
      holder: 2800,
      ageMinutes: 1200,
      socialVolume: 85,
    },
  ];

  // Shuffle and return
  return tokens.sort(() => Math.random() - 0.5);
}

function randomMint(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let mint = '';
  for (let i = 0; i < 44; i++) {
    mint += chars[Math.floor(Math.random() * chars.length)];
  }
  return mint;
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

        // Execute paper trade
        await createPaperTrade(agent, best.token, best.score.confidence, best.score.reasoning, config);
        
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
