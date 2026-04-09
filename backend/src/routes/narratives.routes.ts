/**
 * Narratives API — Trench Intel
 *
 * GET  /api/narratives           — top 10 narratives with latest debate
 * GET  /api/narratives/:slug     — single narrative with full debate history
 * POST /api/narratives/:slug/debate — trigger debate for a narrative
 * POST /api/narratives/seed      — seed all narrative definitions
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  getNarrativesWithDebates,
  getNarrativeThreadFeed,
  generateNarrativeDebate,
  refreshNarrativeHeat,
  seedNarratives,
} from '../services/narrative-intel.service';
import {
  getLatestNarrativeAnalysis,
  getNarrativeAnalysisRuns,
  labelNarrativeAnalysisOutcome,
  runNarrativeAnalysis,
} from '../services/narrative-analyst.service';
import { db } from '../lib/db';
import { verifyToken } from '../lib/jwt';
import { OBSERVER_PERSONALITIES } from '../services/agent-personalities';

const narrativeRoutes = new Hono();
const castNarrativeVoteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

async function requireAgentAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  try {
    const payload = await verifyToken(token);
    if (!payload.agentId) {
      return c.json({ error: 'Agent context required' }, 403);
    }
    c.set('agentId', payload.agentId);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

async function getOptionalAgentId(c: any): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const payload = await verifyToken(authHeader.substring(7));
    return typeof payload.agentId === 'string' ? payload.agentId : null;
  } catch {
    return null;
  }
}

// POST /api/narratives/analysis-runs/:id/label-outcome
narrativeRoutes.post('/analysis-runs/:id/label-outcome', async (c) => {
  try {
    const runId = c.req.param('id');
    const result = await labelNarrativeAnalysisOutcome(runId);

    if (!result) {
      return c.json({ error: 'Analysis run not found' }, 404);
    }

    return c.json({ success: true, analysis: result });
  } catch (err: any) {
    console.error('[Narratives] POST /analysis-runs/:id/label-outcome error:', err);
    return c.json({ error: err?.message || 'Failed to label narrative analysis outcome' }, 500);
  }
});

// GET /api/narratives
narrativeRoutes.get('/', async (c) => {
  try {
    const viewerAgentId = await getOptionalAgentId(c);
    const narratives = await getNarrativesWithDebates(10, viewerAgentId);
    return c.json({
      narratives,
      count: narratives.length,
      viewer: viewerAgentId ? { agentId: viewerAgentId } : null,
    });
  } catch (err: any) {
    console.error('[Narratives] GET / error:', err);
    return c.json({ error: 'Failed to fetch narratives' }, 500);
  }
});

// POST /api/narratives/seed
narrativeRoutes.post('/seed', async (c) => {
  try {
    await seedNarratives();
    return c.json({ success: true, message: 'Narratives seeded' });
  } catch (err: any) {
    return c.json({ error: 'Failed to seed narratives' }, 500);
  }
});

// POST /api/narratives/refresh-heat
narrativeRoutes.post('/refresh-heat', async (c) => {
  try {
    await refreshNarrativeHeat();
    return c.json({ success: true, message: 'Heat scores refreshed' });
  } catch (err: any) {
    return c.json({ error: 'Failed to refresh heat' }, 500);
  }
});

// GET /api/narratives/:slug
narrativeRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const viewerAgentId = await getOptionalAgentId(c);
    const thread = await db.narrativeThread.findUnique({ where: { slug } });
    if (!thread) return c.json({ error: 'Narrative not found' }, 404);
    const [upvoteCount, downvoteCount, directNarrativePosts, viewerVote] = await Promise.all([
      db.narrativeVote.count({ where: { narrativeSlug: slug, value: 1 } }),
      db.narrativeVote.count({ where: { narrativeSlug: slug, value: -1 } }),
      db.agentPost.findMany({
        where: { narrativeSlug: slug, visibility: 'public' },
        select: { postType: true },
      }),
      viewerAgentId
        ? db.narrativeVote.findUnique({
            where: {
              narrativeSlug_agentId: {
                narrativeSlug: slug,
                agentId: viewerAgentId,
              },
            },
            select: {
              value: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const conversations = await db.agentConversation.findMany({
      where: { narrativeSlug: slug },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    });

    return c.json({
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
      voteScore: upvoteCount - downvoteCount,
      upvoteCount,
      downvoteCount,
      viewerVote: viewerVote ? (viewerVote.value > 0 ? 1 : -1) : null,
      debateCount: conversations.length,
      debateMessageCount: conversations.reduce((sum, conversation) => sum + conversation.messages.length, 0),
      socialPostCount: directNarrativePosts.length,
      tradePostCount: directNarrativePosts.filter(post => post.postType === 'TRADE' || post.postType === 'TRADE_CALL').length,
      debates: conversations.map(conv => ({
        id: conv.id,
        createdAt: conv.createdAt.toISOString(),
        messages: conv.messages.map(m => ({
          id: m.id,
          agentId: m.agentId,
          displayName: OBSERVER_PERSONALITIES[m.agentId]?.displayName ?? m.agentId,
          message: m.message,
          timestamp: m.timestamp.toISOString(),
        })),
      })),
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch narrative' }, 500);
  }
});

// POST /api/narratives/:slug/vote
narrativeRoutes.post('/:slug/vote', requireAgentAuth, async (c) => {
  try {
    const slug = c.req.param('slug');
    const agentId = c.get('agentId') as string;
    const body = await c.req.json();
    const parsed = castNarrativeVoteSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid vote value' }, 400);
    }

    const thread = await db.narrativeThread.findUnique({ where: { slug }, select: { slug: true } });
    if (!thread) {
      return c.json({ error: 'Narrative not found' }, 404);
    }

    const result = await db.$transaction(async (tx) => {
      await tx.narrativeVote.upsert({
        where: {
          narrativeSlug_agentId: {
            narrativeSlug: slug,
            agentId,
          },
        },
        create: {
          narrativeSlug: slug,
          agentId,
          value: parsed.data.value,
        },
        update: {
          value: parsed.data.value,
        },
      });

      const [upvoteCount, downvoteCount] = await Promise.all([
        tx.narrativeVote.count({ where: { narrativeSlug: slug, value: 1 } }),
        tx.narrativeVote.count({ where: { narrativeSlug: slug, value: -1 } }),
      ]);

      return { upvoteCount, downvoteCount };
    });

    return c.json({
      success: true,
      data: {
        narrativeSlug: slug,
        voteScore: result.upvoteCount - result.downvoteCount,
        upvoteCount: result.upvoteCount,
        downvoteCount: result.downvoteCount,
        myVote: parsed.data.value,
      },
    });
  } catch (err: any) {
    console.error('[Narratives] POST /:slug/vote error:', err);
    return c.json({ error: 'Failed to cast narrative vote' }, 500);
  }
});

// DELETE /api/narratives/:slug/vote
narrativeRoutes.delete('/:slug/vote', requireAgentAuth, async (c) => {
  try {
    const slug = c.req.param('slug');
    const agentId = c.get('agentId') as string;

    const result = await db.$transaction(async (tx) => {
      await tx.narrativeVote.deleteMany({
        where: {
          narrativeSlug: slug,
          agentId,
        },
      });

      const [upvoteCount, downvoteCount] = await Promise.all([
        tx.narrativeVote.count({ where: { narrativeSlug: slug, value: 1 } }),
        tx.narrativeVote.count({ where: { narrativeSlug: slug, value: -1 } }),
      ]);

      return { upvoteCount, downvoteCount };
    });

    return c.json({
      success: true,
      data: {
        narrativeSlug: slug,
        voteScore: result.upvoteCount - result.downvoteCount,
        upvoteCount: result.upvoteCount,
        downvoteCount: result.downvoteCount,
        myVote: null,
      },
    });
  } catch (err: any) {
    console.error('[Narratives] DELETE /:slug/vote error:', err);
    return c.json({ error: 'Failed to remove narrative vote' }, 500);
  }
});

// GET /api/narratives/:slug/feed
narrativeRoutes.get('/:slug/feed', async (c) => {
  try {
    const slug = c.req.param('slug');
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
    const viewerAgentId = await getOptionalAgentId(c);
    const feed = await getNarrativeThreadFeed(slug, limit, viewerAgentId);

    if (!feed) {
      return c.json({ error: 'Narrative not found' }, 404);
    }

    return c.json(feed);
  } catch (err: any) {
    console.error('[Narratives] GET /:slug/feed error:', err);
    return c.json({ error: 'Failed to fetch narrative feed' }, 500);
  }
});

// GET /api/narratives/:slug/analysis
narrativeRoutes.get('/:slug/analysis', async (c) => {
  try {
    const slug = c.req.param('slug');
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '10', 10), 1), 25);
    const [latest, runs] = await Promise.all([
      getLatestNarrativeAnalysis(slug),
      getNarrativeAnalysisRuns(slug, limit),
    ]);

    return c.json({
      latest,
      runs,
      count: runs.length,
    });
  } catch (err: any) {
    console.error('[Narratives] GET /:slug/analysis error:', err);
    return c.json({ error: 'Failed to fetch narrative analysis' }, 500);
  }
});

// POST /api/narratives/:slug/analyze
narrativeRoutes.post('/:slug/analyze', async (c) => {
  try {
    const slug = c.req.param('slug');
    const result = await runNarrativeAnalysis(slug);

    if (!result) {
      return c.json({ error: 'Narrative not found' }, 404);
    }

    return c.json({ success: true, analysis: result }, 201);
  } catch (err: any) {
    console.error('[Narratives] POST /:slug/analyze error:', err);
    return c.json({ error: err?.message || 'Failed to analyze narrative' }, 500);
  }
});

// POST /api/narratives/:slug/debate
narrativeRoutes.post('/:slug/debate', async (c) => {
  try {
    const slug = c.req.param('slug');
    const generated = await generateNarrativeDebate(slug);
    if (!generated) {
      return c.json({ error: 'Debate generated too recently or narrative not found' }, 429);
    }
    return c.json({ success: true, message: `Debate generated for ${slug}` });
  } catch (err: any) {
    return c.json({ error: 'Failed to generate debate' }, 500);
  }
});

export default narrativeRoutes;
