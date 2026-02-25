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

  // Deduplicate by tokenSymbol — keep the one with highest volume
  const symbolMap = new Map<string, typeof hotTokens[0]>();
  for (const t of hotTokens) {
    const sym = t.tokenSymbol?.toUpperCase();
    if (!sym) continue;
    const existing = symbolMap.get(sym);
    if (!existing || (t.volume24h || 0) > (existing.volume24h || 0)) {
      symbolMap.set(sym, t);
    }
  }
  const dedupedTokens = Array.from(symbolMap.values());

  // Get conversations for all hot token mints
  const mints = dedupedTokens.map(t => t.tokenMint);
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
    const allDistinct = await db.agentMessage.findMany({
      where: { conversationId: conv.id },
      distinct: ['agentId'],
      select: { agentId: true },
    });
    participantCounts.set(conv.id, allDistinct.length);
  }

  // Build conversation map by tokenMint — pick newest conversation (most recent messages)
  const convMap = new Map<string, typeof conversations[0]>();
  for (const conv of conversations) {
    if (!conv.tokenMint) continue;
    const existing = convMap.get(conv.tokenMint);
    if (!existing) {
      convMap.set(conv.tokenMint, conv);
    } else {
      // Pick whichever has the more recent last message
      const existingLast = existing.messages[0]?.timestamp?.getTime() || 0;
      const convLast = conv.messages[0]?.timestamp?.getTime() || 0;
      if (convLast > existingLast) {
        convMap.set(conv.tokenMint, conv);
      }
    }
  }

  // Aggregate message counts across ALL conversations for each token
  const totalMessageCounts = new Map<string, number>();
  const totalParticipants = new Map<string, Set<string>>();
  for (const conv of conversations) {
    if (!conv.tokenMint) continue;
    totalMessageCounts.set(conv.tokenMint, (totalMessageCounts.get(conv.tokenMint) || 0) + conv._count.messages);
    if (!totalParticipants.has(conv.tokenMint)) totalParticipants.set(conv.tokenMint, new Set());
    const pSet = totalParticipants.get(conv.tokenMint)!;
    conv.messages.forEach(m => pSet.add(m.agentId));
  }

  // Analyze sentiment from message content (keyword-based)
  const BULLISH_WORDS = /\b(ape|moon|buy|bullish|long|pump|send it|let'?s go|legs|organic|gem|early|undervalued|accumulate|hold)\b/i;
  const BEARISH_WORDS = /\b(fade|dump|sell|bearish|short|rug|scam|exit liquidity|manipulated|overvalued|honeypot|avoid|dead)\b/i;

  function analyzeSentiment(messages: { message: string }[]): { bullish: number; bearish: number; neutral: number } {
    let bullish = 0, bearish = 0, neutral = 0;
    for (const m of messages) {
      const hasBull = BULLISH_WORDS.test(m.message);
      const hasBear = BEARISH_WORDS.test(m.message);
      if (hasBull && !hasBear) bullish++;
      else if (hasBear && !hasBull) bearish++;
      else neutral++;
    }
    return { bullish, bearish, neutral };
  }

  // Get ALL messages for sentiment analysis (not just latest 3)
  const allConvMessages = new Map<string, { message: string }[]>();
  for (const conv of conversations) {
    if (!conv.tokenMint) continue;
    const existing = allConvMessages.get(conv.tokenMint) || [];
    existing.push(...conv.messages);
    allConvMessages.set(conv.tokenMint, existing);
  }

  // Merge tokens + conversation data — only include tokens WITH conversations
  const arenaTokens = dedupedTokens
    .map(token => {
      const conv = convMap.get(token.tokenMint);
      const msgs = allConvMessages.get(token.tokenMint) || [];
      const sentiment = analyzeSentiment(msgs);
      return {
        tokenMint: token.tokenMint,
        tokenSymbol: token.tokenSymbol,
        tokenName: token.tokenName,
        imageUrl: token.imageUrl || null,
        priceUsd: token.priceUsd,
        priceChange24h: token.priceChange24h,
        marketCap: token.marketCap,
        volume24h: token.volume24h,
        liquidity: token.liquidity,
        chain: token.chain || 'solana',
        source: token.source,
        conversationId: conv?.id || null,
        messageCount: totalMessageCounts.get(token.tokenMint) || conv?._count.messages || 0,
        participantCount: totalParticipants.get(token.tokenMint)?.size || (conv ? (participantCounts.get(conv.id) || 0) : 0),
        lastMessageAt: conv?.messages[0]?.timestamp?.toISOString() || null,
        lastMessage: conv?.messages[0]?.message || null,
        sentiment,
        latestMessages: conv?.messages.map(m => ({
          agentName: agentMap.get(m.agentId) || 'Unknown',
          content: m.message,
          timestamp: m.timestamp.toISOString(),
        })) || [],
      };
    })
    .filter(t => t.messageCount > 0); // Only show tokens with active discussions

  // Sort by message count, then volume
  arenaTokens.sort((a, b) => {
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

/**
 * POST /messaging/cleanup-conversations
 * Merge fragmented conversations per token into a single conversation.
 * Keeps the newest conversation and moves messages from older ones into it.
 */
messaging.post('/cleanup-conversations', async (c) => {
  try {
    // Find all Trading Discussion conversations grouped by tokenMint
    const conversations = await db.agentConversation.findMany({
      where: {
        topic: { contains: 'Trading Discussion' },
        tokenMint: { not: null },
      },
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    });

    // Group by tokenMint
    const byMint = new Map<string, typeof conversations>();
    for (const conv of conversations) {
      if (!conv.tokenMint) continue;
      const list = byMint.get(conv.tokenMint) || [];
      list.push(conv);
      byMint.set(conv.tokenMint, list);
    }

    let merged = 0;
    let deleted = 0;

    for (const [mint, convos] of byMint) {
      if (convos.length <= 1) continue; // No fragmentation

      // Keep the newest conversation (first in desc order)
      const keepConv = convos[0];
      const oldConvos = convos.slice(1);

      for (const oldConv of oldConvos) {
        if (oldConv._count.messages > 0) {
          // Move messages from old conversation to the kept one
          await db.agentMessage.updateMany({
            where: { conversationId: oldConv.id },
            data: { conversationId: keepConv.id },
          });
          merged += oldConv._count.messages;
        }
        // Delete the empty old conversation
        await db.agentConversation.delete({
          where: { id: oldConv.id },
        });
        deleted++;
      }
    }

    return c.json({
      success: true,
      data: {
        tokensProcessed: [...byMint.entries()].filter(([, v]) => v.length > 1).length,
        conversationsDeleted: deleted,
        messagesMerged: merged,
      },
    });
  } catch (error) {
    console.error('Cleanup conversations error:', error);
    return c.json({ success: false, error: 'Cleanup failed' }, 500);
  }
});

export { messaging };
