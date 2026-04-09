/**
 * Social Feed Routes — comprehensive tests
 *
 * Covers: like toggle (create/delete/transaction atomicity), comments
 * (creation, nesting, pagination total accuracy), shares (transaction),
 * post CRUD (auth, ownership, validation), and viewer-state decoration.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import {
  createMockDb,
  MockDb,
  authHeader,
  buildAgentPost,
  buildPostComment,
  resetSequence,
  TEST_AGENT_ID,
  VALID_TOKEN,
  EXPIRED_TOKEN,
} from './test-helpers';

// ── Module mocks ──────────────────────────────────────────────────────

let mockDb: MockDb;

mock.module('../lib/db', () => {
  mockDb = createMockDb();
  return { db: mockDb, prisma: mockDb };
});

mock.module('../lib/jwt', () => ({
  verifyToken: mock(async (token: string) => {
    if (token === VALID_TOKEN) {
      return { sub: 'user-test-001', agentId: TEST_AGENT_ID };
    }
    throw new Error('Invalid token');
  }),
}));

mock.module('../services/websocket-events', () => ({
  websocketEvents: {
    broadcastSocialPost: mock(() => {}),
    sendNotification: mock(() => {}),
  },
}));

const { default: socialFeed } = await import('../routes/social-feed.routes');

// ── App setup ─────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono();
  app.route('/social-feed', socialFeed);
  return app;
}

function json(res: Response) {
  return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Social Feed Routes', () => {
  let app: Hono;

  beforeEach(() => {
    resetSequence();
    mockDb = createMockDb();
    mock.module('../lib/db', () => ({ db: mockDb, prisma: mockDb }));
    app = createApp();
  });

  // ────────────────────────────────────────────────────────────────────
  // POST /social-feed/posts/:id/like
  // ────────────────────────────────────────────────────────────────────

  describe('POST /posts/:id/like', () => {
    it('rejects without auth', async () => {
      const res = await app.request('/social-feed/posts/post-1/like', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent post', async () => {
      mockDb.agentPost.findUnique.mockResolvedValueOnce(null);

      const res = await app.request('/social-feed/posts/fake-id/like', {
        method: 'POST',
        headers: authHeader(),
      });
      expect(res.status).toBe(404);
    });

    it('creates a like when none exists (transaction)', async () => {
      const post = buildAgentPost({ id: 'post-1', agentId: 'other-agent' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      mockDb.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = {
          postLike: {
            findUnique: mock(async () => null), // no existing like
            create: mock(async () => ({ id: 'like-1', postId: 'post-1', agentId: TEST_AGENT_ID })),
          },
          agentPost: {
            update: mock(async () => ({ ...post, likesCount: 1 })),
          },
        };
        return fn(tx);
      });

      const res = await app.request('/social-feed/posts/post-1/like', {
        method: 'POST',
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.liked).toBe(true);
    });

    it('removes a like when one exists (toggle off)', async () => {
      const post = buildAgentPost({ id: 'post-1', agentId: 'other-agent' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      mockDb.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = {
          postLike: {
            findUnique: mock(async () => ({ id: 'like-1', postId: 'post-1', agentId: TEST_AGENT_ID })),
            delete: mock(async () => ({})),
          },
          agentPost: {
            update: mock(async () => ({ ...post, likesCount: 0 })),
          },
        };
        return fn(tx);
      });

      const res = await app.request('/social-feed/posts/post-1/like', {
        method: 'POST',
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.liked).toBe(false);
    });

    it('does NOT send notification when liking own post', async () => {
      const { websocketEvents } = await import('../services/websocket-events');
      // Clear accumulated calls from prior tests
      (websocketEvents.sendNotification as any).mockClear();

      const post = buildAgentPost({ id: 'post-self', agentId: TEST_AGENT_ID }); // own post
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      mockDb.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = {
          postLike: {
            findUnique: mock(async () => null),
            create: mock(async () => ({ id: 'like-1' })),
          },
          agentPost: {
            update: mock(async () => ({})),
          },
        };
        return fn(tx);
      });

      const res = await app.request('/social-feed/posts/post-self/like', {
        method: 'POST',
        headers: authHeader(),
      });

      expect(res.status).toBe(200);
      // Should not notify self — no sendNotification calls at all after clearing
      expect((websocketEvents.sendNotification as any).mock.calls.length).toBe(0);
    });

    it('handles transaction failure (deadlock)', async () => {
      const post = buildAgentPost({ id: 'post-1' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);
      mockDb.$transaction.mockRejectedValueOnce(new Error('Transaction deadlock'));

      const res = await app.request('/social-feed/posts/post-1/like', {
        method: 'POST',
        headers: authHeader(),
      });

      expect(res.status).toBe(500);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // POST /social-feed/posts/:id/comment
  // ────────────────────────────────────────────────────────────────────

  describe('POST /posts/:id/comment', () => {
    it('rejects without auth', async () => {
      const res = await app.request('/social-feed/posts/post-1/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects empty content', async () => {
      const res = await app.request('/social-feed/posts/post-1/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: '' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects content over 2000 chars', async () => {
      const res = await app.request('/social-feed/posts/post-1/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: 'x'.repeat(2001) }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when post does not exist', async () => {
      mockDb.agentPost.findUnique.mockResolvedValueOnce(null);

      const res = await app.request('/social-feed/posts/fake/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: 'hello' }),
      });
      expect(res.status).toBe(404);
    });

    it('creates comment with count increment in transaction', async () => {
      const post = buildAgentPost({ id: 'post-1', agentId: 'other-agent' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      const createdComment = buildPostComment({ postId: 'post-1' });
      mockDb.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = {
          postComment: {
            create: mock(async () => createdComment),
          },
          agentPost: {
            update: mock(async () => ({ ...post, commentsCount: 1 })),
          },
        };
        return fn(tx);
      });

      const res = await app.request('/social-feed/posts/post-1/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: 'Great trade!' }),
      });

      expect(res.status).toBe(201);
      const body = await json(res);
      expect(body.success).toBe(true);
      expect(body.data.viewerOwnsComment).toBe(true);
    });

    it('creates a reply with parentId', async () => {
      const post = buildAgentPost({ id: 'post-1' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      const reply = buildPostComment({ postId: 'post-1', parentId: 'comment-parent' });
      mockDb.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = {
          postComment: {
            create: mock(async (args: any) => {
              // Verify parentId is passed through
              expect(args.data.parentId).toBe('comment-parent');
              return reply;
            }),
          },
          agentPost: {
            update: mock(async () => ({})),
          },
        };
        return fn(tx);
      });

      const res = await app.request('/social-feed/posts/post-1/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: 'Nice reply', parentId: 'comment-parent' }),
      });

      expect(res.status).toBe(201);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // GET /social-feed/posts/:id/comments  (pagination total bug fix)
  // ────────────────────────────────────────────────────────────────────

  describe('GET /posts/:id/comments', () => {
    it('returns real total count, not capped by page size', async () => {
      // Simulate 75 total top-level comments, but only fetch page of 50
      const pageOfComments = Array.from({ length: 50 }, (_, i) =>
        buildPostComment({ id: `comment-${i}`, replies: [], _count: { likes: 0 } }),
      );

      mockDb.postComment.findMany.mockResolvedValueOnce(pageOfComments);
      mockDb.postComment.count.mockResolvedValueOnce(75); // the REAL total

      const res = await app.request('/social-feed/posts/post-1/comments?page=1&limit=50');

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.pagination.total).toBe(75); // not 50!
      expect(body.data.pagination.totalPages).toBe(2);
      expect(body.data.comments.length).toBe(50);
    });

    it('returns correct totalPages for exact division', async () => {
      mockDb.postComment.findMany.mockResolvedValueOnce(
        Array.from({ length: 20 }, () => buildPostComment({ replies: [] })),
      );
      mockDb.postComment.count.mockResolvedValueOnce(40);

      const res = await app.request('/social-feed/posts/post-1/comments?page=1&limit=20');

      const body = await json(res);
      expect(body.data.pagination.totalPages).toBe(2); // 40 / 20 = 2
    });

    it('returns empty list with total 0 for post with no comments', async () => {
      mockDb.postComment.findMany.mockResolvedValueOnce([]);
      mockDb.postComment.count.mockResolvedValueOnce(0);

      const res = await app.request('/social-feed/posts/post-1/comments');

      const body = await json(res);
      expect(body.data.pagination.total).toBe(0);
      expect(body.data.comments).toEqual([]);
    });

    it('decorates comments with viewerOwnsComment when authenticated', async () => {
      const ownComment = buildPostComment({ agentId: TEST_AGENT_ID, replies: [] });
      const otherComment = buildPostComment({ agentId: 'other-agent', replies: [] });

      mockDb.postComment.findMany.mockResolvedValueOnce([ownComment, otherComment]);
      mockDb.postComment.count.mockResolvedValueOnce(2);

      const res = await app.request('/social-feed/posts/post-1/comments', {
        headers: authHeader(),
      });

      const body = await json(res);
      expect(body.data.comments[0].viewerOwnsComment).toBe(true);
      expect(body.data.comments[1].viewerOwnsComment).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // POST /social-feed/posts/:id/share
  // ────────────────────────────────────────────────────────────────────

  describe('POST /posts/:id/share', () => {
    it('rejects without auth', async () => {
      const res = await app.request('/social-feed/posts/post-1/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 for missing post', async () => {
      mockDb.agentPost.findUnique.mockResolvedValueOnce(null);

      const res = await app.request('/social-feed/posts/fake/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });

    it('creates share with count increment in transaction', async () => {
      const post = buildAgentPost({ id: 'post-1', agentId: 'other-agent' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      const share = {
        id: 'share-1',
        postId: 'post-1',
        agentId: TEST_AGENT_ID,
        note: 'check this out',
        agent: { id: TEST_AGENT_ID, displayName: 'Test', avatarUrl: null },
        post: { id: 'post-1', content: 'test', postType: 'INSIGHT' },
      };

      mockDb.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = {
          postShare: {
            create: mock(async () => share),
          },
          agentPost: {
            update: mock(async () => ({ ...post, sharesCount: 1 })),
          },
        };
        return fn(tx);
      });

      const res = await app.request('/social-feed/posts/post-1/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ note: 'check this out' }),
      });

      expect(res.status).toBe(201);
      const body = await json(res);
      expect(body.success).toBe(true);
    });

    it('truncates share note to 500 chars', async () => {
      const post = buildAgentPost({ id: 'post-1', agentId: 'other-agent' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      let capturedNote = '';
      mockDb.$transaction.mockImplementationOnce(async (fn: any) => {
        const tx = {
          postShare: {
            create: mock(async (args: any) => {
              capturedNote = args.data.note;
              return { id: 'share-1', ...args.data, agent: {}, post: {} };
            }),
          },
          agentPost: {
            update: mock(async () => ({})),
          },
        };
        return fn(tx);
      });

      const longNote = 'x'.repeat(1000);
      const res = await app.request('/social-feed/posts/post-1/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ note: longNote }),
      });

      expect(res.status).toBe(201);
      expect(capturedNote.length).toBe(500);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // POST /social-feed/posts  (create)
  // ────────────────────────────────────────────────────────────────────

  describe('POST /posts', () => {
    it('rejects without auth', async () => {
      const res = await app.request('/social-feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test', postType: 'INSIGHT' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects empty content', async () => {
      const res = await app.request('/social-feed/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: '', postType: 'INSIGHT' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects content over 5000 chars', async () => {
      const res = await app.request('/social-feed/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: 'x'.repeat(5001), postType: 'INSIGHT' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid postType', async () => {
      const res = await app.request('/social-feed/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ content: 'hello', postType: 'INVALID' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when narrativeSlug does not match a real narrative', async () => {
      mockDb.narrativeThread.findUnique.mockResolvedValueOnce(null);

      const res = await app.request('/social-feed/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          content: 'hello',
          postType: 'INSIGHT',
          narrativeSlug: 'nonexistent-narrative',
        }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 403 when sharing a trade not owned by the agent', async () => {
      mockDb.paperTrade.findFirst.mockResolvedValueOnce(null); // trade not found or not owned

      const res = await app.request('/social-feed/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          content: 'sharing my trade',
          postType: 'TRADE',
          tradeId: 'stolen-trade-id',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('creates post successfully with viewerOwnsPost true', async () => {
      const post = buildAgentPost();
      mockDb.agentPost.create.mockResolvedValueOnce(post);

      const res = await app.request('/social-feed/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          content: 'Bullish on SOL',
          postType: 'INSIGHT',
        }),
      });

      expect(res.status).toBe(201);
      const body = await json(res);
      expect(body.data.viewerOwnsPost).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // DELETE /social-feed/posts/:id
  // ────────────────────────────────────────────────────────────────────

  describe('DELETE /posts/:id', () => {
    it('rejects without auth', async () => {
      const res = await app.request('/social-feed/posts/post-1', {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent post', async () => {
      mockDb.agentPost.findUnique.mockResolvedValueOnce(null);

      const res = await app.request('/social-feed/posts/fake/delete', {
        method: 'DELETE',
        headers: authHeader(),
      });
      // The route is /posts/:id, not /posts/:id/delete
      const res2 = await app.request('/social-feed/posts/fake', {
        method: 'DELETE',
        headers: authHeader(),
      });
      expect(res2.status).toBe(404);
    });

    it('returns 403 when non-owner tries to delete', async () => {
      const post = buildAgentPost({ agentId: 'someone-else' });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);

      const res = await app.request('/social-feed/posts/post-1', {
        method: 'DELETE',
        headers: authHeader(),
      });
      expect(res.status).toBe(403);
    });

    it('allows owner to delete their own post', async () => {
      const post = buildAgentPost({ agentId: TEST_AGENT_ID });
      mockDb.agentPost.findUnique.mockResolvedValueOnce(post);
      mockDb.agentPost.delete.mockResolvedValueOnce(post);

      const res = await app.request(`/social-feed/posts/${post.id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // GET /social-feed/posts  (viewer state decoration)
  // ────────────────────────────────────────────────────────────────────

  describe('GET /posts (viewer state)', () => {
    it('sets viewerLiked=false and viewerOwnsPost=false when not authenticated', async () => {
      const post = buildAgentPost({ agentId: 'other-agent' });
      mockDb.agentPost.findMany.mockResolvedValueOnce([post]);
      mockDb.agentPost.count.mockResolvedValueOnce(1);

      const res = await app.request('/social-feed/posts');

      const body = await json(res);
      expect(body.data.posts[0].viewerLiked).toBe(false);
      expect(body.data.posts[0].viewerOwnsPost).toBe(false);
    });

    it('sets viewerOwnsPost=true for own posts', async () => {
      const post = buildAgentPost({ agentId: TEST_AGENT_ID, likes: [] });
      mockDb.agentPost.findMany.mockResolvedValueOnce([post]);
      mockDb.agentPost.count.mockResolvedValueOnce(1);

      const res = await app.request('/social-feed/posts', {
        headers: authHeader(),
      });

      const body = await json(res);
      expect(body.data.posts[0].viewerOwnsPost).toBe(true);
    });

    it('sets viewerLiked=true when viewer has liked', async () => {
      const post = buildAgentPost({
        agentId: 'other-agent',
        likes: [{ agentId: TEST_AGENT_ID }],
      });
      mockDb.agentPost.findMany.mockResolvedValueOnce([post]);
      mockDb.agentPost.count.mockResolvedValueOnce(1);

      const res = await app.request('/social-feed/posts', {
        headers: authHeader(),
      });

      const body = await json(res);
      expect(body.data.posts[0].viewerLiked).toBe(true);
    });

    it('paginates correctly', async () => {
      mockDb.agentPost.findMany.mockResolvedValueOnce([]);
      mockDb.agentPost.count.mockResolvedValueOnce(100);

      const res = await app.request('/social-feed/posts?page=3&limit=10');

      const body = await json(res);
      expect(body.data.pagination.page).toBe(3);
      expect(body.data.pagination.total).toBe(100);
      expect(body.data.pagination.totalPages).toBe(10);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // GET /social-feed/trending
  // ────────────────────────────────────────────────────────────────────

  describe('GET /trending', () => {
    it('returns engagement score weighted correctly', async () => {
      const post = buildAgentPost({
        _count: { likes: 10, comments: 5, shares: 2 },
      });
      mockDb.agentPost.findMany.mockResolvedValueOnce([post]);

      const res = await app.request('/social-feed/trending');

      const body = await json(res);
      // engagementScore = likes + comments*2 + shares*3
      expect(body.data.posts[0].engagementScore).toBe(10 + 5 * 2 + 2 * 3); // 26
    });

    it('returns empty array when no posts in last 24h', async () => {
      mockDb.agentPost.findMany.mockResolvedValueOnce([]);

      const res = await app.request('/social-feed/trending');

      const body = await json(res);
      expect(body.data.posts).toEqual([]);
    });
  });
});
