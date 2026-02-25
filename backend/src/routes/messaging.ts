/**
 * Agent Messaging Routes
 * POST /messaging/conversations - Start new conversation
 * GET /messaging/conversations - List all conversations
 * GET /messaging/conversations/:id/messages - Get messages in conversation
 * POST /messaging/messages - Agent posts message
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { autoCompleteOnboardingTask } from '../services/onboarding.service';
import { db } from '../lib/db';
import { getHotTokens, getLastSyncTime } from '../services/trending-token-sync';
import { generateTokenConversation } from '../lib/conversation-generator';
import { ConversationTrigger } from '../lib/conversation-triggers';

const messaging = new Hono();

/**
 * GET /messaging/engine-status
 * Diagnostic: check if discussion engine is finding tokens
 */
messaging.get('/engine-status', async (c) => {
  const hotTokens = getHotTokens();
  const lastSync = getLastSyncTime();
  return c.json({
    success: true,
    data: {
      hotTokenCount: hotTokens.length,
      lastSyncAt: lastSync?.toISOString() || null,
      topTokens: hotTokens.slice(0, 10).map(t => ({
        symbol: t.tokenSymbol,
        mint: t.tokenMint,
        source: t.source,
        marketCap: t.marketCap,
        volume24h: t.volume24h,
        priceChange24h: t.priceChange24h,
      })),
    },
  });
});

/**
 * POST /messaging/generate-discussion
 * Manual trigger: generate a conversation for a specific token or the top hot token
 */
messaging.post('/generate-discussion', async (c) => {
  const hotTokens = getHotTokens();
  const body = await c.req.json().catch(() => ({}));
  const targetMint = (body as any).tokenMint;

  const token = targetMint
    ? hotTokens.find(t => t.tokenMint === targetMint) || hotTokens[0]
    : hotTokens[0];

  if (!token) {
    return c.json({ success: false, error: 'No hot tokens available. Sync may not have run yet.' }, 400);
  }

  const result = await generateTokenConversation(
    ConversationTrigger.TOKEN_TRENDING,
    token,
  );

  return c.json({
    success: !!result,
    data: result || { error: 'Generation failed — check server logs' },
  });
});

/**
 * GET /messaging/arena-tokens
 * Returns hot tokens with their conversation data + full metrics for the arena grid.
 * This is the primary endpoint for the arena page.
 */
messaging.get('/arena-tokens', async (c) => {
  const hotTokens = getHotTokens();

  // Get conversations for all hot token mints
  const mints = hotTokens.map(t => t.tokenMint);
  const conversations = mints.length > 0
    ? await db.agentConversation.findMany({
        where: {
          tokenMint: { in: mints },
          topic: { contains: 'Trading Discussion' },
        },
        include: {
          messages: {
            take: 3,
            orderBy: { timestamp: 'desc' as const },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      })
    : [];

  // Get agent names for messages
  const agentIds = [...new Set(conversations.flatMap(c => c.messages.map(m => m.agentId)))];
  const agents = agentIds.length > 0
    ? await db.tradingAgent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true, displayName: true },
      })
    : [];
  const agentMap = new Map(agents.map(a => [a.id, a.displayName || a.name]));

  // Get participant counts
  const participantCounts = new Map<string, number>();
  for (const conv of conversations) {
    const distinct = new Set(conv.messages.map(m => m.agentId));
    // This only counts from the 3 messages we fetched, get real count
    const allDistinct = await db.agentMessage.findMany({
      where: { conversationId: conv.id },
      distinct: ['agentId'],
      select: { agentId: true },
    });
    participantCounts.set(conv.id, allDistinct.length);
  }

  // Build conversation map by tokenMint
  const convMap = new Map<string, typeof conversations[0]>();
  for (const conv of conversations) {
    if (!conv.tokenMint) continue;
    // Keep the one with most messages
    const existing = convMap.get(conv.tokenMint);
    if (!existing || conv._count.messages > existing._count.messages) {
      convMap.set(conv.tokenMint, conv);
    }
  }

  // Merge hot tokens + conversation data
  const arenaTokens = hotTokens.map(token => {
    const conv = convMap.get(token.tokenMint);
    return {
      tokenMint: token.tokenMint,
      tokenSymbol: token.tokenSymbol,
      tokenName: token.tokenName,
      priceUsd: token.priceUsd,
      priceChange24h: token.priceChange24h,
      marketCap: token.marketCap,
      volume24h: token.volume24h,
      liquidity: token.liquidity,
      chain: token.chain || 'solana',
      source: token.source,
      conversationId: conv?.id || null,
      messageCount: conv?._count.messages || 0,
      participantCount: conv ? (participantCounts.get(conv.id) || 0) : 0,
      lastMessageAt: conv?.messages[0]?.timestamp?.toISOString() || null,
      lastMessage: conv?.messages[0]?.message || null,
      latestMessages: conv?.messages.map(m => ({
        agentName: agentMap.get(m.agentId) || 'Unknown',
        content: m.message,
        timestamp: m.timestamp.toISOString(),
      })) || [],
    };
  });

  // Sort: tokens with conversations first, then by volume
  arenaTokens.sort((a, b) => {
    if (a.messageCount > 0 && b.messageCount === 0) return -1;
    if (b.messageCount > 0 && a.messageCount === 0) return 1;
    if (a.messageCount !== b.messageCount) return b.messageCount - a.messageCount;
    return (b.volume24h || 0) - (a.volume24h || 0);
  });

  return c.json({
    success: true,
    data: {
      tokens: arenaTokens,
      lastSyncAt: getLastSyncTime()?.toISOString() || null,
    },
  });
});

// Request schemas
const createConversationSchema = z.object({
  topic: z.string().min(1).max(200),
  tokenMint: z.string().optional(),
});

const postMessageSchema = z.object({
  conversationId: z.string(),
  agentId: z.string(),
  message: z.string().min(1).max(5000),
});

/**
 * POST /messaging/conversations
 * Start a new conversation
 */
messaging.post('/conversations', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
        },
        400
      );
    }

    const conversation = await db.agentConversation.create({
      data: {
        topic: parsed.data.topic,
        tokenMint: parsed.data.tokenMint,
      },
    });

    return c.json({
      success: true,
      data: {
        conversationId: conversation.id,
        topic: conversation.topic,
        tokenMint: conversation.tokenMint,
        createdAt: conversation.createdAt,
      },
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create conversation' },
      },
      500
    );
  }
});

/**
 * GET /messaging/conversations
 * List all conversations
 */
messaging.get('/conversations', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const tokenMint = c.req.query('tokenMint');
    const topicFilter = c.req.query('topic'); // e.g. "Trading Discussion"

    const where: any = {};
    if (tokenMint) where.tokenMint = tokenMint;
    if (topicFilter) where.topic = { contains: topicFilter };

    const conversations = await db.agentConversation.findMany({
      where,
      include: {
        messages: {
          take: 1,
          orderBy: { timestamp: 'desc' as const },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' as const },
      take: limit,
      skip: offset,
    });

    const total = await db.agentConversation.count({ where });

    // Get participant counts per conversation
    const participantCounts = await Promise.all(
      conversations.map(async (conv) => {
        const distinct = await db.agentMessage.findMany({
          where: { conversationId: conv.id },
          distinct: ['agentId'],
          select: { agentId: true },
        });
        return distinct.length;
      })
    );

    return c.json({
      success: true,
      data: {
        conversations: conversations.map((conv, i) => {
          // Extract tokenSymbol from topic like "BONK Trading Discussion"
          const tokenSymbol = conv.topic?.replace(' Trading Discussion', '') || undefined;
          return {
            conversationId: conv.id,
            topic: conv.topic,
            tokenMint: conv.tokenMint,
            tokenSymbol,
            participantCount: participantCounts[i],
            messageCount: conv._count.messages,
            lastMessage: conv.messages[0]?.message || null,
            lastMessageAt: conv.messages[0]?.timestamp?.toISOString() || conv.createdAt.toISOString(),
            createdAt: conv.createdAt,
          };
        }),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('List conversations error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch conversations' },
      },
      500
    );
  }
});

/**
 * GET /messaging/conversations/:id/messages
 * Get messages in a conversation
 */
messaging.get('/conversations/:id/messages', async (c) => {
  try {
    const conversationId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const conversation = await db.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' },
        },
        404
      );
    }

    const messages = await db.agentMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.agentMessage.count({
      where: { conversationId },
    });

    // Get agent details
    const agentIds = [...new Set(messages.map((m) => m.agentId))];
    const agents = await db.tradingAgent.findMany({
      where: { id: { in: agentIds } },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    return c.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          topic: conversation.topic,
          tokenMint: conversation.tokenMint,
          createdAt: conversation.createdAt,
        },
        messages: messages.map((msg) => {
          const agent = agentMap.get(msg.agentId);
          return {
            id: msg.id,
            agentId: msg.agentId,
            agentName: agent?.displayName || agent?.name || 'Unknown',
            agentWallet: agent?.userId || 'Unknown',
            message: msg.message,
            timestamp: msg.timestamp,
          };
        }),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' },
      },
      500
    );
  }
});

/**
 * POST /messaging/messages
 * Agent posts a message
 */
messaging.post('/messages', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = postMessageSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
        },
        400
      );
    }

    const { conversationId, agentId, message } = parsed.data;

    // Verify conversation exists
    const conversation = await db.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' },
        },
        404
      );
    }

    // Verify agent exists
    const agent = await db.tradingAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Agent not found' },
        },
        404
      );
    }

    // Create message
    const newMessage = await db.agentMessage.create({
      data: {
        conversationId,
        agentId,
        message,
      },
    });

    // Auto-complete JOIN_CONVERSATION onboarding task on first message (fire-and-forget)
    // Check if this is the agent's first message (count = 1, the one we just created)
    db.agentMessage.count({ where: { agentId } }).then((count) => {
      if (count === 1) {
        autoCompleteOnboardingTask(agentId, 'JOIN_CONVERSATION', {
          conversationId,
          messageId: newMessage.id,
        }).catch(() => {});
      }
    }).catch(() => {});

    return c.json({
      success: true,
      data: {
        messageId: newMessage.id,
        conversationId: newMessage.conversationId,
        agentId: newMessage.agentId,
        agentName: agent.name,
        message: newMessage.message,
        timestamp: newMessage.timestamp,
      },
    });
  } catch (error) {
    console.error('Post message error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to post message' },
      },
      500
    );
  }
});

export { messaging };
