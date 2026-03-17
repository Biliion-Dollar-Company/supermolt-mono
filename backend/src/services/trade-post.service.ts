/**
 * Trade Post Service
 * Generates social feed posts when agents make real on-chain trades.
 * Called fire-and-forget from auto-buy-executor — never blocks execution.
 */

import { db } from '../lib/db';
import { LLMService } from './llm.service';
import { websocketEvents } from './websocket-events';

// Rate limit: max 3 posts per agent per hour
const postCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_POSTS_PER_HOUR = 3;

interface TradeData {
  tokenSymbol: string;
  tokenMint: string;
  solAmount: number;
  action: 'BUY' | 'SELL';
  signature?: string;
  confidence?: number;
  reason?: string;
}

function isRateLimited(agentId: string): boolean {
  const now = Date.now();
  const entry = postCounts.get(agentId);

  if (!entry || now > entry.resetAt) {
    postCounts.set(agentId, { count: 1, resetAt: now + 3600_000 });
    return false;
  }

  if (entry.count >= MAX_POSTS_PER_HOUR) return true;
  entry.count++;
  return false;
}

async function generateNarrative(
  agentName: string,
  archetypeId: string,
  trade: TradeData
): Promise<string> {
  const llm = LLMService.getInstance();

  if (!llm.isConfigured) {
    return buildTemplate(agentName, trade);
  }

  try {
    const result = await llm.generate(
      `You are ${agentName}, a crypto trading agent with the ${archetypeId} archetype. Write a brief 2-3 sentence post about a trade you just made. Be confident and direct. No hashtags, no emojis. Speak in first person.`,
      `I just ${trade.action === 'BUY' ? 'bought' : 'sold'} ${trade.tokenSymbol} for ${trade.solAmount.toFixed(3)} SOL. ${trade.reason || ''}`,
      { temperature: 0.8, maxTokens: 150 }
    );
    return result || buildTemplate(agentName, trade);
  } catch {
    return buildTemplate(agentName, trade);
  }
}

function buildTemplate(agentName: string, trade: TradeData): string {
  const action = trade.action === 'BUY' ? 'loaded up on' : 'exited';
  return `${agentName} just ${action} ${trade.tokenSymbol}. ${trade.solAmount.toFixed(3)} SOL.`;
}

export async function createTradePost(agentId: string, trade: TradeData): Promise<void> {
  try {
    if (isRateLimited(agentId)) {
      console.log(`[TradePost] Rate limited for agent ${agentId}, skipping`);
      return;
    }

    const agent = await db.tradingAgent.findUnique({
      where: { id: agentId },
      select: { name: true, displayName: true, archetypeId: true },
    });

    if (!agent) return;

    const agentName = agent.displayName || agent.name;
    const content = await generateNarrative(agentName, agent.archetypeId, trade);

    const post = await db.agentPost.create({
      data: {
        agentId,
        content,
        postType: 'TRADE_CALL',
        tokenMint: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        visibility: 'public',
        metadata: {
          action: trade.action,
          solAmount: trade.solAmount,
          signature: trade.signature || null,
          source: 'auto_trade_post',
        },
      },
    });

    // Broadcast to social feed
    try {
      websocketEvents.broadcastAgentActivity(agentId, {
        agentId,
        action: 'TRADE',
        data: {
          type: 'social_post',
          postId: post.id,
          postType: 'TRADE_CALL',
          tokenSymbol: trade.tokenSymbol,
        },
      });
    } catch {
      // WebSocket broadcast is non-critical
    }

    console.log(`[TradePost] Created trade post for ${agentName}: ${trade.action} ${trade.tokenSymbol}`);
  } catch (error) {
    console.error('[TradePost] Failed to create trade post:', error);
    // Never throw — this is fire-and-forget
  }
}
