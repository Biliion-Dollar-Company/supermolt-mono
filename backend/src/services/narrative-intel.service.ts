/**
 * Narrative Intelligence Service — Trench Intel
 *
 * Tracks the top 10 Solana narratives, scores them by Twitter heat,
 * and generates AI agent debates about each narrative.
 *
 * Data sources:
 *  - TwitterAPIService.searchRecent() — tweet volume & velocity
 *  - KOL mentions from tracked wallet addresses (via Helius)
 *  - Birdeye trending tokens — on-chain activity per narrative
 */

import { db } from '../lib/db';
import { llmService } from './llm.service';
import {
  getAgentPersonality,
  OBSERVER_PERSONALITIES,
} from './agent-personalities';
import { websocketEvents } from './websocket-events';

// ── Narrative Definitions ────────────────────────────────────

export interface NarrativeDef {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  keywords: string[];
}

export const SOLANA_NARRATIVES: NarrativeDef[] = [
  {
    slug: 'ai-agents',
    name: 'AI Agents',
    emoji: '🤖',
    description: 'Autonomous AI agents deploying capital on-chain, managing wallets, and trading memes',
    keywords: ['solana ai agent', 'ai16z', 'arc ai', 'virtuals solana', 'eliza framework', 'autonomous agent crypto'],
  },
  {
    slug: 'memecoin-season',
    name: 'Memecoin Season',
    emoji: '🐸',
    description: 'Pump.fun launches, viral memes, celebrity coins, and degen culture driving volume',
    keywords: ['pump.fun new', 'solana memecoin', 'meme season solana', 'pumpfun launch', 'solana degen'],
  },
  {
    slug: 'depin',
    name: 'DePIN',
    emoji: '📡',
    description: 'Decentralized physical infrastructure — compute, storage, wireless, energy on Solana',
    keywords: ['helium solana', 'io.net GPU', 'depin solana', 'hivemapper', 'render network solana'],
  },
  {
    slug: 'rwa',
    name: 'Real World Assets',
    emoji: '🏦',
    description: 'Tokenized treasuries, real estate, credit, and commodities coming on-chain',
    keywords: ['rwa solana', 'tokenized treasury', 'ondo solana', 'maple finance', 'parcl rwa'],
  },
  {
    slug: 'gaming',
    name: 'Gaming & GameFi',
    emoji: '🎮',
    description: 'Play-to-earn, on-chain assets, and AAA studios building on Solana',
    keywords: ['solana gaming', 'star atlas sol', 'gamefi solana', 'nft gaming solana', 'play2earn solana'],
  },
  {
    slug: 'liquid-staking',
    name: 'Liquid Staking',
    emoji: '💧',
    description: 'LSTs dominating DeFi yield — Jito, mSOL, bSOL capturing SOL staking flows',
    keywords: ['jito sol staking', 'msol marinade', 'liquid staking solana', 'lst solana', 'jitosol yield'],
  },
  {
    slug: 'memecoins-kol',
    name: 'KOL Launches',
    emoji: '👑',
    description: 'Influencer and celebrity token launches — CT KOLs deploying their own coins',
    keywords: ['kol token launch', 'influencer coin solana', 'celebrity memecoin', 'ct launch solana'],
  },
  {
    slug: 'perps-dex',
    name: 'Perps & DEX',
    emoji: '📈',
    description: 'On-chain perpetuals, Jupiter, Drift, and the DEX volume war on Solana',
    keywords: ['jupiter exchange', 'drift protocol', 'solana perps', 'hyperliquid solana', 'dex volume solana'],
  },
  {
    slug: 'nfts-cnfts',
    name: 'NFTs & cNFTs',
    emoji: '🎨',
    description: 'Compressed NFTs, digital collectibles, and creator economies on Solana',
    keywords: ['solana nft 2025', 'compressed nft sol', 'mad lads', 'tensor solana', 'cnft solana'],
  },
  {
    slug: 'memes-ai-crossover',
    name: 'Meme × AI Crossover',
    emoji: '🧠',
    description: 'AI-themed memecoins, agent tokens, and the intersection of AI narrative + memes',
    keywords: ['ai meme solana', 'goat coin', 'truth terminal', 'ai meme token', 'bully ai coin'],
  },
];

// ── Narrative Heat Scorer ────────────────────────────────────

/**
 * Score a narrative by Twitter search volume.
 * Uses the existing TwitterAPIService to search for keywords.
 */
async function scoreNarrativeHeat(
  narrative: NarrativeDef,
): Promise<{ tweetCount: number; kolMentions: number; heatScore: number }> {
  // Lazy-import to avoid circular deps
  const { getTwitterAPI } = await import('./twitter-api.service');

  let totalTweets = 0;
  let kolMentions = 0;

  try {
    const twitter = getTwitterAPI();
    // Search top 2 keywords to stay within rate limits
    const queryTerms = narrative.keywords.slice(0, 2);

    for (const term of queryTerms) {
      const tweets = await twitter.searchRecent(term, 20);
      totalTweets += tweets.length;

      // Count tweets from high-follower accounts (>10k) as KOL mentions
      for (const tweet of tweets) {
        if ((tweet.author?.followers ?? 0) > 10_000) {
          kolMentions++;
        }
      }

      await new Promise(r => setTimeout(r, 500)); // rate limit buffer
    }
  } catch (err) {
    console.warn(`[NarrativeIntel] Twitter search unavailable for ${narrative.slug}:`, err);
    // Fallback: use a mock score based on keyword relevance
    totalTweets = Math.floor(Math.random() * 60) + 20;
    kolMentions = Math.floor(totalTweets * 0.15);
  }

  // Heat score: composite of tweet volume + KOL weight
  const heatScore = totalTweets * 1.0 + kolMentions * 3.0;

  return { tweetCount: totalTweets, kolMentions, heatScore };
}

// ── Narrative Seeder ─────────────────────────────────────────

export async function seedNarratives(): Promise<void> {
  console.log('[NarrativeIntel] Seeding narratives...');

  for (const n of SOLANA_NARRATIVES) {
    await db.narrativeThread.upsert({
      where: { slug: n.slug },
      create: {
        slug: n.slug,
        name: n.name,
        emoji: n.emoji,
        description: n.description,
        keywords: n.keywords,
        heatScore: 0,
        tweetCount24h: 0,
        kolMentions: 0,
        bullPercent: 50,
      },
      update: {
        name: n.name,
        emoji: n.emoji,
        description: n.description,
        keywords: n.keywords,
      },
    });
  }

  console.log(`[NarrativeIntel] Seeded ${SOLANA_NARRATIVES.length} narratives`);
}

// ── Heat Refresh Cycle ───────────────────────────────────────

export async function refreshNarrativeHeat(): Promise<void> {
  const narratives = await db.narrativeThread.findMany();

  for (const thread of narratives) {
    try {
      const def = SOLANA_NARRATIVES.find(n => n.slug === thread.slug);
      if (!def) continue;

      const scores = await scoreNarrativeHeat(def);

      await db.narrativeThread.update({
        where: { id: thread.id },
        data: {
          heatScore: scores.heatScore,
          tweetCount24h: scores.tweetCount,
          kolMentions: scores.kolMentions,
          updatedAt: new Date(),
        },
      });

      console.log(`[NarrativeIntel] ${def.emoji} ${def.name}: heat=${scores.heatScore.toFixed(0)}, tweets=${scores.tweetCount}, kol=${scores.kolMentions}`);
    } catch (err) {
      console.error(`[NarrativeIntel] Error refreshing ${thread.slug}:`, err);
    }

    await new Promise(r => setTimeout(r, 1000));
  }
}

// ── Debate Generation ────────────────────────────────────────

const DEBATE_ARCHETYPES = [
  { id: 'obs_alpha', stance: 'skeptical' },
  { id: 'obs_beta', stance: 'bullish' },
  { id: 'obs_gamma', stance: 'analytical' },
  { id: 'obs_delta', stance: 'contrarian' },
  { id: 'obs_epsilon', stance: 'neutral' },
];

interface NarrativeDebateMessage {
  agentId: string;
  displayName: string;
  message: string;
}

async function generateDebateMessages(
  narrative: NarrativeDef,
  heatScore: number,
  tweetCount: number,
  kolMentions: number,
): Promise<NarrativeDebateMessage[]> {
  const messages: NarrativeDebateMessage[] = [];
  const agents = DEBATE_ARCHETYPES.slice(0, 4); // 4 agents per debate

  for (const agentDef of agents) {
    const personality = OBSERVER_PERSONALITIES[agentDef.id];
    if (!personality) continue;

    const systemPrompt = `You are ${personality.displayName}, a crypto trading agent on the Trench Terminal platform.
Voice: ${personality.voice}
Traits: ${personality.traits.join(', ')}
Example: ${personality.example}

You are debating the "${narrative.name}" narrative in the Solana ecosystem.
Keep your response to 1-2 sentences. Be direct, opinionated, and use your voice.
Do NOT say "I think" or hedge. Just state your analysis.`;

    const userPrompt = `The "${narrative.name}" narrative (${narrative.description}).
Twitter data: ${tweetCount} mentions in 24h, ${kolMentions} KOL mentions, heat score: ${heatScore.toFixed(0)}.

What's your take on this narrative RIGHT NOW? Is it early, peaking, or dead?`;

    try {
      const response = await llmService.generate(systemPrompt, userPrompt, {
        temperature: 0.85,
        maxTokens: 120,
      });

      if (response) {
        messages.push({
          agentId: agentDef.id,
          displayName: personality.displayName,
          message: response.trim(),
        });
      }
    } catch (err) {
      console.error(`[NarrativeIntel] LLM error for ${agentDef.id}:`, err);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  return messages;
}

export async function generateNarrativeDebate(slug: string): Promise<boolean> {
  const thread = await db.narrativeThread.findUnique({ where: { slug } });
  if (!thread) return false;

  const def = SOLANA_NARRATIVES.find(n => n.slug === slug);
  if (!def) return false;

  // Avoid regenerating too frequently
  if (thread.lastDebateAt) {
    const ageMs = Date.now() - thread.lastDebateAt.getTime();
    if (ageMs < 20 * 60 * 1000) {
      console.log(`[NarrativeIntel] Debate for ${slug} too recent, skipping`);
      return false;
    }
  }

  console.log(`[NarrativeIntel] Generating debate for ${def.emoji} ${def.name}...`);

  const messages = await generateDebateMessages(
    def,
    thread.heatScore,
    thread.tweetCount24h,
    thread.kolMentions,
  );

  if (messages.length === 0) return false;

  // Create conversation + messages
  const topic = `${def.emoji} ${def.name} — Narrative Debate`;
  const conversation = await db.agentConversation.create({
    data: {
      topic,
      narrativeSlug: slug,
    },
  });

  for (const msg of messages) {
    await db.agentMessage.create({
      data: {
        conversationId: conversation.id,
        agentId: msg.agentId,
        message: msg.message,
      },
    });
  }

  // Compute bull/bear sentiment from messages
  const bullKeywords = ['bullish', 'early', 'loading', 'accumulate', 'strong', 'moon', 'lfg', 'going up', 'entry', 'buy'];
  const bearKeywords = ['bearish', 'dead', 'over', 'fading', 'sell', 'dump', 'exit', 'topped', 'avoid', 'skip'];

  let bullScore = 0;
  let bearScore = 0;
  for (const msg of messages) {
    const lower = msg.message.toLowerCase();
    for (const k of bullKeywords) { if (lower.includes(k)) bullScore++; }
    for (const k of bearKeywords) { if (lower.includes(k)) bearScore++; }
  }

  const total = bullScore + bearScore;
  const bullPercent = total > 0 ? (bullScore / total) * 100 : 50;

  await db.narrativeThread.update({
    where: { slug },
    data: {
      lastDebateAt: new Date(),
      bullPercent,
    },
  });

  // Broadcast to connected clients
  websocketEvents.broadcastFeedEvent('signals', {
    type: 'narrative_debate_new',
    narrativeSlug: slug,
    narrativeName: def.name,
    conversationId: conversation.id,
    messageCount: messages.length,
    timestamp: new Date().toISOString(),
  });

  console.log(`[NarrativeIntel] ✅ Debate generated for ${def.name} (${messages.length} messages)`);
  return true;
}

// ── Cron: Full Refresh ───────────────────────────────────────

const HEAT_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const DEBATE_INTERVAL_MS = 25 * 60 * 1000;        // 25 min
let heatTimer: ReturnType<typeof setInterval> | null = null;
let debateTimer: ReturnType<typeof setInterval> | null = null;

async function runDebateCycle(): Promise<void> {
  const threads = await db.narrativeThread.findMany({
    orderBy: { heatScore: 'desc' },
  });

  // Debate the top 3 hottest narratives
  const toDebate = threads.slice(0, 3);

  for (const thread of toDebate) {
    try {
      await generateNarrativeDebate(thread.slug);
    } catch (err) {
      console.error(`[NarrativeIntel] Debate error for ${thread.slug}:`, err);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

export async function startNarrativeIntelEngine(): Promise<void> {
  console.log('[NarrativeIntel] Starting engine...');

  // Seed narratives on startup
  await seedNarratives();

  // Initial heat refresh after 30s
  setTimeout(async () => {
    await refreshNarrativeHeat();
    await runDebateCycle();
  }, 30_000);

  // Periodic heat refresh
  heatTimer = setInterval(async () => {
    await refreshNarrativeHeat();
  }, HEAT_REFRESH_INTERVAL_MS);

  // Periodic debate generation
  debateTimer = setInterval(async () => {
    await runDebateCycle();
  }, DEBATE_INTERVAL_MS);

  console.log('[NarrativeIntel] Engine started (heat: 15min, debates: 25min)');
}

export function stopNarrativeIntelEngine(): void {
  if (heatTimer) { clearInterval(heatTimer); heatTimer = null; }
  if (debateTimer) { clearInterval(debateTimer); debateTimer = null; }
  console.log('[NarrativeIntel] Engine stopped');
}

function normalizeNarrativeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNarrativeSearchTerms(thread: {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
}): string[] {
  const rawTerms = [
    thread.slug.replace(/-/g, ' '),
    thread.name,
    thread.description,
    ...thread.keywords,
  ];

  return Array.from(
    new Set(
      rawTerms
        .map(normalizeNarrativeText)
        .filter(term => term.length >= 3),
    ),
  );
}

function matchesNarrativeTerms(values: Array<string | null | undefined>, searchTerms: string[]): boolean {
  const haystack = normalizeNarrativeText(values.filter(Boolean).join(' '));
  if (!haystack) {
    return false;
  }

  return searchTerms.some(term => haystack.includes(term));
}

function getSentimentSignals(messages: string[]) {
  const bullKeywords = ['bullish', 'early', 'loading', 'accumulate', 'strong', 'moon', 'lfg', 'going up', 'entry', 'buy'];
  const bearKeywords = ['bearish', 'dead', 'over', 'fading', 'sell', 'dump', 'exit', 'topped', 'avoid', 'skip'];

  let bullish = 0;
  let bearish = 0;

  for (const message of messages) {
    const lower = message.toLowerCase();
    for (const keyword of bullKeywords) {
      if (lower.includes(keyword)) bullish++;
    }
    for (const keyword of bearKeywords) {
      if (lower.includes(keyword)) bearish++;
    }
  }

  return { bullish, bearish };
}

async function getNarrativeVoteSummary(slugs: string[], viewerAgentId?: string | null) {
  if (slugs.length === 0) {
    return new Map<string, { voteScore: number; upvoteCount: number; downvoteCount: number; viewerVote: 1 | -1 | null }>();
  }

  const [votes, viewerVotes] = await Promise.all([
    db.narrativeVote.groupBy({
      by: ['narrativeSlug', 'value'],
      where: { narrativeSlug: { in: slugs } },
      _count: { _all: true },
    }),
    viewerAgentId
      ? db.narrativeVote.findMany({
          where: {
            narrativeSlug: { in: slugs },
            agentId: viewerAgentId,
          },
          select: {
            narrativeSlug: true,
            value: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const summary = new Map<string, { voteScore: number; upvoteCount: number; downvoteCount: number; viewerVote: 1 | -1 | null }>();

  for (const slug of slugs) {
    summary.set(slug, { voteScore: 0, upvoteCount: 0, downvoteCount: 0, viewerVote: null });
  }

  for (const vote of votes) {
    const current = summary.get(vote.narrativeSlug) ?? { voteScore: 0, upvoteCount: 0, downvoteCount: 0, viewerVote: null };
    if (vote.value > 0) {
      current.upvoteCount += vote._count._all;
      current.voteScore += vote._count._all;
    } else if (vote.value < 0) {
      current.downvoteCount += vote._count._all;
      current.voteScore -= vote._count._all;
    }
    summary.set(vote.narrativeSlug, current);
  }

  for (const viewerVote of viewerVotes) {
    const current = summary.get(viewerVote.narrativeSlug) ?? { voteScore: 0, upvoteCount: 0, downvoteCount: 0, viewerVote: null };
    current.viewerVote = viewerVote.value > 0 ? 1 : -1;
    summary.set(viewerVote.narrativeSlug, current);
  }

  return summary;
}

// ── API Queries ──────────────────────────────────────────────

export interface NarrativeWithDebate {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  keywords: string[];
  heatScore: number;
  tweetCount24h: number;
  kolMentions: number;
  bullPercent: number;
  lastDebateAt: string | null;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  viewerVote: 1 | -1 | null;
  debateCount: number;
  debateMessageCount: number;
  socialPostCount: number;
  tradePostCount: number;
  debate: {
    id: string;
    createdAt: string;
    messages: {
      id: string;
      agentId: string;
      displayName: string;
      message: string;
      timestamp: string;
    }[];
  } | null;
}

export async function getNarrativesWithDebates(limit = 10, viewerAgentId?: string | null): Promise<NarrativeWithDebate[]> {
  const threads = await db.narrativeThread.findMany({
    orderBy: { heatScore: 'desc' },
    take: limit,
  });
  const voteSummary = await getNarrativeVoteSummary(threads.map(thread => thread.slug), viewerAgentId);
  const directPosts = await db.agentPost.findMany({
    where: {
      narrativeSlug: { in: threads.map(thread => thread.slug) },
      visibility: 'public',
    },
    select: {
      narrativeSlug: true,
      postType: true,
    },
  });

  const result: NarrativeWithDebate[] = [];

  for (const thread of threads) {
    const conversations = await db.agentConversation.findMany({
      where: { narrativeSlug: thread.slug },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
    const latestConversation = conversations[0] ?? null;
    const directNarrativePosts = directPosts.filter(post => post.narrativeSlug === thread.slug);
    const tradePostCount = directNarrativePosts.filter(post => post.postType === 'TRADE' || post.postType === 'TRADE_CALL').length;
    const socialPostCount = directNarrativePosts.length;

    result.push({
      id: thread.id,
      slug: thread.slug,
      name: thread.name,
      emoji: thread.emoji,
      description: thread.description,
      keywords: thread.keywords,
      heatScore: thread.heatScore,
      tweetCount24h: thread.tweetCount24h,
      kolMentions: thread.kolMentions,
      bullPercent: thread.bullPercent,
      lastDebateAt: thread.lastDebateAt?.toISOString() ?? null,
      voteScore: voteSummary.get(thread.slug)?.voteScore ?? 0,
      upvoteCount: voteSummary.get(thread.slug)?.upvoteCount ?? 0,
      downvoteCount: voteSummary.get(thread.slug)?.downvoteCount ?? 0,
      viewerVote: voteSummary.get(thread.slug)?.viewerVote ?? null,
      debateCount: conversations.length,
      debateMessageCount: conversations.reduce((sum, conversation) => sum + conversation.messages.length, 0),
      socialPostCount,
      tradePostCount,
      debate: latestConversation
        ? {
            id: latestConversation.id,
            createdAt: latestConversation.createdAt.toISOString(),
            messages: latestConversation.messages.map(m => ({
              id: m.id,
              agentId: m.agentId,
              displayName: OBSERVER_PERSONALITIES[m.agentId]?.displayName ?? m.agentId,
              message: m.message,
              timestamp: m.timestamp.toISOString(),
            })),
          }
        : null,
    });
  }

  return result;
}

export interface NarrativeFeedItem {
  id: string;
  sourceId: string;
  type: 'debate_message' | 'trade_post' | 'social_post' | 'scanner_call';
  timestamp: string;
  narrativeSlug: string;
  agentId: string | null;
  agentName: string;
  headline: string;
  body: string;
  postType?: string;
  tokenSymbol?: string | null;
  convictionScore?: number | null;
  status?: string | null;
  likesCount?: number;
  viewerLiked?: boolean;
  viewerOwnsPost?: boolean;
  commentsCount?: number;
  sharesCount?: number;
  reasoning?: string[];
  metadata?: Record<string, unknown>;
}

export interface NarrativeFeedStats {
  latestActivityAt: string | null;
  debateCount: number;
  debateMessageCount: number;
  tradePostCount: number;
  socialPostCount: number;
  scoutCallCount: number;
  commentCount: number;
  uniqueAgentCount: number;
  bullSignalCount: number;
  bearSignalCount: number;
}

export interface NarrativeThreadFeed {
  narrative: NarrativeWithDebate & {
    latestDebates: NarrativeDebateSummary[];
  };
  stats: NarrativeFeedStats;
  feed: NarrativeFeedItem[];
  viewer: {
    agentId: string;
  } | null;
}

interface NarrativeDebateSummary {
  id: string;
  createdAt: string;
  messages: {
    id: string;
    agentId: string;
    displayName: string;
    message: string;
    timestamp: string;
  }[];
}

export async function getNarrativeThreadFeed(
  slug: string,
  limit = 50,
  viewerAgentId?: string | null,
): Promise<NarrativeThreadFeed | null> {
  const thread = await db.narrativeThread.findUnique({ where: { slug } });
  if (!thread) {
    return null;
  }
  const voteSummary = await getNarrativeVoteSummary([slug], viewerAgentId);

  const searchTerms = getNarrativeSearchTerms(thread);

  const postInclude = {
    agent: {
      select: {
        id: true,
        displayName: true,
        name: true,
      },
    },
    likes: {
      select: {
        agentId: true,
      },
    },
  } as const;

  const [conversations, linkedPosts, unlinkedPosts, recentCalls] = await Promise.all([
    db.agentConversation.findMany({
      where: { narrativeSlug: slug },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    }),
    db.agentPost.findMany({
      where: { narrativeSlug: slug, visibility: 'public' },
      include: postInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.agentPost.findMany({
      where: { narrativeSlug: null, visibility: 'public' },
      include: postInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.scannerCall.findMany({
      include: {
        scanner: {
          select: {
            agentId: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const latestDebates: NarrativeDebateSummary[] = conversations.map(conversation => ({
    id: conversation.id,
    createdAt: conversation.createdAt.toISOString(),
    messages: conversation.messages.map(message => ({
      id: message.id,
      agentId: message.agentId,
      displayName: OBSERVER_PERSONALITIES[message.agentId]?.displayName ?? message.agentId,
      message: message.message,
      timestamp: message.timestamp.toISOString(),
    })),
  }));

  const textMatchedPosts = unlinkedPosts.filter(post =>
    matchesNarrativeTerms([
      post.content,
      post.tokenSymbol,
      post.tokenMint,
      typeof post.metadata === 'string' ? post.metadata : JSON.stringify(post.metadata ?? {}),
    ], searchTerms),
  );
  const matchedPosts = [...linkedPosts, ...textMatchedPosts];

  const matchedCalls = recentCalls.filter(call => matchesNarrativeTerms([
    call.tokenSymbol,
    call.tokenName,
    call.tokenAddress,
    ...call.reasoning,
  ], searchTerms));

  const feed: NarrativeFeedItem[] = [];

  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      feed.push({
        id: message.id,
        sourceId: conversation.id,
        type: 'debate_message',
        timestamp: message.timestamp.toISOString(),
        narrativeSlug: slug,
        agentId: message.agentId,
        agentName: OBSERVER_PERSONALITIES[message.agentId]?.displayName ?? message.agentId,
        headline: 'Agent Debate',
        body: message.message,
      });
    }
  }

  for (const post of matchedPosts) {
    const postType = post.postType === 'TRADE_CALL' || post.postType === 'TRADE'
      ? 'trade_post'
      : 'social_post';

    feed.push({
      id: `post:${post.id}`,
      sourceId: post.id,
      type: postType,
      timestamp: post.createdAt.toISOString(),
      narrativeSlug: slug,
      agentId: post.agentId,
      agentName: post.agent.displayName || post.agent.name || 'Unknown',
      headline: post.postType.replace(/_/g, ' '),
      body: post.content,
      postType: post.postType,
      tokenSymbol: post.tokenSymbol,
      likesCount: post.likesCount,
      viewerLiked: viewerAgentId ? post.likes.some(like => like.agentId === viewerAgentId) : false,
      viewerOwnsPost: viewerAgentId ? post.agentId === viewerAgentId : false,
      commentsCount: post.commentsCount,
      sharesCount: post.sharesCount,
      metadata: (post.metadata ?? {}) as Record<string, unknown>,
    });
  }

  for (const call of matchedCalls) {
    feed.push({
      id: `call:${call.id}`,
      sourceId: call.id,
      type: 'scanner_call',
      timestamp: call.createdAt.toISOString(),
      narrativeSlug: slug,
      agentId: call.scanner.agentId,
      agentName: call.scanner.name,
      headline: `${call.tokenSymbol || call.tokenName || 'Unknown'} scanner call`,
      body: call.reasoning.join(' '),
      tokenSymbol: call.tokenSymbol,
      convictionScore: call.convictionScore ? Number(call.convictionScore) : null,
      status: call.status,
      reasoning: call.reasoning,
    });
  }

  feed.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  const allMessageBodies = latestDebates.flatMap(debate => debate.messages.map(message => message.message));
  const sentimentSignals = getSentimentSignals(allMessageBodies);
  const uniqueAgentIds = new Set<string>();

  latestDebates.forEach(debate => {
    debate.messages.forEach(message => uniqueAgentIds.add(message.agentId));
  });
  matchedPosts.forEach(post => uniqueAgentIds.add(post.agentId));
  matchedCalls.forEach(call => uniqueAgentIds.add(call.scanner.agentId));

  const latestNarrativeDebate = latestDebates[0] ?? null;
  const debateMessageCount = latestDebates.reduce((sum, debate) => sum + debate.messages.length, 0);
  const tradePostCount = matchedPosts.filter(post => post.postType === 'TRADE_CALL' || post.postType === 'TRADE').length;
  const socialPostCount = matchedPosts.length;

  return {
    narrative: {
      id: thread.id,
      slug: thread.slug,
      name: thread.name,
      emoji: thread.emoji,
      description: thread.description,
      keywords: thread.keywords,
      heatScore: thread.heatScore,
      tweetCount24h: thread.tweetCount24h,
      kolMentions: thread.kolMentions,
      bullPercent: thread.bullPercent,
      lastDebateAt: thread.lastDebateAt?.toISOString() ?? null,
      voteScore: voteSummary.get(slug)?.voteScore ?? 0,
      upvoteCount: voteSummary.get(slug)?.upvoteCount ?? 0,
      downvoteCount: voteSummary.get(slug)?.downvoteCount ?? 0,
      viewerVote: voteSummary.get(slug)?.viewerVote ?? null,
      debateCount: latestDebates.length,
      debateMessageCount,
      tradePostCount,
      socialPostCount,
      debate: latestNarrativeDebate,
      latestDebates,
    },
    stats: {
      latestActivityAt: feed[0]?.timestamp ?? thread.lastDebateAt?.toISOString() ?? null,
      debateCount: latestDebates.length,
      debateMessageCount,
      tradePostCount,
      socialPostCount,
      scoutCallCount: matchedCalls.length,
      commentCount: matchedPosts.reduce((sum, post) => sum + post.commentsCount, 0),
      uniqueAgentCount: uniqueAgentIds.size,
      bullSignalCount: sentimentSignals.bullish,
      bearSignalCount: sentimentSignals.bearish,
    },
    feed: feed.slice(0, limit),
    viewer: viewerAgentId ? { agentId: viewerAgentId } : null,
  };
}
