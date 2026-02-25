/**
 * Token Discussion Engine
 *
 * Proactive conversation generator (every 7 minutes):
 *  1. Gets hot tokens from TrendingTokenSync
 *  2. Filters out tokens with recent conversations (< 2h)
 *  3. Picks top candidates and generates agent discussions
 *  4. Rate-limited: max 30 conversations/hour, 2.5s between LLM calls
 *
 * This is the engine that makes the arena feel alive — agents proactively
 * discuss trending tokens even when no trades are happening.
 */

import { db } from '../lib/db';
import { ConversationTrigger } from '../lib/conversation-triggers';
import {
  generateTokenConversation,
  type TokenContext,
} from '../lib/conversation-generator';
import { getHotTokens } from './trending-token-sync';

// ── Rate Limiting ────────────────────────────────────────

const CONVERSATION_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours per token
const MAX_CONVERSATIONS_PER_HOUR = 30;
const STAGGER_DELAY_MS = 2500; // 2.5s between LLM calls
const MAX_PER_CYCLE = 5; // Max conversations per 7min cycle

let hourlyConversationCount = 0;
let hourlyResetAt = Date.now() + 60 * 60 * 1000;

function resetHourlyIfNeeded() {
  if (Date.now() > hourlyResetAt) {
    hourlyConversationCount = 0;
    hourlyResetAt = Date.now() + 60 * 60 * 1000;
  }
}

// ── Token Filtering ──────────────────────────────────────

/**
 * Filter hot tokens to find ones worth discussing.
 * Excludes tokens that already have recent conversations.
 */
async function findDiscussionCandidates(): Promise<TokenContext[]> {
  const hotTokens = getHotTokens();
  if (hotTokens.length === 0) {
    console.log('[DiscussionEngine] No hot tokens available (sync may not have run yet)');
    return [];
  }

  // Get tokens with recent conversations
  const recentCutoff = new Date(Date.now() - CONVERSATION_COOLDOWN_MS);
  const recentConversations = await db.agentConversation.findMany({
    where: {
      createdAt: { gte: recentCutoff },
      tokenMint: { not: null },
    },
    select: { tokenMint: true },
  });

  const recentMints = new Set(recentConversations.map(c => c.tokenMint).filter(Boolean));

  // Filter: no recent conversation, has good metrics
  const candidates = hotTokens.filter(token => {
    if (recentMints.has(token.tokenMint)) return false;
    // Extra quality check — prefer tokens with stronger signals
    if ((token.volume24h || 0) < 50_000) return false;
    return true;
  });

  console.log(`[DiscussionEngine] ${hotTokens.length} hot tokens → ${candidates.length} candidates (${recentMints.size} with recent convos)`);
  return candidates;
}

/**
 * Determine the best trigger type for a token based on its metrics.
 */
function classifyTokenTrigger(token: TokenContext): ConversationTrigger {
  const change = token.priceChange24h || 0;

  // Big movers (>30% in either direction) are "runners"
  if (Math.abs(change) > 30) {
    return ConversationTrigger.TOKEN_RUNNER;
  }

  // Recently deployed tokens with activity are "migrations"
  if (token.source === 'token_deployment' || token.source === 'migration') {
    return ConversationTrigger.TOKEN_MIGRATION;
  }

  // Default: trending
  return ConversationTrigger.TOKEN_TRENDING;
}

// ── Main Engine Cycle ────────────────────────────────────

async function runDiscussionCycle(): Promise<void> {
  const cycleStart = Date.now();
  console.log('\n🔄 [DiscussionEngine] Starting discussion cycle...');

  resetHourlyIfNeeded();

  if (hourlyConversationCount >= MAX_CONVERSATIONS_PER_HOUR) {
    console.log(`[DiscussionEngine] Hourly cap reached (${MAX_CONVERSATIONS_PER_HOUR}), skipping cycle`);
    return;
  }

  const candidates = await findDiscussionCandidates();
  if (candidates.length === 0) {
    console.log('[DiscussionEngine] No candidates for discussion this cycle');
    return;
  }

  // Pick top N candidates (prioritize runners > trending > deployments)
  const sorted = [...candidates].sort((a, b) => {
    // Runners first (big price changes)
    const aChange = Math.abs(a.priceChange24h || 0);
    const bChange = Math.abs(b.priceChange24h || 0);
    if (aChange > 30 && bChange <= 30) return -1;
    if (bChange > 30 && aChange <= 30) return 1;

    // Then by volume
    return (b.volume24h || 0) - (a.volume24h || 0);
  });

  const toDiscuss = sorted.slice(0, Math.min(MAX_PER_CYCLE, MAX_CONVERSATIONS_PER_HOUR - hourlyConversationCount));
  let generated = 0;

  for (const token of toDiscuss) {
    if (hourlyConversationCount >= MAX_CONVERSATIONS_PER_HOUR) break;

    const trigger = classifyTokenTrigger(token);

    console.log(`\n💬 [DiscussionEngine] Generating discussion: $${token.tokenSymbol} (${trigger})`);

    const result = await generateTokenConversation(trigger, token);

    if (result) {
      hourlyConversationCount++;
      generated++;
      console.log(`  ✅ [DiscussionEngine] $${token.tokenSymbol}: ${result.messagesPosted} messages by [${result.agents.join(', ')}]`);
    }

    // Stagger between LLM calls
    if (toDiscuss.indexOf(token) < toDiscuss.length - 1) {
      await new Promise(r => setTimeout(r, STAGGER_DELAY_MS));
    }
  }

  const elapsed = Date.now() - cycleStart;
  console.log(`\n🎉 [DiscussionEngine] Cycle complete: ${generated}/${toDiscuss.length} conversations generated (${elapsed}ms, ${hourlyConversationCount}/${MAX_CONVERSATIONS_PER_HOUR} hourly)`);
}

// ── Cron Manager ─────────────────────────────────────────

const DISCUSSION_INTERVAL_MS = 7 * 60 * 1000; // 7 minutes
let discussionTimer: ReturnType<typeof setInterval> | null = null;

export function startTokenDiscussionEngine(): void {
  console.log('[DiscussionEngine] Starting (every 7 minutes)...');

  // First run after 2 minutes (give TrendingSync time to populate)
  setTimeout(() => {
    runDiscussionCycle().catch(err => {
      console.error('[DiscussionEngine] Initial cycle failed:', err);
    });

    // Then every 7 minutes
    discussionTimer = setInterval(() => {
      runDiscussionCycle().catch(err => {
        console.error('[DiscussionEngine] Cycle failed:', err);
      });
    }, DISCUSSION_INTERVAL_MS);
  }, 2 * 60 * 1000);
}

export function stopTokenDiscussionEngine(): void {
  if (discussionTimer) {
    clearInterval(discussionTimer);
    discussionTimer = null;
  }
  console.log('[DiscussionEngine] Stopped');
}
