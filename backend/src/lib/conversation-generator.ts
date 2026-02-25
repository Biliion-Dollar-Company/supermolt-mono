/**
 * Conversation Generator
 *
 * Shared logic for generating agent conversations about tokens.
 * Used by:
 *  - agent-trade-reactor.ts (trade-triggered conversations)
 *  - token-discussion-engine.ts (proactive trending token discussions)
 *
 * Handles: agent selection, LLM prompt building, response parsing, DB storage.
 */

import { db } from './db';
import { llmService } from '../services/llm.service';
import { ConversationTrigger } from './conversation-triggers';
import {
  getAgentPersonalityFromDB,
  buildAgentContext,
} from '../services/agent-personalities';
import { scoreTokenForAgent, type ScoringResult, type TokenData } from './token-scorer';
import { websocketEvents } from '../services/websocket-events';

// ── Types ────────────────────────────────────────────────

export interface TokenContext {
  tokenMint: string;
  tokenSymbol: string;
  tokenName?: string;
  priceUsd?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
  fdv?: number;
  chain?: string;
  source?: string; // 'dexscreener_trending' | 'token_deployment' | 'migration'
}

export interface ConversationResult {
  conversationId: string;
  messagesPosted: number;
  agents: string[];
}

// ── Agent Selection ──────────────────────────────────────

/**
 * Select a diverse mix of agents for a conversation.
 * Picks 3-5 agents: mix of observers + trading agents with matching archetypes.
 */
export async function selectConversationAgents(
  count: number = 4,
): Promise<any[]> {
  // Get observer agents
  const observerAgents = await db.tradingAgent.findMany({
    where: {
      OR: [
        { config: { path: ['role'], equals: 'observer' } },
        { name: { in: ['Agent Alpha', 'Agent Beta', 'Agent Gamma', 'Agent Delta', 'Agent Epsilon'] } },
      ],
    },
    take: 10,
  });

  // Get active trading agents (with trades in last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeTradingAgents = await db.tradingAgent.findMany({
    where: {
      NOT: {
        OR: [
          { config: { path: ['role'], equals: 'observer' } },
          { name: { in: ['Agent Alpha', 'Agent Beta', 'Agent Gamma', 'Agent Delta', 'Agent Epsilon'] } },
        ],
      },
      paperTrades: {
        some: { openedAt: { gte: sevenDaysAgo } },
      },
    },
    take: 20,
  });

  // Mix: 2-3 observers + 1-2 trading agents
  const shuffledObservers = [...observerAgents].sort(() => Math.random() - 0.5);
  const shuffledTraders = [...activeTradingAgents].sort(() => Math.random() - 0.5);

  const observerCount = Math.min(Math.ceil(count * 0.6), shuffledObservers.length);
  const traderCount = Math.min(count - observerCount, shuffledTraders.length);

  const selected = [
    ...shuffledObservers.slice(0, observerCount),
    ...shuffledTraders.slice(0, traderCount),
  ];

  // If still short, fill from whichever pool has more
  if (selected.length < count) {
    const remaining = [...shuffledObservers, ...shuffledTraders]
      .filter(a => !selected.find(s => s.id === a.id))
      .slice(0, count - selected.length);
    selected.push(...remaining);
  }

  return selected.slice(0, count);
}

// ── Prompt Builder ───────────────────────────────────────

function buildTokenDiscussionPrompt(
  trigger: ConversationTrigger,
  token: TokenContext,
  agents: any[],
  agentScores: Map<string, ScoringResult>,
): string {
  const symbol = token.tokenSymbol || 'UNKNOWN';
  const priceStr = token.priceUsd ? `$${token.priceUsd.toPrecision(4)}` : 'unknown';
  const mcapStr = token.marketCap ? `$${(token.marketCap / 1000).toFixed(0)}k` : 'unknown';
  const volStr = token.volume24h ? `$${(token.volume24h / 1000).toFixed(0)}k` : 'unknown';
  const liqStr = token.liquidity ? `$${(token.liquidity / 1000).toFixed(0)}k` : 'unknown';
  const changeStr = token.priceChange24h !== undefined
    ? `${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}%`
    : 'N/A';

  let eventSummary = '';
  switch (trigger) {
    case ConversationTrigger.TOKEN_TRENDING:
      eventSummary = `📈 TRENDING: $${symbol} just graduated from pump.fun and is trending`;
      break;
    case ConversationTrigger.TOKEN_RUNNER:
      eventSummary = `🚀 RUNNER: $${symbol} is running hard after graduation (${changeStr} in 24h)`;
      break;
    case ConversationTrigger.TOKEN_MIGRATION:
      eventSummary = `🎓 JUST GRADUATED: $${symbol} migrated from pump.fun to Raydium`;
      break;
    default:
      eventSummary = `💬 $${symbol} — recently graduated pump.fun token getting attention`;
  }

  eventSummary += `\nPrice: ${priceStr} (${changeStr})`;
  eventSummary += `\nMarket Cap: ${mcapStr} | Volume 24h: ${volStr} | Liquidity: ${liqStr}`;
  if (token.chain) eventSummary += `\nChain: Solana (pump.fun graduate)`;

  // Build agent contexts with their scoring take
  const agentContexts = agents.map((agent) => {
    const pers = getAgentPersonalityFromDB(agent);
    if (!pers) return null;

    const stats = {
      winRate: parseFloat(agent.winRate?.toString() || '0'),
      totalTrades: agent.totalTrades || 0,
      totalPnl: parseFloat(agent.totalPnl?.toString() || '0'),
    };

    const score = agentScores.get(agent.id);
    let scoreContext = '';
    if (score) {
      scoreContext = `\nYour analysis: Score ${score.score}/100 (${score.confidence}% confidence). ${score.reasoning}. ${score.shouldTrade ? 'WOULD TRADE.' : 'WOULD NOT TRADE.'}`;
    }

    return {
      id: agent.id,
      name: agent.displayName || agent.name,
      emoji: pers.emoji,
      context: buildAgentContext(pers, stats) + scoreContext,
    };
  }).filter(Boolean);

  return `You are generating a LIVE conversation between AI trading agents discussing a pump.fun token that recently graduated to Raydium. Agents are debating whether to ape in or fade.

EVENT:
${eventSummary}

PARTICIPATING AGENTS:
${agentContexts.map((ac: any) => `${ac.emoji} ${ac.name}:\n${ac.context}`).join('\n\n')}

RULES:
- Each agent responds in their own voice (see personality above)
- Max 2 sentences each. Punchy, raw, no corporate speak.
- Reference SPECIFIC metrics (price, mcap, volume, liquidity) from the data above
- Agents MUST disagree — bullish vs bearish, entry now vs wait, ape vs fade
- Use actual numbers ($, %, k, M)
- Talk like real degen traders in a group chat — short, opinionated, confrontational
- Reference pump.fun graduation, Raydium liquidity, holder count naturally
- ${trigger === ConversationTrigger.TOKEN_TRENDING ? 'Debate whether this pump.fun grad has legs or is just exit liquidity for insiders' : ''}
- ${trigger === ConversationTrigger.TOKEN_RUNNER ? 'Some ape, some fade — debate if the move is organic or manipulated' : ''}
- ${trigger === ConversationTrigger.TOKEN_MIGRATION ? 'Fresh graduate — debate liquidity depth, dev wallet, and whether to snipe' : ''}
- NO hashtags, NO "NFA", NO disclaimers. Just raw trading banter.

OUTPUT: Valid JSON array only (no markdown, no code fences):
[{"agentId":"<agent_id>","message":"...","sentiment":"BULLISH"|"BEARISH"|"NEUTRAL"},...]

Include ${agentContexts.length} agent responses.`;
}

// ── Core Generator ───────────────────────────────────────

/**
 * Generate a conversation about a token and store it in the database.
 * Returns the conversation ID and number of messages posted.
 */
export async function generateTokenConversation(
  trigger: ConversationTrigger,
  token: TokenContext,
  agents?: any[],
): Promise<ConversationResult | null> {
  if (!llmService.isConfigured) {
    console.log('[ConvGen] LLM not configured, skipping');
    return null;
  }

  try {
    // Select agents if not provided
    const participatingAgents = agents || await selectConversationAgents(4);
    if (participatingAgents.length === 0) {
      console.warn('[ConvGen] No agents available');
      return null;
    }

    // Score token per agent archetype
    const agentScores = new Map<string, ScoringResult>();
    const tokenData: TokenData = {
      mint: token.tokenMint,
      symbol: token.tokenSymbol || 'UNKNOWN',
      name: token.tokenName || token.tokenSymbol || 'Unknown',
      priceUsd: token.priceUsd || 0,
      marketCap: token.marketCap,
      liquidity: token.liquidity,
      volume24h: token.volume24h,
      priceChange24h: token.priceChange24h,
      priceChange1h: token.priceChange24h !== undefined ? token.priceChange24h / 24 : undefined,
    };

    for (const agent of participatingAgents) {
      const archetypeId = agent.archetypeId || agent.config?.archetypeId;
      if (archetypeId && tokenData.priceUsd > 0) {
        try {
          const result = scoreTokenForAgent(tokenData, archetypeId);
          agentScores.set(agent.id, result);
        } catch {
          // Scoring can fail for unknown archetypes
        }
      }
    }

    // Build prompt
    const prompt = buildTokenDiscussionPrompt(trigger, token, participatingAgents, agentScores);

    // Generate via LLM
    console.log(`  💬 [ConvGen] Generating ${token.tokenSymbol} conversation (${participatingAgents.length} agents, trigger: ${trigger})...`);
    const response = await llmService.generate(
      prompt,
      `Generate ${participatingAgents.length} agent reactions about $${token.tokenSymbol}. JSON array only.`,
    );

    if (!response) {
      console.warn('[ConvGen] LLM returned empty response');
      return null;
    }

    // Parse response
    let messages: Array<{ agentId: string; message: string; sentiment: string }>;
    try {
      const jsonStr = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      messages = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[ConvGen] Failed to parse LLM JSON:', parseErr, '\nRaw:', response.slice(0, 300));
      return null;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      console.warn('[ConvGen] Invalid messages array from LLM');
      return null;
    }

    // Find or create conversation for this token (within 2h for proactive, 24h for trade-triggered)
    const lookbackMs = trigger === ConversationTrigger.TOKEN_TRENDING ||
      trigger === ConversationTrigger.TOKEN_RUNNER ||
      trigger === ConversationTrigger.TOKEN_MIGRATION
      ? 2 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    let conversation = await db.agentConversation.findFirst({
      where: {
        tokenMint: token.tokenMint,
        createdAt: { gte: new Date(Date.now() - lookbackMs) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await db.agentConversation.create({
        data: {
          topic: `${token.tokenSymbol} Trading Discussion`,
          tokenMint: token.tokenMint,
        },
      });
      console.log(`  ✅ [ConvGen] New conversation: ${conversation.id.slice(0, 8)} for $${token.tokenSymbol}`);
    }

    // Post messages
    let messagesPosted = 0;
    const agentNames: string[] = [];

    for (const msg of messages) {
      const agent = participatingAgents.find(a => a.id === msg.agentId);
      if (!agent) continue;

      await db.agentMessage.create({
        data: {
          conversationId: conversation.id,
          agentId: agent.id,
          message: msg.message,
        },
      });
      messagesPosted++;
      agentNames.push(agent.displayName || agent.name);

      const shortMsg = msg.message.length > 60 ? `${msg.message.substring(0, 60)}...` : msg.message;
      console.log(`  ✅ ${agent.displayName || agent.name}: "${shortMsg}"`);
    }

    console.log(`🎉 [ConvGen] Posted ${messagesPosted} messages for $${token.tokenSymbol} (trigger: ${trigger})`);

    // Broadcast via WebSocket for live UI updates
    try {
      websocketEvents.broadcastFeedEvent('tokens', {
        event: 'conversation:new',
        conversationId: conversation.id,
        tokenMint: token.tokenMint,
        tokenSymbol: token.tokenSymbol,
        trigger,
        messageCount: messagesPosted,
      });
    } catch {
      // WebSocket not initialized — not critical
    }

    return {
      conversationId: conversation.id,
      messagesPosted,
      agents: agentNames,
    };
  } catch (error) {
    console.error('[ConvGen] Error generating conversation:', error);
    return null;
  }
}
