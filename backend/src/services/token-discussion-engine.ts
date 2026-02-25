/**
 * Token Discussion Engine
 *
 * Aggressive conversation generator — keeps the arena alive 24/7.
 *
 * Two modes per cycle:
 *  A) NEW conversations — tokens that don't have any recent discussion
 *  B) FOLLOW-UP rounds — add fresh messages to existing conversations
 *     so tokens stay active and discussions feel ongoing
 *
 * Runs every 3 minutes. Targets: every token should have a message < 30min old.
 */

import { db } from '../lib/db';
import { ConversationTrigger } from '../lib/conversation-triggers';
import {
  generateTokenConversation,
  type TokenContext,
} from '../lib/conversation-generator';
import { getHotTokens } from './trending-token-sync';

// ── Configuration ────────────────────────────────────────

const NEW_CONVERSATION_COOLDOWN_MS = 30 * 60 * 1000;   // 30min — new convo per token
const FOLLOWUP_COOLDOWN_MS = 15 * 60 * 1000;            // 15min — follow-up round
const MAX_CONVERSATIONS_PER_HOUR = 60;
const STAGGER_DELAY_MS = 1500;                           // 1.5s between LLM calls
const MAX_NEW_PER_CYCLE = 5;                             // New conversations per cycle
const MAX_FOLLOWUPS_PER_CYCLE = 8;                       // Follow-up rounds per cycle

let hourlyConversationCount = 0;
let hourlyResetAt = Date.now() + 60 * 60 * 1000;

function resetHourlyIfNeeded() {
  if (Date.now() > hourlyResetAt) {
    hourlyConversationCount = 0;
    hourlyResetAt = Date.now() + 60 * 60 * 1000;
  }
}

// ── Token Filtering ──────────────────────────────────────

async function findNewCandidates(): Promise<TokenContext[]> {
  const hotTokens = getHotTokens();
  if (hotTokens.length === 0) return [];

  const recentCutoff = new Date(Date.now() - NEW_CONVERSATION_COOLDOWN_MS);
  const recentConversations = await db.agentConversation.findMany({
    where: {
      createdAt: { gte: recentCutoff },
      tokenMint: { not: null },
    },
    select: { tokenMint: true },
  });

  const recentMints = new Set(recentConversations.map(c => c.tokenMint).filter(Boolean));

  const candidates = hotTokens.filter(token => {
    if (recentMints.has(token.tokenMint)) return false;
    if ((token.volume24h || 0) < 30_000) return false;
    return true;
  });

  return candidates;
}

/**
 * Find tokens with stale conversations that need follow-up messages.
 * Returns tokens whose last message is older than FOLLOWUP_COOLDOWN.
 */
async function findFollowUpCandidates(): Promise<TokenContext[]> {
  const hotTokens = getHotTokens();
  if (hotTokens.length === 0) return [];

  const staleCutoff = new Date(Date.now() - FOLLOWUP_COOLDOWN_MS);
  const mints = hotTokens.map(t => t.tokenMint);

  // Find conversations with last message older than cooldown
  const staleConversations = await db.agentConversation.findMany({
    where: {
      tokenMint: { in: mints },
      topic: { contains: 'Trading Discussion' },
    },
    include: {
      messages: {
        take: 1,
        orderBy: { timestamp: 'desc' as const },
        select: { timestamp: true },
      },
    },
  });

  // Track the MOST RECENT message per token (across all conversations)
  const latestMessagePerMint = new Map<string, Date>();
  for (const conv of staleConversations) {
    if (!conv.tokenMint) continue;
    const lastMsg = conv.messages[0]?.timestamp;
    if (lastMsg) {
      const existing = latestMessagePerMint.get(conv.tokenMint);
      if (!existing || lastMsg > existing) {
        latestMessagePerMint.set(conv.tokenMint, lastMsg);
      }
    }
  }

  // Token is stale if its most recent message (across ALL conversations) is old enough
  const staleMints = new Set<string>();
  for (const [mint, lastMsg] of latestMessagePerMint) {
    if (lastMsg < staleCutoff) {
      staleMints.add(mint);
    }
  }
  // Also include tokens with conversations but no messages at all
  for (const conv of staleConversations) {
    if (conv.tokenMint && conv.messages.length === 0) {
      staleMints.add(conv.tokenMint);
    }
  }

  // Return stale tokens sorted by staleness (oldest last message first = most neglected)
  const staleTokens = hotTokens.filter(t => staleMints.has(t.tokenMint));
  staleTokens.sort((a, b) => {
    const aLast = latestMessagePerMint.get(a.tokenMint)?.getTime() || 0;
    const bLast = latestMessagePerMint.get(b.tokenMint)?.getTime() || 0;
    return aLast - bLast; // oldest first
  });
  return staleTokens;
}

function classifyTokenTrigger(token: TokenContext): ConversationTrigger {
  const change = token.priceChange24h || 0;
  if (Math.abs(change) > 30) return ConversationTrigger.TOKEN_RUNNER;
  if (token.source === 'token_deployment' || token.source === 'migration') {
    return ConversationTrigger.TOKEN_MIGRATION;
  }
  return ConversationTrigger.TOKEN_TRENDING;
}

// ── Main Engine Cycle ────────────────────────────────────

async function runDiscussionCycle(): Promise<void> {
  const cycleStart = Date.now();
  console.log('\n🔄 [DiscussionEngine] Starting cycle...');

  resetHourlyIfNeeded();

  if (hourlyConversationCount >= MAX_CONVERSATIONS_PER_HOUR) {
    console.log(`[DiscussionEngine] Hourly cap reached (${MAX_CONVERSATIONS_PER_HOUR}), skipping`);
    return;
  }

  let generated = 0;

  // ── Phase A: New conversations for tokens without recent ones ──
  const newCandidates = await findNewCandidates();
  if (newCandidates.length > 0) {
    const sorted = [...newCandidates].sort((a, b) => {
      const aChange = Math.abs(a.priceChange24h || 0);
      const bChange = Math.abs(b.priceChange24h || 0);
      if (aChange > 30 && bChange <= 30) return -1;
      if (bChange > 30 && aChange <= 30) return 1;
      return (b.volume24h || 0) - (a.volume24h || 0);
    });

    const toCreate = sorted.slice(0, Math.min(MAX_NEW_PER_CYCLE, MAX_CONVERSATIONS_PER_HOUR - hourlyConversationCount));
    console.log(`[DiscussionEngine] Phase A: ${newCandidates.length} candidates → creating ${toCreate.length} new discussions`);

    for (const token of toCreate) {
      if (hourlyConversationCount >= MAX_CONVERSATIONS_PER_HOUR) break;
      const trigger = classifyTokenTrigger(token);
      const result = await generateTokenConversation(trigger, token);
      if (result) {
        hourlyConversationCount++;
        generated++;
        console.log(`  ✅ NEW $${token.tokenSymbol}: ${result.messagesPosted} msgs by [${result.agents.join(', ')}]`);
      }
      await new Promise(r => setTimeout(r, STAGGER_DELAY_MS));
    }
  }

  // ── Phase B: Follow-up rounds for stale conversations ──
  const followUpCandidates = await findFollowUpCandidates();
  if (followUpCandidates.length > 0 && hourlyConversationCount < MAX_CONVERSATIONS_PER_HOUR) {
    // Prioritize tokens with OLDEST last message (most stale first)
    // This ensures all tokens rotate through follow-ups, not just highest volume
    const sorted = [...followUpCandidates];
    const toFollowUp = sorted.slice(0, Math.min(MAX_FOLLOWUPS_PER_CYCLE, MAX_CONVERSATIONS_PER_HOUR - hourlyConversationCount));
    console.log(`[DiscussionEngine] Phase B: ${followUpCandidates.length} stale → refreshing ${toFollowUp.length} conversations`);

    for (const token of toFollowUp) {
      if (hourlyConversationCount >= MAX_CONVERSATIONS_PER_HOUR) break;
      const trigger = classifyTokenTrigger(token);
      // generateTokenConversation will find the existing conversation and append to it
      const result = await generateTokenConversation(trigger, token);
      if (result) {
        hourlyConversationCount++;
        generated++;
        console.log(`  🔄 FOLLOWUP $${token.tokenSymbol}: +${result.messagesPosted} msgs`);
      }
      await new Promise(r => setTimeout(r, STAGGER_DELAY_MS));
    }
  }

  const elapsed = Date.now() - cycleStart;
  console.log(`🎉 [DiscussionEngine] Cycle done: ${generated} generated (${elapsed}ms, ${hourlyConversationCount}/${MAX_CONVERSATIONS_PER_HOUR} hourly)\n`);
}

// ── Cron Manager ─────────────────────────────────────────

const DISCUSSION_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
let discussionTimer: ReturnType<typeof setInterval> | null = null;

export function startTokenDiscussionEngine(): void {
  console.log('[DiscussionEngine] Starting (every 3 minutes)...');

  // First run after 45 seconds (give TrendingSync time to populate)
  setTimeout(() => {
    runDiscussionCycle().catch(err => {
      console.error('[DiscussionEngine] Initial cycle failed:', err);
    });

    discussionTimer = setInterval(() => {
      runDiscussionCycle().catch(err => {
        console.error('[DiscussionEngine] Cycle failed:', err);
      });
    }, DISCUSSION_INTERVAL_MS);
  }, 45 * 1000);
}

export function stopTokenDiscussionEngine(): void {
  if (discussionTimer) {
    clearInterval(discussionTimer);
    discussionTimer = null;
  }
  console.log('[DiscussionEngine] Stopped');
}
