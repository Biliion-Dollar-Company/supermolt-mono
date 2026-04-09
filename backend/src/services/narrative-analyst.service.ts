import { Prisma } from '@prisma/client';
import { db } from '../lib/db';
import { llmService } from './llm.service';
import { getNarrativeThreadFeed, type NarrativeFeedItem } from './narrative-intel.service';

const PROMPT_VERSION = 'narrative-analyst-v1';

interface NarrativeAnalysisOutput {
  summary: string;
  stance: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  confidence: number;
  opportunities: string[];
  risks: string[];
  signals: string[];
  trainingTags: string[];
}

interface NarrativeOutcomeSnapshot {
  capturedAt: string;
  narrative: {
    heatScore: number;
    tweetCount24h: number;
    kolMentions: number;
    bullPercent: number;
  };
  stats: {
    debateMessageCount: number;
    tradePostCount: number;
    socialPostCount: number;
    scoutCallCount: number;
  };
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function pickFeedHighlights(feed: NarrativeFeedItem[]) {
  const grouped = {
    debates: feed.filter(item => item.type === 'debate_message').slice(0, 4),
    scouts: feed.filter(item => item.type === 'scanner_call').slice(0, 3),
    trades: feed.filter(item => item.type === 'trade_post').slice(0, 3),
    posts: feed.filter(item => item.type === 'social_post').slice(0, 3),
  };

  return grouped;
}

function buildInputSnapshot(feed: NonNullable<Awaited<ReturnType<typeof getNarrativeThreadFeed>>>) {
  const highlights = pickFeedHighlights(feed.feed);

  return {
    narrative: {
      slug: feed.narrative.slug,
      name: feed.narrative.name,
      description: feed.narrative.description,
      heatScore: feed.narrative.heatScore,
      tweetCount24h: feed.narrative.tweetCount24h,
      kolMentions: feed.narrative.kolMentions,
      bullPercent: feed.narrative.bullPercent,
      lastDebateAt: feed.narrative.lastDebateAt,
      keywords: feed.narrative.keywords,
    },
    stats: feed.stats,
    highlights: {
      debates: highlights.debates.map(item => ({
        agentName: item.agentName,
        body: item.body,
        timestamp: item.timestamp,
      })),
      scouts: highlights.scouts.map(item => ({
        agentName: item.agentName,
        tokenSymbol: item.tokenSymbol,
        body: item.body,
        convictionScore: item.convictionScore,
        status: item.status,
        timestamp: item.timestamp,
      })),
      trades: highlights.trades.map(item => ({
        agentName: item.agentName,
        tokenSymbol: item.tokenSymbol,
        body: item.body,
        timestamp: item.timestamp,
      })),
      posts: highlights.posts.map(item => ({
        agentName: item.agentName,
        body: item.body,
        commentsCount: item.commentsCount,
        likesCount: item.likesCount,
        timestamp: item.timestamp,
      })),
    },
  };
}

function buildOutcomeSnapshot(feed: NonNullable<Awaited<ReturnType<typeof getNarrativeThreadFeed>>>): NarrativeOutcomeSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    narrative: {
      heatScore: feed.narrative.heatScore,
      tweetCount24h: feed.narrative.tweetCount24h,
      kolMentions: feed.narrative.kolMentions,
      bullPercent: feed.narrative.bullPercent,
    },
    stats: {
      debateMessageCount: feed.stats.debateMessageCount,
      tradePostCount: feed.stats.tradePostCount,
      socialPostCount: feed.stats.socialPostCount,
      scoutCallCount: feed.stats.scoutCallCount,
    },
  };
}

function getNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getBaselineOutcomeSnapshot(inputSnapshot: unknown): NarrativeOutcomeSnapshot {
  const snapshot = (inputSnapshot && typeof inputSnapshot === 'object')
    ? inputSnapshot as Record<string, any>
    : {};

  const narrative = (snapshot.narrative && typeof snapshot.narrative === 'object')
    ? snapshot.narrative as Record<string, any>
    : {};
  const stats = (snapshot.stats && typeof snapshot.stats === 'object')
    ? snapshot.stats as Record<string, any>
    : {};

  return {
    capturedAt: typeof snapshot.capturedAt === 'string' ? snapshot.capturedAt : '',
    narrative: {
      heatScore: getNumber(narrative.heatScore),
      tweetCount24h: getNumber(narrative.tweetCount24h),
      kolMentions: getNumber(narrative.kolMentions),
      bullPercent: getNumber(narrative.bullPercent),
    },
    stats: {
      debateMessageCount: getNumber(stats.debateMessageCount),
      tradePostCount: getNumber(stats.tradePostCount),
      socialPostCount: getNumber(stats.socialPostCount),
      scoutCallCount: getNumber(stats.scoutCallCount),
    },
  };
}

function mapAnalysisRun(run: {
  id: string;
  narrativeSlug: string;
  provider: string;
  model: string;
  promptVersion: string;
  summary: string;
  stance: string | null;
  confidence: number | null;
  rawText: string;
  inputSnapshot: Prisma.JsonValue;
  analysisJson: Prisma.JsonValue;
  outcomeSnapshot: Prisma.JsonValue | null;
  heatScoreDelta: number | null;
  tweetCountDelta: number | null;
  kolMentionsDelta: number | null;
  bullPercentDelta: number | null;
  debateMessageDelta: number | null;
  tradePostDelta: number | null;
  socialPostDelta: number | null;
  scoutCallDelta: number | null;
  labeledAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: run.id,
    narrativeSlug: run.narrativeSlug,
    provider: run.provider,
    model: run.model,
    promptVersion: run.promptVersion,
    summary: run.summary,
    stance: run.stance,
    confidence: run.confidence,
    rawText: run.rawText,
    inputSnapshot: run.inputSnapshot,
    analysisJson: run.analysisJson,
    outcomeSnapshot: run.outcomeSnapshot,
    heatScoreDelta: run.heatScoreDelta,
    tweetCountDelta: run.tweetCountDelta,
    kolMentionsDelta: run.kolMentionsDelta,
    bullPercentDelta: run.bullPercentDelta,
    debateMessageDelta: run.debateMessageDelta,
    tradePostDelta: run.tradePostDelta,
    socialPostDelta: run.socialPostDelta,
    scoutCallDelta: run.scoutCallDelta,
    labeledAt: run.labeledAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  };
}

function buildPrompts(snapshot: ReturnType<typeof buildInputSnapshot>) {
  const systemPrompt = `You are the Trench Terminal narrative analyst.
Your job is to read a live Solana narrative thread and produce structured analysis useful for:
1. helping agents and humans understand the meta
2. collecting high-quality training data for future model distillation

Return ONLY valid JSON with this shape:
{
  "summary": "2-4 sentence human-style analysis",
  "stance": "bullish|bearish|mixed|neutral",
  "confidence": 0-100,
  "opportunities": ["..."],
  "risks": ["..."],
  "signals": ["..."],
  "trainingTags": ["tag-one", "tag-two"]
}

Rules:
- Be concrete and concise.
- Ground claims in the provided evidence.
- Avoid hype and avoid generic filler.
- If evidence conflicts, say so in the summary and use "mixed".`;

  const userPrompt = `Analyze this Solana narrative thread snapshot:

${JSON.stringify(snapshot, null, 2)}`;

  return { systemPrompt, userPrompt };
}

function parseAnalysisResponse(response: string): NarrativeAnalysisOutput {
  let cleaned = response.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  const parsed = JSON.parse(cleaned) as Partial<NarrativeAnalysisOutput>;
  const stance = ['bullish', 'bearish', 'mixed', 'neutral'].includes(parsed.stance || '')
    ? parsed.stance as NarrativeAnalysisOutput['stance']
    : 'mixed';

  return {
    summary: (parsed.summary || 'No summary generated.').trim(),
    stance,
    confidence: clampConfidence(parsed.confidence),
    opportunities: uniqueNonEmpty(Array.isArray(parsed.opportunities) ? parsed.opportunities : []).slice(0, 5),
    risks: uniqueNonEmpty(Array.isArray(parsed.risks) ? parsed.risks : []).slice(0, 5),
    signals: uniqueNonEmpty(Array.isArray(parsed.signals) ? parsed.signals : []).slice(0, 6),
    trainingTags: uniqueNonEmpty(Array.isArray(parsed.trainingTags) ? parsed.trainingTags : []).slice(0, 8),
  };
}

export async function runNarrativeAnalysis(slug: string) {
  const providerInfo = llmService.getActiveProviderInfo();
  if (!providerInfo) {
    throw new Error('No LLM provider configured');
  }

  const feed = await getNarrativeThreadFeed(slug, 80);
  if (!feed) {
    return null;
  }

  const inputSnapshot = buildInputSnapshot(feed);
  const { systemPrompt, userPrompt } = buildPrompts(inputSnapshot);
  const rawText = await llmService.generate(systemPrompt, userPrompt, {
    temperature: 0.25,
    maxTokens: 900,
  });

  if (!rawText) {
    throw new Error('LLM returned empty analysis');
  }

  const analysis = parseAnalysisResponse(rawText);

  const created = await db.narrativeAnalysisRun.create({
    data: {
      narrativeSlug: slug,
      provider: providerInfo.provider,
      model: providerInfo.model,
      promptVersion: PROMPT_VERSION,
      summary: analysis.summary,
      stance: analysis.stance,
      confidence: analysis.confidence,
      rawText,
      inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonValue,
      analysisJson: analysis as unknown as Prisma.InputJsonValue,
    },
  });

  return mapAnalysisRun({
    ...created,
    outcomeSnapshot: null,
    heatScoreDelta: null,
    tweetCountDelta: null,
    kolMentionsDelta: null,
    bullPercentDelta: null,
    debateMessageDelta: null,
    tradePostDelta: null,
    socialPostDelta: null,
    scoutCallDelta: null,
    labeledAt: null,
  });
}

export async function getNarrativeAnalysisRuns(slug: string, limit = 10) {
  const runs = await db.narrativeAnalysisRun.findMany({
    where: { narrativeSlug: slug },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return runs.map(mapAnalysisRun);
}

export async function getLatestNarrativeAnalysis(slug: string) {
  const [latest] = await getNarrativeAnalysisRuns(slug, 1);
  return latest ?? null;
}

export async function labelNarrativeAnalysisOutcome(runId: string) {
  const run = await db.narrativeAnalysisRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return null;
  }

  const feed = await getNarrativeThreadFeed(run.narrativeSlug, 80);
  if (!feed) {
    throw new Error('Narrative not found for analysis run');
  }

  const baseline = getBaselineOutcomeSnapshot(run.inputSnapshot);
  const current = buildOutcomeSnapshot(feed);

  const updated = await db.narrativeAnalysisRun.update({
    where: { id: runId },
    data: {
      outcomeSnapshot: current as unknown as Prisma.InputJsonValue,
      heatScoreDelta: current.narrative.heatScore - baseline.narrative.heatScore,
      tweetCountDelta: Math.round(current.narrative.tweetCount24h - baseline.narrative.tweetCount24h),
      kolMentionsDelta: Math.round(current.narrative.kolMentions - baseline.narrative.kolMentions),
      bullPercentDelta: current.narrative.bullPercent - baseline.narrative.bullPercent,
      debateMessageDelta: Math.round(current.stats.debateMessageCount - baseline.stats.debateMessageCount),
      tradePostDelta: Math.round(current.stats.tradePostCount - baseline.stats.tradePostCount),
      socialPostDelta: Math.round(current.stats.socialPostCount - baseline.stats.socialPostCount),
      scoutCallDelta: Math.round(current.stats.scoutCallCount - baseline.stats.scoutCallCount),
      labeledAt: new Date(),
    },
  });

  return mapAnalysisRun(updated);
}
