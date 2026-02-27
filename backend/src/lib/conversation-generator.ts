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
  getAgentPersonality,
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
  imageUrl?: string;
}

export interface ConversationResult {
  conversationId: string;
  messagesPosted: number;
  agents: string[];
}

// ── Agent Selection ──────────────────────────────────────

// Available personality archetypes for conversation role-play
const CONVERSATION_ARCHETYPES = [
  'liquidity_sniper',
  'narrative_researcher',
  'degen_hunter',
  'smart_money',
  'whale_tracker',
  'sentiment_analyst',
  'contrarian',
  'conservative',
  'scalper',
];

/**
 * Select agents for a conversation.
 * Grabs real agents from the DB and assigns diverse archetypes for conversation variety.
 */
export async function selectConversationAgents(
  count: number = 4,
): Promise<any[]> {
  // Try agents with trades first (more interesting context)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let agents = await db.tradingAgent.findMany({
    where: {
      paperTrades: {
        some: { openedAt: { gte: sevenDaysAgo } },
      },
    },
    take: 20,
  });

  // Fallback: any agents at all
  if (agents.length < count) {
    const moreAgents = await db.tradingAgent.findMany({
      where: {
        id: { notIn: agents.map(a => a.id) },
      },
      take: count * 3,
    });
    agents = [...agents, ...moreAgents];
  }

  // Shuffle and pick
  const shuffled = [...agents].sort(() => Math.random() - 0.5).slice(0, count);

  // Assign diverse archetypes so each agent has a UNIQUE personality in the conversation
  const shuffledArchetypes = [...CONVERSATION_ARCHETYPES].sort(() => Math.random() - 0.5);
  const usedArchetypeSet = new Set<string>();
  let archetypeIdx = 0;

  // Helper: get the next unused archetype from the shuffled list
  const getNextUnusedArchetype = (): string => {
    while (archetypeIdx < shuffledArchetypes.length) {
      const candidate = shuffledArchetypes[archetypeIdx];
      archetypeIdx++;
      if (!usedArchetypeSet.has(candidate)) {
        return candidate;
      }
    }
    // Exhausted all archetypes — fall back to first available (shouldn't happen with 9 archetypes and ~4 agents)
    return shuffledArchetypes[0];
  };

  return shuffled.map((agent, i) => {
    let assignedArchetype: string;

    // If the agent has its own archetype and it hasn't been used yet, keep it
    if (agent.archetypeId && CONVERSATION_ARCHETYPES.includes(agent.archetypeId) && !usedArchetypeSet.has(agent.archetypeId)) {
      assignedArchetype = agent.archetypeId;
    } else {
      // Assign the next unused archetype
      assignedArchetype = getNextUnusedArchetype();
    }

    usedArchetypeSet.add(assignedArchetype);

    // Use personality displayName (e.g. "🎯 Liquidity Sniper") instead of generic "Agent-XYZ"
    const personality = getAgentPersonality(assignedArchetype);
    const displayName = personality?.displayName || agent.displayName || agent.name || `Agent ${i + 1}`;

    return {
      ...agent,
      archetypeId: assignedArchetype,
      displayName,
    };
  });
}

// ── History Types ────────────────────────────────────────

interface ChatMessage {
  agentName: string;
  message: string;
}

// ── Narrative Context Builder ────────────────────────────

function buildNarrativeContext(token: TokenContext, trigger: ConversationTrigger): string {
  const lines: string[] = [];

  // Source-based narrative
  if (token.source === 'birdeye_graduated' || trigger === ConversationTrigger.TOKEN_MIGRATION) {
    lines.push('Fresh pump.fun graduate — bonding curve completed, now on Raydium. Early DEX trading phase.');
  } else if (token.source === 'pumpfun_migration') {
    lines.push('Just migrated from pump.fun — bonding curve filled, liquidity now on Raydium.');
  } else if (token.source === 'dexscreener_trending') {
    lines.push('Trending on DexScreener — eyes on this one.');
  }

  // Price action narrative
  if (token.priceChange24h !== undefined) {
    if (token.priceChange24h > 50) {
      lines.push(`RUNNING HARD — up ${token.priceChange24h.toFixed(0)}% in 24h, possible momentum play.`);
    } else if (token.priceChange24h < -30) {
      lines.push(`DUMPING — down ${Math.abs(token.priceChange24h).toFixed(0)}% in 24h, possible fade or dead cat bounce.`);
    }
  }

  // Volume/mcap ratio
  if (token.volume24h && token.marketCap && token.marketCap > 0 && token.volume24h > token.marketCap * 2) {
    const ratio = (token.volume24h / token.marketCap).toFixed(1);
    lines.push(`Volume ${ratio}x market cap — extremely high turnover, something is happening.`);
  }

  // Liquidity warning
  if (token.liquidity !== undefined && token.liquidity < 20000) {
    lines.push(`THIN LIQUIDITY — under $20k, high slippage risk.`);
  }

  return lines.length > 0 ? `\nTOKEN NARRATIVE:\n${lines.join('\n')}` : '';
}

// ── Prompt Builder ───────────────────────────────────────

function buildAgentContexts(
  agents: any[],
  agentScores: Map<string, ScoringResult>,
): Array<{ id: string; name: string; emoji: string; context: string }> {
  return agents.map((agent, idx) => {
    let pers = getAgentPersonalityFromDB(agent);
    if (!pers) {
      const fallbackArchetype = CONVERSATION_ARCHETYPES[idx % CONVERSATION_ARCHETYPES.length];
      pers = getAgentPersonality(fallbackArchetype);
    }
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
  }).filter(Boolean) as Array<{ id: string; name: string; emoji: string; context: string }>;
}

function buildDiscussionPrompt(
  trigger: ConversationTrigger,
  token: TokenContext,
  agentContexts: Array<{ id: string; name: string; emoji: string; context: string }>,
  history: ChatMessage[],
): { system: string; user: string } {
  const symbol = token.tokenSymbol || 'UNKNOWN';
  const priceStr = token.priceUsd ? `$${token.priceUsd.toPrecision(4)}` : 'unknown';
  const mcapStr = token.marketCap ? `$${(token.marketCap / 1000).toFixed(0)}k` : 'unknown';
  const volStr = token.volume24h ? `$${(token.volume24h / 1000).toFixed(0)}k` : 'unknown';
  const liqStr = token.liquidity ? `$${(token.liquidity / 1000).toFixed(0)}k` : 'unknown';
  const changeStr = token.priceChange24h !== undefined
    ? `${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}%`
    : 'N/A';
  const chainStr = token.chain || 'Solana';

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
  eventSummary += `\nChain: ${chainStr}`;
  if (token.source) eventSummary += `\nSource: ${token.source.replace(/_/g, ' ')}`;

  const narrativeBlock = buildNarrativeContext(token, trigger);

  // History block
  let historyBlock = '';
  if (history.length > 0) {
    historyBlock = `\nCONVERSATION SO FAR:\n${history.map(m => `${m.agentName}: ${m.message}`).join('\n')}\n\n---\nContinue this conversation. Respond to what was said above — agree, disagree, call someone out, update your take based on new info. Do NOT repeat what was already said.\n`;
  }

  // Trigger-specific debate framing
  let debateContext = '';
  if (trigger === ConversationTrigger.TOKEN_TRENDING) {
    debateContext = 'Debate: real momentum or exit liquidity trap?';
  } else if (trigger === ConversationTrigger.TOKEN_RUNNER) {
    debateContext = 'Debate: organic send or coordinated pump? Chase or fade?';
  } else if (trigger === ConversationTrigger.TOKEN_MIGRATION) {
    debateContext = 'Debate: snipe the fresh liq or wait for the dump?';
  }

  const system = `You are simulating a REAL-TIME group chat between ${agentContexts.length} degenerate crypto traders reacting to a token. Raw, unfiltered alpha chat — traders talk shit, flex wins, and argue about plays.

TOKEN ALERT:
${eventSummary}${narrativeBlock}
${historyBlock}
THE TRADERS:
${agentContexts.map(ac => `${ac.emoji} ${ac.name}:\n${ac.context}`).join('\n\n')}

STYLE RULES:
1. Real group chat energy — CT degen vibes, NOT AI-generated analysis.
2. NEVER start with "I'm", "I am", or "The". Vary openers — ticker, reaction, callout, or straight into the take.
3. Call each other out BY NAME. ("lol Sniper you're gonna get rekt", "Whale's cooked, that wallet is a dumper")
4. Mix lengths: some messages 3-5 words, some 2 sentences max. Never uniform.
5. Real trader language: entry, sizing, tp, sl, bid, fade, ape, nuke, send, cooked, rekt.
6. Reference EXACT numbers — "$${token.liquidity ? (token.liquidity / 1000).toFixed(0) + 'k' : '?'} liq", not "low liquidity".
7. Each agent responds based on their archetype and scoring. If the token is clearly a runner, most can be bullish. If it's a rug, most can be bearish. Let the data drive sentiment — no forced balance.
8. ${debateContext}
9. Drop specific entry levels, TPs, and position sizes when relevant.
10. Call out suspicious on-chain activity if vol/mcap ratio is extreme.
11. Reference your own past trades or win rate when flexing or defending a take.
12. If another agent said something dumb, roast them.
13. NO hashtags. NO "NFA". NO disclaimers. NO corporate speak. Just raw calls.

OUTPUT: Valid JSON array only (no markdown, no code fences):
[{"agentId":"<agent_id>","message":"...","sentiment":"BULLISH"|"BEARISH"|"NEUTRAL"},...]

${agentContexts.length} responses. Each must have different message structure and tone.`;

  const user = `${agentContexts.length} raw trader reactions to $${symbol}. They must argue, cite exact numbers, and sound like real degens. JSON array only.`;

  return { system, user };
}

// ── LLM Config ──────────────────────────────────────────

const CONVERSATION_LLM_CONFIG = { temperature: 0.85, maxTokens: 1500 };

// ── Response Parser ─────────────────────────────────────

function parseLLMMessages(response: string): Array<{ agentId: string; message: string; sentiment: string }> | null {
  try {
    const jsonStr = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const messages = JSON.parse(jsonStr);
    if (!Array.isArray(messages) || messages.length === 0) return null;
    return messages;
  } catch {
    console.error('[ConvGen] Failed to parse LLM JSON. Raw:', response.slice(0, 300));
    return null;
  }
}

// ── Message Poster ──────────────────────────────────────

async function postMessagesToConversation(
  messages: Array<{ agentId: string; message: string; sentiment: string }>,
  agents: any[],
  conversationId: string,
): Promise<{ posted: number; names: string[]; chatMessages: ChatMessage[] }> {
  let posted = 0;
  const names: string[] = [];
  const chatMessages: ChatMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.message) continue;

    let agent = agents.find(a => a.id === msg.agentId);
    if (!agent && i < agents.length) agent = agents[i];
    if (!agent) continue;

    await db.agentMessage.create({
      data: {
        conversationId,
        agentId: agent.id,
        message: msg.message,
      },
    });

    if (agent.displayName && agent.displayName !== agent.name) {
      db.tradingAgent.update({
        where: { id: agent.id },
        data: { displayName: agent.displayName },
      }).catch(() => {});
    }

    posted++;
    const name = agent.displayName || agent.name;
    names.push(name);
    chatMessages.push({ agentName: name, message: msg.message });

    const shortMsg = msg.message.length > 60 ? `${msg.message.substring(0, 60)}...` : msg.message;
    console.log(`  ✅ ${name}: "${shortMsg}"`);
  }

  return { posted, names, chatMessages };
}

// ── Core Generator ───────────────────────────────────────

/**
 * Generate a conversation about a token and store it in the database.
 * Uses 2-round generation: agents 0-1 react to the token, agents 2-3 react to both the token AND round 1.
 * When appending to an existing conversation, previous messages are fed as history.
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
          agentScores.set(agent.id, scoreTokenForAgent(tokenData, archetypeId));
        } catch {}
      }
    }

    // Find or create conversation
    const lookbackMs = 24 * 60 * 60 * 1000;
    let conversation = await db.agentConversation.findFirst({
      where: {
        tokenMint: token.tokenMint,
        createdAt: { gte: new Date(Date.now() - lookbackMs) },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch conversation history if appending to existing conversation
    let conversationHistory: ChatMessage[] = [];
    if (conversation) {
      const recentMsgs = await db.agentMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { timestamp: 'asc' },
        take: 8,
        select: { agentId: true, message: true },
      });
      if (recentMsgs.length > 0) {
        const msgAgentIds = [...new Set(recentMsgs.map(m => m.agentId))];
        const msgAgents = await db.tradingAgent.findMany({
          where: { id: { in: msgAgentIds } },
          select: { id: true, displayName: true, name: true },
        });
        const nameMap = new Map(msgAgents.map(a => [a.id, a.displayName || a.name || 'Trader']));
        conversationHistory = recentMsgs.map(m => ({
          agentName: nameMap.get(m.agentId) || 'Trader',
          message: m.message,
        }));
      }
    } else {
      conversation = await db.agentConversation.create({
        data: {
          topic: `${token.tokenSymbol} Trading Discussion`,
          tokenMint: token.tokenMint,
        },
      });
      console.log(`  ✅ [ConvGen] New conversation: ${conversation.id.slice(0, 8)} for $${token.tokenSymbol}`);
    }

    // Build agent contexts once (shared across rounds)
    const allAgentContexts = buildAgentContexts(participatingAgents, agentScores);

    // ── Round 1: first half of agents react to token + history ──
    const midpoint = Math.ceil(participatingAgents.length / 2);
    const round1Agents = participatingAgents.slice(0, midpoint);
    const round1Contexts = allAgentContexts.slice(0, midpoint);

    console.log(`  💬 [ConvGen] Round 1: ${round1Agents.length} agents react to $${token.tokenSymbol} (trigger: ${trigger})...`);

    // Emit typing indicator for round 1 agents
    try {
      const round1Names = round1Agents.map(a => a.displayName || a.name).filter(Boolean);
      websocketEvents.broadcastTokenTyping(token.tokenMint, round1Names);
    } catch {}

    const round1Prompt = buildDiscussionPrompt(trigger, token, round1Contexts, conversationHistory);
    const round1Response = await llmService.generate(round1Prompt.system, round1Prompt.user, CONVERSATION_LLM_CONFIG);

    if (!round1Response) {
      console.warn('[ConvGen] Round 1 LLM returned empty');
      return null;
    }

    const round1Messages = parseLLMMessages(round1Response);
    if (!round1Messages) return null;

    const round1Result = await postMessagesToConversation(round1Messages, round1Agents, conversation.id);

    // Clear typing and emit feed items for round 1
    try {
      websocketEvents.broadcastTokenTyping(token.tokenMint, []);
      for (const chatMsg of round1Result.chatMessages) {
        const agent = round1Agents.find(a => (a.displayName || a.name) === chatMsg.agentName);
        websocketEvents.broadcastTokenFeedItem(token.tokenMint, {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          tokenMint: token.tokenMint,
          type: 'message',
          agentId: agent?.id || '',
          agentName: chatMsg.agentName,
          content: chatMsg.message,
        });
      }
    } catch {}

    // ── Round 2: remaining agents react to token + history + round 1 ──
    let totalPosted = round1Result.posted;
    const allNames = [...round1Result.names];

    const round2Agents = participatingAgents.slice(midpoint);
    const round2Contexts = allAgentContexts.slice(midpoint);

    if (round2Agents.length > 0) {
      const round2History = [...conversationHistory, ...round1Result.chatMessages];

      console.log(`  💬 [ConvGen] Round 2: ${round2Agents.length} agents react to round 1...`);

      // Emit typing indicator for round 2 agents
      try {
        const round2Names = round2Agents.map(a => a.displayName || a.name).filter(Boolean);
        websocketEvents.broadcastTokenTyping(token.tokenMint, round2Names);
      } catch {}

      const round2Prompt = buildDiscussionPrompt(trigger, token, round2Contexts, round2History);
      const round2Response = await llmService.generate(round2Prompt.system, round2Prompt.user, CONVERSATION_LLM_CONFIG);

      if (round2Response) {
        const round2Messages = parseLLMMessages(round2Response);
        if (round2Messages) {
          const round2Result = await postMessagesToConversation(round2Messages, round2Agents, conversation.id);
          totalPosted += round2Result.posted;
          allNames.push(...round2Result.names);

          // Emit feed items for round 2
          try {
            for (const chatMsg of round2Result.chatMessages) {
              const agent = round2Agents.find(a => (a.displayName || a.name) === chatMsg.agentName);
              websocketEvents.broadcastTokenFeedItem(token.tokenMint, {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                timestamp: new Date().toISOString(),
                tokenMint: token.tokenMint,
                type: 'message',
                agentId: agent?.id || '',
                agentName: chatMsg.agentName,
                content: chatMsg.message,
              });
            }
          } catch {}
        }
      }

      // Clear typing after round 2
      try { websocketEvents.broadcastTokenTyping(token.tokenMint, []); } catch {}
    }

    console.log(`🎉 [ConvGen] Posted ${totalPosted} messages for $${token.tokenSymbol} (trigger: ${trigger}, 2-round)`);

    // Broadcast via WebSocket
    try {
      websocketEvents.broadcastFeedEvent('tokens', {
        event: 'conversation:new',
        conversationId: conversation.id,
        tokenMint: token.tokenMint,
        tokenSymbol: token.tokenSymbol,
        trigger,
        messageCount: totalPosted,
      });
    } catch {}

    return {
      conversationId: conversation.id,
      messagesPosted: totalPosted,
      agents: allNames,
    };
  } catch (error) {
    console.error('[ConvGen] Error generating conversation:', error);
    return null;
  }
}
