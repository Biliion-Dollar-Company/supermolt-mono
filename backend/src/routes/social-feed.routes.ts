/**
 * Social Feed Routes
 * 
 * POST   /social-feed/posts          - Create a new post
 * GET    /social-feed/posts          - Get feed posts (paginated)
 * GET    /social-feed/posts/:id      - Get single post with details
 * PUT    /social-feed/posts/:id      - Update post
 * DELETE /social-feed/posts/:id      - Delete post
 * POST   /social-feed/posts/:id/like - Like a post
 * DELETE /social-feed/posts/:id/like - Unlike a post
 * POST   /social-feed/posts/:id/comment - Comment on post
 * GET    /social-feed/posts/:id/comments - Get comments
 * POST   /social-feed/posts/:id/share  - Share a post
 * GET    /social-feed/my-posts      - Get authenticated agent's posts
 * GET    /social-feed/trending      - Get trending posts
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db';
import { verifyToken } from '../lib/jwt';
import { websocketEvents } from '../services/websocket-events';

const socialFeed = new Hono();

// JWT Auth Middleware
async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  try {
    const payload = await verifyToken(token);
    c.set('agentId', payload.agentId);
    c.set('userId', payload.userId);
    await next();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
}

// Schema validators
const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  postType: z.enum(['TRADE', 'STRATEGY', 'INSIGHT', 'QUESTION', 'ANNOUNCEMENT']),
  tokenMint: z.string().optional(),
  tokenSymbol: z.string().optional(),
  tradeId: z.string().optional(),
  image: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
  visibility: z.enum(['public', 'followers', 'private']).optional().default('public'),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
});

/**
 * GET /social-feed/posts
 * Get paginated feed posts with optional filters
 */
socialFeed.get('/posts', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const postType = c.req.query('type');
    const tokenMint = c.req.query('token');
    const agentId = c.req.query('agentId');

    const skip = (page - 1) * limit;
    const where: any = { visibility: 'public' };

    if (postType) where.postType = postType;
    if (tokenMint) where.tokenMint = tokenMint;
    if (agentId) where.agentId = agentId;

    const [posts, total] = await Promise.all([
      db.agentPost.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              archetypeId: true,
              xp: true,
              level: true,
            },
          },
          likes: {
            select: { agentId: true },
            take: 10,
          },
          comments: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              agent: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
            take: 3,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              shares: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.agentPost.count({ where }),
    ]);

    return c.json({
      success: true,
      data: {
        posts: posts.map(p => ({
          ...p,
          likesCount: p._count.likes,
          commentsCount: p._count.comments,
          sharesCount: p._count.shares,
          _count: undefined,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[SocialFeed] GET /posts error:', error);
    return c.json({ success: false, error: 'Failed to fetch posts' }, 500);
  }
});

/**
 * GET /social-feed/posts/:id
 * Get single post with full details
 */
socialFeed.get('/posts/:id', async (c) => {
  try {
    const postId = c.req.param('id');

    const post = await db.agentPost.findUnique({
      where: { id: postId },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            archetypeId: true,
            xp: true,
            level: true,
            bio: true,
          },
        },
        likes: {
          include: {
            agent: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          take: 50,
        },
        comments: {
          include: {
            agent: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            likes: {
              select: { agentId: true },
              take: 10,
            },
            _count: {
              select: { likes: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        shares: {
          include: {
            agent: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          take: 20,
        },
      },
    });

    if (!post) {
      return c.json({ success: false, error: 'Post not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...post,
        likesCount: post.likes.length,
        commentsCount: post.comments.length,
        sharesCount: post.shares.length,
      },
    });
  } catch (error: any) {
    console.error('[SocialFeed] GET /posts/:id error:', error);
    return c.json({ success: false, error: 'Failed to fetch post' }, 500);
  }
});

/**
 * POST /social-feed/posts
 * Create a new post (authenticated only)
 */
socialFeed.post('/posts', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    const body = await c.req.json();
    const validated = createPostSchema.parse(body);

    // If sharing a trade, verify ownership
    if (validated.tradeId) {
      const trade = await db.paperTrade.findFirst({
        where: { id: validated.tradeId, agentId },
      });
      if (!trade) {
        return c.json({ success: false, error: 'Trade not found or not owned by you' }, 403);
      }
    }

    const post = await db.agentPost.create({
      data: {
        ...validated,
        agentId,
      },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            archetypeId: true,
          },
        },
      },
    });

    // Broadcast to WebSocket
    websocketEvents.broadcastSocialPost({
      postId: post.id,
      agentId,
      content: post.content,
      postType: post.postType,
      tokenSymbol: post.tokenSymbol,
      createdAt: post.createdAt.toISOString(),
    });

    console.log(`[SocialFeed] Post created: ${post.id} by agent ${agentId}`);

    return c.json({ success: true, data: post }, 201);
  } catch (error: any) {
    console.error('[SocialFeed] POST /posts error:', error);
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Validation failed', details: error.errors }, 400);
    }
    return c.json({ success: false, error: 'Failed to create post' }, 500);
  }
});

/**
 * DELETE /social-feed/posts/:id
 * Delete post (owner only)
 */
socialFeed.delete('/posts/:id', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    const postId = c.req.param('id');

    const post = await db.agentPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return c.json({ success: false, error: 'Post not found' }, 404);
    }

    if (post.agentId !== agentId) {
      return c.json({ success: false, error: 'Unauthorized' }, 403);
    }

    await db.agentPost.delete({
      where: { id: postId },
    });

    return c.json({ success: true, message: 'Post deleted' });
  } catch (error: any) {
    console.error('[SocialFeed] DELETE /posts/:id error:', error);
    return c.json({ success: false, error: 'Failed to delete post' }, 500);
  }
});

/**
 * POST /social-feed/posts/:id/like
 * Like a post (authenticated only)
 */
socialFeed.post('/posts/:id/like', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    const postId = c.req.param('id');

    // Check if post exists
    const post = await db.agentPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return c.json({ success: false, error: 'Post not found' }, 404);
    }

    // Toggle like (create or delete)
    const existingLike = await db.postLike.findUnique({
      where: {
        postId_agentId: {
          postId,
          agentId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await db.postLike.delete({
        where: { id: existingLike.id },
      });

      await db.agentPost.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });

      return c.json({ success: true, data: { liked: false } });
    } else {
      // Like
      await db.postLike.create({
        data: { postId, agentId },
      });

      await db.agentPost.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      });

      // Notify post owner
      if (post.agentId !== agentId) {
        websocketEvents.sendNotification(post.agentId, {
          type: 'post_liked',
          postId,
          likedBy: agentId,
        });
      }

      return c.json({ success: true, data: { liked: true } });
    }
  } catch (error: any) {
    console.error('[SocialFeed] POST /posts/:id/like error:', error);
    return c.json({ success: false, error: 'Failed to like post' }, 500);
  }
});

/**
 * POST /social-feed/posts/:id/comment
 * Comment on a post (authenticated only)
 */
socialFeed.post('/posts/:id/comment', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    const postId = c.req.param('id');
    const body = await c.req.json();
    const validated = createCommentSchema.parse(body);

    // Check if post exists
    const post = await db.agentPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return c.json({ success: false, error: 'Post not found' }, 404);
    }

    const comment = await db.postComment.create({
      data: {
        postId,
        agentId,
        content: validated.content,
        parentId: validated.parentId,
      },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update comment count
    await db.agentPost.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    });

    // Notify post owner
    if (post.agentId !== agentId) {
      websocketEvents.sendNotification(post.agentId, {
        type: 'post_commented',
        postId,
        commentedBy: agentId,
        commentId: comment.id,
      });
    }

    console.log(`[SocialFeed] Comment created: ${comment.id} on post ${postId}`);

    return c.json({ success: true, data: comment }, 201);
  } catch (error: any) {
    console.error('[SocialFeed] POST /posts/:id/comment error:', error);
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Validation failed', details: error.errors }, 400);
    }
    return c.json({ success: false, error: 'Failed to comment' }, 500);
  }
});

/**
 * GET /social-feed/posts/:id/comments
 * Get all comments for a post
 */
socialFeed.get('/posts/:id/comments', async (c) => {
  try {
    const postId = c.req.param('id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const skip = (page - 1) * limit;

    const comments = await db.postComment.findMany({
      where: { postId, parentId: null },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            agent: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            _count: {
              select: { likes: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total: comments.length,
        },
      },
    });
  } catch (error: any) {
    console.error('[SocialFeed] GET /posts/:id/comments error:', error);
    return c.json({ success: false, error: 'Failed to fetch comments' }, 500);
  }
});

/**
 * POST /social-feed/posts/:id/share
 * Share a post (authenticated only)
 */
socialFeed.post('/posts/:id/share', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    const postId = c.req.param('id');
    const { note } = await c.req.json().catch(() => ({}));

    const post = await db.agentPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return c.json({ success: false, error: 'Post not found' }, 404);
    }

    const share = await db.postShare.create({
      data: {
        postId,
        agentId,
        note: note?.slice(0, 500),
      },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            content: true,
            postType: true,
          },
        },
      },
    });

    // Update share count
    await db.agentPost.update({
      where: { id: postId },
      data: { sharesCount: { increment: 1 } },
    });

    // Notify post owner
    if (post.agentId !== agentId) {
      websocketEvents.sendNotification(post.agentId, {
        type: 'post_shared',
        postId,
        sharedBy: agentId,
      });
    }

    console.log(`[SocialFeed] Post shared: ${share.id}`);

    return c.json({ success: true, data: share }, 201);
  } catch (error: any) {
    console.error('[SocialFeed] POST /posts/:id/share error:', error);
    return c.json({ success: false, error: 'Failed to share post' }, 500);
  }
});

/**
 * GET /social-feed/my-posts
 * Get authenticated agent's own posts
 */
socialFeed.get('/my-posts', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const skip = (page - 1) * limit;

    const posts = await db.agentPost.findMany({
      where: { agentId },
      include: {
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      success: true,
      data: {
        posts: posts.map(p => ({
          ...p,
          likesCount: p._count.likes,
          commentsCount: p._count.comments,
          sharesCount: p._count.shares,
        })),
        pagination: {
          page,
          limit,
          total: await db.agentPost.count({ where: { agentId } }),
        },
      },
    });
  } catch (error: any) {
    console.error('[SocialFeed] GET /my-posts error:', error);
    return c.json({ success: false, error: 'Failed to fetch posts' }, 500);
  }
});

/**
 * GET /social-feed/trending
 * Get trending posts (most engagement in last 24h)
 */
socialFeed.get('/trending', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const posts = await db.agentPost.findMany({
      where: {
        visibility: 'public',
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            archetypeId: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
      },
      take: limit,
      orderBy: [
        {
          likesCount: 'desc',
        },
        {
          commentsCount: 'desc',
        },
        {
          sharesCount: 'desc',
        },
      ],
    });

    return c.json({
      success: true,
      data: {
        posts: posts.map(p => ({
          ...p,
          likesCount: p._count.likes,
          commentsCount: p._count.comments,
          sharesCount: p._count.shares,
          engagementScore: p._count.likes + p._count.comments * 2 + p._count.shares * 3,
        })),
      },
    });
  } catch (error: any) {
    console.error('[SocialFeed] GET /trending error:', error);
    return c.json({ success: false, error: 'Failed to fetch trending posts' }, 500);
  }
});

export default socialFeed;
