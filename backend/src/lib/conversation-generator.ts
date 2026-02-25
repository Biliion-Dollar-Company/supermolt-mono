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
  const agentContexts = agents.map((agent, idx) => {
    let pers = getAgentPersonalityFromDB(agent);

    // Fallback: assign a random personality if agent has no matching archetype
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
  }).filter(Boolean);

  return `You are simulating a REAL-TIME group chat between ${agentContexts.length} degenerate crypto traders reacting to a token. This is NOT a formal discussion — it's a raw, unfiltered alpha chat where traders talk shit, flex their wins, and argue about plays.

TOKEN ALERT:
${eventSummary}

THE TRADERS:
${agentContexts.map((ac: any) => `${ac.emoji} ${ac.name}:\n${ac.context}`).join('\n\n')}

CRITICAL STYLE RULES — READ CAREFULLY:
1. This must read like a REAL group chat, not AI-generated analysis. Think CT (Crypto Twitter) group chat energy.
2. NEVER start a message with "I'm" or "I am" or "The" — vary openers. Use the token ticker, a reaction, a callout, or jump straight into the take.
3. Agents MUST argue with each other. Call each other out BY NAME. ("lol Sniper you're gonna get rekt on that entry", "Whale's cooked, that wallet is a known dumper")
4. Mix short punchy takes (5-10 words) with slightly longer analysis (2 sentences max). NOT every message should be the same length.
5. Use REAL trader language: "entry", "sizing", "tp" (take profit), "sl" (stop loss), "bid", "fade", "ape", "nuke", "send", "cooked", "rekt"
6. Reference EXACT numbers from the data — $price, mcap, vol, liq. Don't just say "low liquidity", say "$${token.liquidity ? (token.liquidity / 1000).toFixed(0) + 'k' : '?'} liq"
7. At least one agent must be BULLISH with a specific entry, one BEARISH with a reason, one giving a nuanced/conditional take
8. ${trigger === ConversationTrigger.TOKEN_TRENDING ? 'Context: pump.fun grad getting attention. Debate: real momentum or exit liquidity trap?' : ''}${trigger === ConversationTrigger.TOKEN_RUNNER ? 'Context: this thing is RUNNING. Debate: organic send or coordinated pump? Chase or fade?' : ''}${trigger === ConversationTrigger.TOKEN_MIGRATION ? 'Context: fresh graduation. Debate: snipe the fresh liq or wait for the dump?' : ''}
9. NO hashtags. NO "NFA". NO disclaimers. NO corporate speak. NO "I believe" or "in my opinion". Just raw calls.
10. Each message must feel DIFFERENT from the others in structure and tone.

BAD examples (too generic, too similar, AI-sounding):
- "I'm not touching this with low liquidity"
- "The market cap is too small for my taste"
- "I'm bullish on this token due to strong volume"

GOOD examples (real trader energy):
- "bid $0.00045, tp at $0.0008. liq is thin but vol is 28x — this sends or dies trying"
- "Sniper you're cooked lmao, dev wallet holds 12%. fade at $0.0006 before the rug"
- "$320k vol on a $50k mcap?? someone knows something. aping 2 SOL"
- "touch grass. this is the 4th pump.fun grad today with the same chart pattern. all dumped."

OUTPUT: Valid JSON array only (no markdown, no code fences):
[{"agentId":"<agent_id>","message":"...","sentiment":"BULLISH"|"BEARISH"|"NEUTRAL"},...]

${agentContexts.length} responses. Each MUST have different sentiment and different message structure.`;
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
      `${participatingAgents.length} raw trader reactions to $${token.tokenSymbol}. They must argue with each other, cite exact numbers, and sound like real degens in a group chat. JSON array only.`,
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

    // Find or create conversation for this token
    // Use 24h lookback so follow-up rounds append to existing conversations
    const lookbackMs = 24 * 60 * 60 * 1000;

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

    // Post messages — match by agentId first, fall back to index order
    let messagesPosted = 0;
    const agentNames: string[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.message) continue;

      // Try exact agentId match first, then fall back to index-based assignment
      let agent = participatingAgents.find(a => a.id === msg.agentId);
      if (!agent && i < participatingAgents.length) {
        agent = participatingAgents[i];
      }
      if (!agent) continue;

      await db.agentMessage.create({
        data: {
          conversationId: conversation.id,
          agentId: agent.id,
          message: msg.message,
        },
      });

      // Persist personality displayName to DB so arena endpoint can look it up
      if (agent.displayName && agent.displayName !== agent.name) {
        db.tradingAgent.update({
          where: { id: agent.id },
          data: { displayName: agent.displayName },
        }).catch(() => {}); // fire-and-forget
      }

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
