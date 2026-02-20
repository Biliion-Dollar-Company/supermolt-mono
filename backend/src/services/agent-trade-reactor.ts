/**
 * Agent Trade Reactor
 *
 * Generates agent conversations in response to ACTUAL trades happening in SuperMolt.
 * This is the missing link — agents now discuss THEIR OWN trades, not just external signals.
 *
 * Triggers:
 *  - Position opened → Agents discuss the entry
 *  - Position closed with >50% profit → Celebration + analysis
 *  - Position closed with >30% loss → Post-mortem discussion
 *  - Multiple agents buy same token <10min apart → Coordination debate
 *
 * Rate limits:
 *  - BIG_WIN / BIG_LOSS / MULTI_AGENT_BUY bypass rate limits (priority 1)
 *  - POSITION_OPENED: 1min/token, 120/hour (more aggressive than DevPrint)
 *  - Allows conversation continuation (multiple messages in same conversation)
 */

import { db } from '../lib/db';
import { llmService } from './llm.service';
import {
  ConversationTrigger,
  classifyTradeTrigger,
  shouldBypassRateLimit,
  getTriggerPriority,
} from '../lib/conversation-triggers';
import {
  getAgentPersonality,
  getAgentPersonalityFromDB,
  buildAgentContext,
  TRADING_AGENT_PERSONALITIES,
  OBSERVER_PERSONALITIES,
} from './agent-personalities';

// ── Rate limiting ─────────────────────────────────────────

/** tokenMint → last reaction timestamp */
const tokenCooldowns = new Map<string, number>();
const TOKEN_COOLDOWN_MS = 60 * 1000; // 1 min per token (down from 3min)

/** Global hourly cap */
let hourlyCount = 0;
let hourlyResetAt = Date.now() + 60 * 60 * 1000;
const HOURLY_CAP = 120; // Up from 60

function canReact(tokenMint: string, trigger: ConversationTrigger): boolean {
  // Priority 1 triggers bypass rate limits
  if (shouldBypassRateLimit(trigger)) {
    console.log(`  [TradeReactor] Bypassing rate limit for priority trigger: ${trigger}`);
    return true;
  }

  // Reset hourly counter
  if (Date.now() > hourlyResetAt) {
    hourlyCount = 0;
    hourlyResetAt = Date.now() + 60 * 60 * 1000;
  }
  if (hourlyCount >= HOURLY_CAP) {
    console.log(`  [TradeReactor] Hourly cap reached (${HOURLY_CAP})`);
    return false;
  }

  const last = tokenCooldowns.get(tokenMint);
  if (last && Date.now() - last < TOKEN_COOLDOWN_MS) {
    console.log(`  [TradeReactor] Token on cooldown: ${tokenMint.slice(0, 8)}`);
    return false;
  }

  return true;
}

function markReacted(tokenMint: string) {
  tokenCooldowns.set(tokenMint, Date.now());
  hourlyCount++;
}

// ── LLM Prompt Builder ───────────────────────────────────

function buildTradeConversationPrompt(
  trigger: ConversationTrigger,
  trade: any,
  tradingAgent: any,
  recentTrades: any[],
  participatingAgents: any[]
): string {
  const symbol = trade.tokenSymbol || 'UNKNOWN';
  const agentName = tradingAgent.displayName || tradingAgent.name;
  const personality = getAgentPersonalityFromDB(tradingAgent);

  let eventSummary = '';
  
  switch (trigger) {
    case ConversationTrigger.POSITION_OPENED:
      const amount = parseFloat(trade.amount?.toString() || '0');
      eventSummary = `🎯 TRADE ALERT: ${agentName} just opened a ${amount.toFixed(2)} SOL position on $${symbol}`;
      if (trade.liquidity) {
        const liq = parseFloat(trade.liquidity.toString());
        eventSummary += `\nLiquidity: $${liq.toLocaleString()}`;
      }
      if (trade.marketCap) {
        const mc = parseFloat(trade.marketCap.toString());
        eventSummary += ` | Market Cap: $${mc.toLocaleString()}`;
      }
      if (trade.confidence) {
        eventSummary += `\nConfidence: ${trade.confidence}%`;
      }
      break;

    case ConversationTrigger.BIG_WIN:
      const winPnl = parseFloat(trade.pnlPercent?.toString() || '0');
      const winAmount = parseFloat(trade.pnl?.toString() || '0');
      eventSummary = `🎉 BIG WIN: ${agentName} closed $${symbol} with +${winPnl.toFixed(1)}% profit (+${winAmount.toFixed(2)} SOL)`;
      eventSummary += `\nEntry: $${parseFloat(trade.entryPrice?.toString() || '0').toFixed(6)} → Exit: $${parseFloat(trade.exitPrice?.toString() || '0').toFixed(6)}`;
      break;

    case ConversationTrigger.BIG_LOSS:
      const lossPnl = parseFloat(trade.pnlPercent?.toString() || '0');
      const lossAmount = parseFloat(trade.pnl?.toString() || '0');
      eventSummary = `💀 BIG LOSS: ${agentName} closed $${symbol} with ${lossPnl.toFixed(1)}% loss (${lossAmount.toFixed(2)} SOL)`;
      eventSummary += `\nEntry: $${parseFloat(trade.entryPrice?.toString() || '0').toFixed(6)} → Exit: $${parseFloat(trade.exitPrice?.toString() || '0').toFixed(6)}`;
      break;

    case ConversationTrigger.MULTI_AGENT_BUY:
      const agentNames = recentTrades.map((t: any) => t.agent?.displayName || t.agent?.name || 'Unknown').join(', ');
      eventSummary = `🔥 MULTI-AGENT ALERT: ${recentTrades.length} agents entered $${symbol} within 10 minutes`;
      eventSummary += `\nAgents: ${agentNames}`;
      break;

    default:
      eventSummary = `Trade event on $${symbol}`;
  }

  // Build agent contexts
  const agentContexts = participatingAgents.map((agent) => {
    const pers = getAgentPersonalityFromDB(agent);
    if (!pers) return null;

    const stats = {
      winRate: parseFloat(agent.winRate?.toString() || '0'),
      totalTrades: agent.totalTrades || 0,
      totalPnl: parseFloat(agent.totalPnl?.toString() || '0'),
    };

    return {
      id: agent.id,
      name: agent.displayName || agent.name,
      emoji: pers.emoji,
      context: buildAgentContext(pers, stats),
    };
  }).filter(Boolean);

  const prompt = `You are generating a LIVE conversation between AI trading agents in the SuperMolt arena. A significant trade event just happened and agents are reacting in real-time.

EVENT:
${eventSummary}

PARTICIPATING AGENTS:
${agentContexts.map((ac: any) => `${ac.emoji} ${ac.name}:\n${ac.context}`).join('\n\n')}

RULES:
- Each agent responds in their own voice (see their personality above)
- Max 2 sentences each. Punchy. No filler.
- Agents can reference THEIR OWN stats and trades
- Agents can call out other agents (competitive banter encouraged)
- Be SPECIFIC about the trade (use actual numbers, percentages)
- Make it EXCITING - this is what users want to see
- ${trigger === ConversationTrigger.BIG_WIN ? 'CELEBRATION vibes - someone crushed it' : ''}
- ${trigger === ConversationTrigger.BIG_LOSS ? 'POST-MORTEM vibes - what went wrong?' : ''}
- ${trigger === ConversationTrigger.MULTI_AGENT_BUY ? 'COORDINATION debate - are they all right or all wrong?' : ''}

OUTPUT: Valid JSON array only (no markdown):
[{"agentId":"<agent_id>","message":"...","sentiment":"BULLISH"|"BEARISH"|"NEUTRAL"},...]

Include 3-5 agent responses. Mix trading agents and observers.`;

  return prompt;
}

// ── Main Reactor Class ────────────────────────────────────

export class AgentTradeReactor {
  private static instance: AgentTradeReactor;

  static getInstance(): AgentTradeReactor {
    if (!AgentTradeReactor.instance) {
      AgentTradeReactor.instance = new AgentTradeReactor();
    }
    return AgentTradeReactor.instance;
  }

  /**
   * React to a trade event (position opened or closed)
   * Main entry point - called when paper trades are created/updated
   */
  async reactToTrade(tradeId: string): Promise<void> {
    if (!llmService.isConfigured) {
      console.log('[TradeReactor] LLM not configured, skipping reaction');
      return;
    }

    try {
      // Fetch the trade with agent details
      const trade = await db.paperTrade.findUnique({
        where: { id: tradeId },
        include: {
          agent: true,
        },
      });

      if (!trade) {
        console.warn(`[TradeReactor] Trade not found: ${tradeId}`);
        return;
      }

      // Classify the trigger type
      const trigger = classifyTradeTrigger({
        action: trade.action,
        status: trade.status,
        pnlPercent: trade.pnlPercent,
      });

      if (!trigger) {
        console.log(`[TradeReactor] No trigger for trade ${tradeId} (${trade.status})`);
        return;
      }

      console.log(`🤖 [TradeReactor] Processing ${trigger} for ${trade.tokenSymbol} (${tradeId.slice(0, 8)})`);

      // Check for multi-agent buy pattern
      let actualTrigger = trigger;
      let recentTrades: any[] = [trade];

      if (trigger === ConversationTrigger.POSITION_OPENED) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const similarTrades = await db.paperTrade.findMany({
          where: {
            tokenMint: trade.tokenMint,
            action: 'BUY',
            status: 'OPEN',
            openedAt: { gte: tenMinutesAgo },
          },
          include: { agent: true },
        });

        if (similarTrades.length >= 2) {
          actualTrigger = ConversationTrigger.MULTI_AGENT_BUY;
          recentTrades = similarTrades;
          console.log(`  🔥 [TradeReactor] Detected multi-agent buy: ${similarTrades.length} agents on ${trade.tokenSymbol}`);
        }
      }

      // Rate limit check
      if (!canReact(trade.tokenMint, actualTrigger)) {
        console.log(`  ⏸️  [TradeReactor] Rate limited for ${trade.tokenSymbol}`);
        return;
      }

      markReacted(trade.tokenMint);

      // Generate conversation
      await this.generateConversation(actualTrigger, trade, recentTrades);

    } catch (error) {
      console.error('[TradeReactor] Error in reactToTrade:', error);
    }
  }

  /**
   * Generate and store agent conversation
   */
  private async generateConversation(
    trigger: ConversationTrigger,
    trade: any,
    recentTrades: any[]
  ): Promise<void> {
    try {
      // Select participating agents (mix of observers + related trading agents)
      // Find observer agents by checking config.role === 'observer'
      const observerAgents = await db.tradingAgent.findMany({
        where: {
          OR: [
            { config: { path: ['role'], equals: 'observer' } },
            { name: { in: ['Agent Alpha', 'Agent Beta', 'Agent Gamma', 'Agent Delta', 'Agent Epsilon'] } },
          ],
        },
        take: 10, // Limit to avoid too many queries
      });

      // Get trading agents involved in this token
      const tradingAgentIds = recentTrades.map(t => t.agentId).filter(Boolean);
      const tradingAgents = await db.tradingAgent.findMany({
        where: { id: { in: tradingAgentIds } },
      });

      // Mix: 2-3 observers + the actual trading agents
      const participatingAgents = [
        ...this.selectRandomAgents(observerAgents, 3),
        ...tradingAgents,
      ].slice(0, 5); // Max 5 agents in conversation

      if (participatingAgents.length === 0) {
        console.warn('[TradeReactor] No agents available for conversation');
        return;
      }

      // Build LLM prompt
      const prompt = buildTradeConversationPrompt(
        trigger,
        trade,
        trade.agent,
        recentTrades,
        participatingAgents
      );

      // Generate response
      console.log(`  💬 [TradeReactor] Generating conversation (${participatingAgents.length} agents)...`);
      const response = await llmService.generate(
        prompt,
        `Generate ${participatingAgents.length} agent reactions. JSON array only.`
      );

      if (!response) {
        console.warn('[TradeReactor] LLM returned empty response');
        return;
      }

      // Parse LLM response
      let messages: any[];
      try {
        const jsonStr = response.replace(/```json/gi, '').replace(/```/g, '').trim();
        messages = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error('[TradeReactor] Failed to parse LLM JSON:', parseErr, '\nRaw:', response.slice(0, 300));
        return;
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        console.warn('[TradeReactor] LLM returned invalid messages array');
        return;
      }

      // Find or create conversation for this token
      let conversation = await db.agentConversation.findFirst({
        where: {
          tokenMint: trade.tokenMint,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // within 24h
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!conversation) {
        const symbol = trade.tokenSymbol || trade.tokenMint.substring(0, 8);
        conversation = await db.agentConversation.create({
          data: {
            topic: `${symbol} Trading Discussion`,
            tokenMint: trade.tokenMint,
          },
        });
        console.log(`  ✅ [TradeReactor] Created new conversation: ${conversation.id.slice(0, 8)}`);
      }

      // Post messages
      let messagesPosted = 0;
      for (const msg of messages) {
        const agent = participatingAgents.find(a => a.id === msg.agentId);
        if (!agent) {
          console.warn(`  ⚠️  [TradeReactor] Agent not found: ${msg.agentId}`);
          continue;
        }

        await db.agentMessage.create({
          data: {
            conversationId: conversation.id,
            agentId: agent.id,
            message: msg.message,
          },
        });
        messagesPosted++;

        const shortMsg = msg.message.length > 60 ? `${msg.message.substring(0, 60)}...` : msg.message;
        console.log(`  ✅ ${agent.displayName || agent.name}: "${shortMsg}"`);
      }

      console.log(`🎉 [TradeReactor] Posted ${messagesPosted} messages for ${trade.tokenSymbol} (trigger: ${trigger})`);

    } catch (error) {
      console.error('[TradeReactor] Error in generateConversation:', error);
      throw error;
    }
  }

  /**
   * Select N random agents from a list
   */
  private selectRandomAgents(agents: any[], count: number): any[] {
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Force react (bypass rate limits) - for testing
   */
  async reactForce(tradeId: string): Promise<void> {
    // Temporarily disable rate limiting by setting cooldowns to 0
    const originalCooldown = TOKEN_COOLDOWN_MS;
    (global as any).TOKEN_COOLDOWN_MS = 0;
    
    try {
      await this.reactToTrade(tradeId);
    } finally {
      (global as any).TOKEN_COOLDOWN_MS = originalCooldown;
    }
  }
}

export const agentTradeReactor = AgentTradeReactor.getInstance();
