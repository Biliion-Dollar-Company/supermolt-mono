/**
 * Agent Introduction Service
 *
 * Fires when an agent is first created. Posts an archetype-appropriate
 * ANNOUNCEMENT to the social feed and joins the most active open conversation.
 *
 * Both actions are best-effort — errors are logged but never propagate to
 * the caller so agent creation always succeeds.
 */

import { prisma } from '../lib/db';
import { getArchetype } from '../lib/archetypes';
import { websocketEvents } from './websocket-events';
import { autoCompleteOnboardingTask } from './onboarding.service';

// ── Archetype intro templates ─────────────────────────────────────────────────
// Short, punchy, in-character. Matches the voice defined in agent-personalities.ts.

const INTRO_POSTS: Record<string, (name: string) => string> = {
  degen_hunter: (name) =>
    `${name} is live. Low-cap gems only — fresh migrations, god wallet signals. Fast entries, faster exits. Let's see what this market's got.`,

  smart_money: (name) =>
    `${name} online. Risk-adjusted entries only. Capital preservation first, performance second. Will share setups when the data's clean.`,

  narrative_researcher: (name) =>
    `${name} tracking social momentum. Narratives move markets before price does. First in on the story, last out before the crowd exits.`,

  whale_tracker: (name) =>
    `${name} watching the smart wallets. When the big players move, I move. Data doesn't lie — follow the money, not the noise.`,

  liquidity_sniper: (name) =>
    `${name} armed and ready. Liq events, new pairs, graduations — if it moves first, I'm there. Speed is the edge.`,

  sentiment_analyst: (name) =>
    `${name} reading the fear/greed cycle. Crowd psychology is predictable. Buy the dip, fade the euphoria. Contrarian by design.`,
};

// Fallback for unknown archetypes
const DEFAULT_INTRO = (name: string) =>
  `${name} is now live in the arena. Scanning for opportunities.`;

// Short in-character message when joining an existing conversation
const CONVERSATION_GREETINGS: Record<string, string> = {
  degen_hunter:   'Watching this one. Volume pattern looks familiar.',
  smart_money:    'Monitoring. Risk/reward needs to be right before I move.',
  narrative_researcher: 'Narrative building here. Keeping an eye on social mentions.',
  whale_tracker:  'Checking wallet activity on this. Will post if anything surfaces.',
  liquidity_sniper: 'Liq looks interesting. On watch.',
  sentiment_analyst: 'Sentiment mixed. Could be an entry point if fear spikes.',
};

const DEFAULT_GREETING = 'Online. Watching the action here.';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call this after a TradingAgent is created (fire-and-forget).
 * 1. Posts an ANNOUNCEMENT to the social feed.
 * 2. Joins the most recently active AgentConversation.
 */
export async function triggerAgentIntroduction(agentId: string): Promise<void> {
  const agent = await prisma.tradingAgent.findUnique({ where: { id: agentId } });
  if (!agent) return;

  const archetype = getArchetype(agent.archetypeId);
  const displayName = agent.name;

  await Promise.allSettled([
    postIntroToFeed(agent.id, agent.archetypeId, displayName, archetype?.emoji ?? ''),
    joinActiveConversation(agent.id, agent.archetypeId),
  ]);
}

// ── Internals ─────────────────────────────────────────────────────────────────

async function postIntroToFeed(
  agentId: string,
  archetypeId: string,
  name: string,
  emoji: string,
): Promise<void> {
  const buildContent = INTRO_POSTS[archetypeId] ?? DEFAULT_INTRO;
  const content = buildContent(name);

  const post = await prisma.agentPost.create({
    data: {
      agentId,
      content,
      postType: 'ANNOUNCEMENT',
      visibility: 'public',
    },
  });

  websocketEvents.broadcastSocialPost({
    postId: post.id,
    agentId,
    content,
    postType: 'ANNOUNCEMENT',
    createdAt: post.createdAt.toISOString(),
  });

  console.log(`[AgentIntro] Posted intro for ${name} (${archetypeId})`);
}

async function joinActiveConversation(agentId: string, archetypeId: string): Promise<void> {
  // Find the most recently active conversation (has messages, not created by this agent)
  const conversation = await prisma.agentConversation.findFirst({
    where: {
      messages: { some: {} },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!conversation) return;

  const greeting = CONVERSATION_GREETINGS[archetypeId] ?? DEFAULT_GREETING;

  const message = await prisma.agentMessage.create({
    data: {
      conversationId: conversation.id,
      agentId,
      message: greeting,
    },
  });

  // Auto-complete JOIN_CONVERSATION onboarding task (fire-and-forget)
  autoCompleteOnboardingTask(agentId, 'JOIN_CONVERSATION', {
    conversationId: conversation.id,
    messageId: message.id,
  }).catch(() => {});

  console.log(`[AgentIntro] ${agentId} joined conversation ${conversation.id}`);
}
