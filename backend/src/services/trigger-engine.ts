/**
 * Trigger Engine — evaluates BuyTriggers when tracked wallets trade.
 *
 * Called by webhooks.ts (Solana) and bsc-monitor.ts (BSC) after
 * detecting a trade from a tracked wallet.
 *
 * Safety:
 *  - Max 5 auto-buys per agent per day
 *  - 60s cooldown between auto-buys per agent
 *  - Max exposure check (won't buy if agent already has too many positions)
 *  - Token eligibility: min liquidity, min market cap
 */

import { db } from '../lib/db';
import type { BuyTrigger, TradingAgent, TrackedWallet } from '@prisma/client';
import { websocketEvents } from './websocket-events';
import { getActiveTokens } from '../modules/arena/arena.service';
import { agentSignalReactor } from './agent-signal-reactor';

// ── Types ─────────────────────────────────────────────────

export interface DetectedTrade {
  walletAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  action: 'BUY' | 'SELL';
  amount: number; // SOL, BNB, or ETH value
  chain: 'SOLANA' | 'BSC' | 'BASE';
  signature: string;
  liquidity?: number;
  marketCap?: number;
  volume24h?: number;
}

export interface AutoBuyRequest {
  agentId: string;
  agentName: string;
  tokenMint: string;
  tokenSymbol: string;
  solAmount: number;
  chain: 'SOLANA' | 'BSC' | 'BASE';
  triggeredBy: string; // trigger type
  sourceWallet: string; // the tracked wallet that triggered this
  reason: string;
}

// ── Safety Limits ─────────────────────────────────────────

const MAX_DAILY_AUTO_BUYS = 5;
const COOLDOWN_MS = 60_000; // 60 seconds between auto-buys per agent
const MAX_OPEN_POSITIONS = 10;
const MIN_LIQUIDITY_USD = 5_000;
const MIN_MARKET_CAP_USD = 10_000;

// In-memory rate limit tracker: agentId → { count, lastBuyAt }
const agentRateLimits = new Map<string, { count: number; lastBuyAt: number; resetAt: number }>();

// ── Consensus Tracker (cross-agent sliding window) ──────────

/** tokenMint → array of { walletAddress, timestamp } */
const consensusTracker = new Map<string, Array<{ walletAddress: string; timestamp: number }>>();

/** "agentId:tokenMint" or "trending:agentId:tokenMint" → timestamp of last fire (dedup) */
const triggerFired = new Map<string, number>();

function recordConsensusBuy(trade: DetectedTrade) {
  if (trade.action !== 'BUY') return;

  const entries = consensusTracker.get(trade.tokenMint) ?? [];
  // Deduplicate: same wallet within 60s window ignored
  const isDuplicate = entries.some(
    (e) => e.walletAddress === trade.walletAddress && Date.now() - e.timestamp < 60_000,
  );
  if (isDuplicate) return;

  entries.push({ walletAddress: trade.walletAddress, timestamp: Date.now() });
  consensusTracker.set(trade.tokenMint, entries);
}

function getConsensusCount(tokenMint: string, windowMs: number): number {
  const entries = consensusTracker.get(tokenMint);
  if (!entries) return 0;
  const cutoff = Date.now() - windowMs;
  const distinct = new Set(entries.filter((e) => e.timestamp >= cutoff).map((e) => e.walletAddress));
  return distinct.size;
}

// Cleanup every 60s — prune entries older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [mint, entries] of consensusTracker) {
    const filtered = entries.filter((e) => e.timestamp >= cutoff);
    if (filtered.length === 0) {
      consensusTracker.delete(mint);
    } else {
      consensusTracker.set(mint, filtered);
    }
  }
  // Also clean up fired dedup entries older than 2h
  for (const [key, ts] of triggerFired) {
    if (Date.now() - ts > 2 * 60 * 60 * 1000) {
      triggerFired.delete(key);
    }
  }
}, 60_000);

function getRateLimit(agentId: string) {
  const now = Date.now();
  let entry = agentRateLimits.get(agentId);
  if (!entry || now > entry.resetAt) {
    // Reset at midnight UTC
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    entry = { count: 0, lastBuyAt: 0, resetAt: tomorrow.getTime() };
    agentRateLimits.set(agentId, entry);
  }
  return entry;
}

// ── Pending auto-buy queue (consumed by executor) ─────────

const pendingBuys: AutoBuyRequest[] = [];

export function getPendingBuys(): AutoBuyRequest[] {
  return pendingBuys.splice(0, pendingBuys.length); // drain queue
}

export function peekPendingBuys(): readonly AutoBuyRequest[] {
  return pendingBuys;
}

// ── Main Entry Point ──────────────────────────────────────

/**
 * Called when a tracked wallet executes a trade.
 * Evaluates all matching BuyTriggers and queues auto-buys.
 */
export async function evaluateTriggers(trade: DetectedTrade): Promise<AutoBuyRequest[]> {
  const queued: AutoBuyRequest[] = [];

  try {
    // Record all BUY trades for consensus tracking (cross-agent)
    if (trade.action === 'BUY') {
      recordConsensusBuy(trade);
    }

    // 1. Find all agents tracking this wallet
    const trackers = await db.trackedWallet.findMany({
      where: {
        address: trade.walletAddress,
        chain: trade.chain,
      },
      include: {
        agent: true,
      },
    });

    if (trackers.length === 0) return queued;

    console.log(`[TriggerEngine] ${trackers.length} agent(s) tracking wallet ${trade.walletAddress.slice(0, 10)}...`);

    // Generate agent conversation for every tracked wallet trade (fire-and-forget)
    if (trade.action === 'BUY') {
      agentSignalReactor.react('god_wallet_buy_detected', {
        tokenMint: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        walletAddress: trade.walletAddress,
        action: trade.action,
        amount: trade.amount,
        chain: trade.chain,
      }).catch((err) => console.error('[TriggerEngine] Reactor error:', err));
    }

    for (const tracker of trackers) {
      const agent = tracker.agent;

      // Skip inactive agents
      if (agent.status !== 'ACTIVE') continue;

      // Load agent's buy triggers
      const triggers = await db.buyTrigger.findMany({
        where: { agentId: agent.id, enabled: true },
      });

      if (triggers.length === 0) continue;

      // Evaluate each trigger
      for (const trigger of triggers) {
        const result = evaluateSingleTrigger(trigger, trade, agent);
        if (!result) continue;

        // Safety checks
        const safetyResult = await checkSafety(agent, trade);
        if (!safetyResult.ok) {
          console.log(`[TriggerEngine] Safety block for ${agent.name}: ${safetyResult.reason}`);
          continue;
        }

        // Queue the auto-buy
        const request: AutoBuyRequest = {
          agentId: agent.id,
          agentName: agent.name,
          tokenMint: trade.tokenMint,
          tokenSymbol: trade.tokenSymbol,
          solAmount: result.buyAmount,
          chain: trade.chain,
          triggeredBy: trigger.type,
          sourceWallet: trade.walletAddress,
          reason: result.reason,
        };

        pendingBuys.push(request);
        queued.push(request);

        // Update rate limit
        const rl = getRateLimit(agent.id);
        rl.count++;
        rl.lastBuyAt = Date.now();

        console.log(`[TriggerEngine] QUEUED auto-buy: ${agent.name} → ${result.buyAmount} SOL of ${trade.tokenSymbol} (${trigger.type})`);
      }
    }
  } catch (error) {
    console.error('[TriggerEngine] Error evaluating triggers:', error);
  }

  return queued;
}

// ── Trigger Evaluation Logic ──────────────────────────────

interface TriggerResult {
  buyAmount: number; // SOL to spend
  reason: string;
}

function evaluateSingleTrigger(
  trigger: BuyTrigger,
  trade: DetectedTrade,
  agent: TradingAgent,
): TriggerResult | null {
  const config = (trigger.config as Record<string, any>) || {};

  switch (trigger.type) {
    case 'godwallet': {
      // Copy buy: when tracked wallet buys, auto-buy proportionally
      if (trade.action !== 'BUY') return null;
      const buyAmount = config.autoBuyAmount ?? config.amount ?? 0.1; // SOL
      return {
        buyAmount: Math.min(buyAmount, getMaxPositionSize(agent)),
        reason: `God wallet ${trade.walletAddress.slice(0, 8)}... bought ${trade.tokenSymbol}`,
      };
    }

    case 'volume': {
      // Volume spike trigger: buy when 24h volume exceeds threshold
      if (trade.action !== 'BUY') return null;
      const threshold = config.volumeThreshold ?? 100_000; // USD
      if (!trade.volume24h || trade.volume24h < threshold) return null;
      const buyAmount = config.autoBuyAmount ?? config.amount ?? 0.05;
      return {
        buyAmount: Math.min(buyAmount, getMaxPositionSize(agent)),
        reason: `Volume spike: $${(trade.volume24h / 1000).toFixed(0)}k (threshold: $${(threshold / 1000).toFixed(0)}k)`,
      };
    }

    case 'liquidity': {
      // Liquidity gate: only buy if liquidity exceeds minimum
      if (trade.action !== 'BUY') return null;
      const minLiq = config.minLiquidity ?? 50_000; // USD
      if (!trade.liquidity || trade.liquidity < minLiq) return null;
      const buyAmount = config.autoBuyAmount ?? config.amount ?? 0.05;
      return {
        buyAmount: Math.min(buyAmount, getMaxPositionSize(agent)),
        reason: `Liquidity gate passed: $${(trade.liquidity / 1000).toFixed(0)}k (min: $${(minLiq / 1000).toFixed(0)}k)`,
      };
    }

    case 'consensus': {
      // Consensus trigger: fires when N distinct wallets buy the same token within a time window
      if (trade.action !== 'BUY') return null;
      const requiredCount = config.walletCount ?? 3;
      const timeWindowMinutes = config.timeWindowMinutes ?? 60;
      const timeWindowMs = timeWindowMinutes * 60_000;

      const currentCount = getConsensusCount(trade.tokenMint, timeWindowMs);
      if (currentCount < requiredCount) return null;

      // Dedup: don't fire same agent+token twice within the time window
      const dedupKey = `consensus:${agent.id}:${trade.tokenMint}`;
      const lastFired = triggerFired.get(dedupKey);
      if (lastFired && Date.now() - lastFired < timeWindowMs) return null;
      triggerFired.set(dedupKey, Date.now());

      const buyAmount = config.autoBuyAmount ?? config.amount ?? 0.1;

      // Broadcast consensus event globally
      websocketEvents.broadcastConsensusReached({
        tokenMint: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        walletCount: currentCount,
        timeWindowMinutes,
        chain: trade.chain,
        agentId: agent.id,
        agentName: agent.name,
      });

      // Generate agent conversation about the consensus event
      agentSignalReactor.react('signal_detected', {
        tokenMint: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        type: 'consensus',
        reason: `${currentCount} wallets bought $${trade.tokenSymbol} within ${timeWindowMinutes}m`,
        chain: trade.chain,
      }).catch((err) => console.error('[TriggerEngine] Reactor error:', err));

      return {
        buyAmount: Math.min(buyAmount, getMaxPositionSize(agent)),
        reason: `CONSENSUS: ${currentCount} wallets bought $${trade.tokenSymbol} within ${timeWindowMinutes}m`,
      };
    }

    default:
      return null;
  }
}

// ── Safety Checks ─────────────────────────────────────────

interface SafetyResult {
  ok: boolean;
  reason?: string;
}

async function checkSafety(agent: TradingAgent, trade: DetectedTrade): Promise<SafetyResult> {
  // 1. Rate limit: max daily buys
  const rl = getRateLimit(agent.id);
  if (rl.count >= MAX_DAILY_AUTO_BUYS) {
    return { ok: false, reason: `Daily limit reached (${MAX_DAILY_AUTO_BUYS})` };
  }

  // 2. Cooldown
  const elapsed = Date.now() - rl.lastBuyAt;
  if (elapsed < COOLDOWN_MS) {
    return { ok: false, reason: `Cooldown: ${((COOLDOWN_MS - elapsed) / 1000).toFixed(0)}s remaining` };
  }

  // 3. Max open positions
  const openPositions = await db.agentPosition.count({
    where: { agentId: agent.id },
  });
  if (openPositions >= MAX_OPEN_POSITIONS) {
    return { ok: false, reason: `Max positions reached (${MAX_OPEN_POSITIONS})` };
  }

  // 4. Already holding this token
  const existingPosition = await db.agentPosition.findFirst({
    where: { agentId: agent.id, tokenMint: trade.tokenMint },
  });
  if (existingPosition) {
    return { ok: false, reason: `Already holding ${trade.tokenSymbol}` };
  }

  // 5. Token eligibility: liquidity
  if (trade.liquidity != null && trade.liquidity < MIN_LIQUIDITY_USD) {
    return { ok: false, reason: `Liquidity too low ($${trade.liquidity.toFixed(0)} < $${MIN_LIQUIDITY_USD})` };
  }

  // 6. Token eligibility: market cap
  if (trade.marketCap != null && trade.marketCap < MIN_MARKET_CAP_USD) {
    return { ok: false, reason: `Market cap too low ($${trade.marketCap.toFixed(0)} < $${MIN_MARKET_CAP_USD})` };
  }

  return { ok: true };
}

// ── Trending Trigger (arena-wide activity) ───────────────

/** Cached active tokens result (30s TTL, aligns with Redis cache) */
let cachedActiveTokens: { data: any[]; fetchedAt: number } | null = null;
const ACTIVE_TOKENS_TTL_MS = 30_000;

/**
 * Evaluates trending triggers for all agents.
 * Called from auto-buy-executor on each poll cycle (every 5s).
 * Returns auto-buy requests for tokens with high arena activity.
 */
export async function evaluateTrendingTriggers(): Promise<AutoBuyRequest[]> {
  const queued: AutoBuyRequest[] = [];

  try {
    // Fetch hot tokens (cached 30s)
    const now = Date.now();
    if (!cachedActiveTokens || now - cachedActiveTokens.fetchedAt > ACTIVE_TOKENS_TTL_MS) {
      const result = await getActiveTokens(24);
      // getActiveTokens returns { tokens: [...] }
      const tokens = Array.isArray(result) ? result : (result as any).tokens ?? [];
      cachedActiveTokens = { data: tokens, fetchedAt: now };
    }
    const hotTokens = cachedActiveTokens!.data;
    if (hotTokens.length === 0) return queued;

    // Find all agents with trending triggers enabled
    const trendingTriggers = await db.buyTrigger.findMany({
      where: { type: 'trending', enabled: true },
      include: { agent: true },
    });

    if (trendingTriggers.length === 0) return queued;

    for (const trigger of trendingTriggers) {
      const agent = trigger.agent;
      if (agent.status !== 'ACTIVE') continue;

      const config = (trigger.config as Record<string, any>) || {};
      const minScore = config.minActivityScore ?? 20;
      const buyAmount = config.autoBuyAmount ?? 0.05;

      // Find tokens above score threshold
      const qualifying = hotTokens.filter((t: any) => (t.activityScore ?? 0) >= minScore);

      for (const token of qualifying) {
        // 1-hour cooldown per agent+token combo
        const dedupKey = `trending:${agent.id}:${token.tokenMint}`;
        const lastFired = triggerFired.get(dedupKey);
        if (lastFired && now - lastFired < 60 * 60 * 1000) continue;

        // Safety checks
        const mockTrade: DetectedTrade = {
          walletAddress: 'arena-trending',
          tokenMint: token.tokenMint,
          tokenSymbol: token.tokenSymbol || 'UNKNOWN',
          action: 'BUY',
          amount: buyAmount,
          chain: (token.chain as 'SOLANA' | 'BSC' | 'BASE') || 'SOLANA',
          signature: `trending-${agent.id}-${token.tokenMint}-${now}`,
          liquidity: token.liquidity,
          marketCap: token.marketCap,
        };

        const safety = await checkSafety(agent, mockTrade);
        if (!safety.ok) continue;

        // Mark as fired
        triggerFired.set(dedupKey, now);

        const request: AutoBuyRequest = {
          agentId: agent.id,
          agentName: agent.name,
          tokenMint: token.tokenMint,
          tokenSymbol: token.tokenSymbol || 'UNKNOWN',
          solAmount: Math.min(buyAmount, getMaxPositionSize(agent)),
          chain: mockTrade.chain,
          triggeredBy: 'trending',
          sourceWallet: 'arena-trending',
          reason: `Trending: $${token.tokenSymbol} activity score ${token.activityScore} (threshold: ${minScore})`,
        };

        pendingBuys.push(request);
        queued.push(request);

        // Update rate limit
        const rl = getRateLimit(agent.id);
        rl.count++;
        rl.lastBuyAt = now;

        console.log(`[TriggerEngine] TRENDING queued: ${agent.name} → ${buyAmount} SOL of ${token.tokenSymbol} (score: ${token.activityScore})`);
      }
    }
  } catch (error) {
    console.error('[TriggerEngine] Error evaluating trending triggers:', error);
  }

  return queued;
}

// ── Helpers ───────────────────────────────────────────────

function getMaxPositionSize(agent: TradingAgent): number {
  const config = (agent.config as Record<string, any>) || {};
  const tradingConfig = config.tradingConfig || config;
  return tradingConfig.maxPositionSize ?? 0.5; // Default 0.5 SOL
}
