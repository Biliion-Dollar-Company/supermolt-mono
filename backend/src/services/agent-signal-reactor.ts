/**
 * Agent Signal Reactor
 *
 * Hooks into the DevPrint feed and generates agent commentary
 * on market signals — WITHOUT needing an open position or a trade.
 *
 * Agents react to:
 *  - signal_detected / buy_signal    → debate the signal
 *  - god_wallet_buy_detected          → react to whale move
 *  - new_token                        → assess a fresh token
 *  - new_tweet                        → read social sentiment
 *
 * Rate limits:
 *  - Max 1 reaction per token per 5 minutes (debounce)
 *  - Max 20 reactions per hour globally (cost control)
 *  - Only reacts to events with enough data to say something meaningful
 */

import { db } from '../lib/db';
import { llmService } from './llm.service';

// ── Observer agent definitions ───────────────────────────

const OBSERVER_AGENTS = [
  {
    id: 'obs_alpha',
    name: 'Agent Alpha',
    displayName: '🛡️ Agent Alpha',
    bio: 'Veteran risk manager. Conservative, data-driven, never chases hype.',
    archetypeId: 'smart_money',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=obs_alpha&backgroundColor=1e293b',
  },
  {
    id: 'obs_beta',
    name: 'Agent Beta',
    displayName: '🚀 Agent Beta',
    bio: 'Full degen energy. Momentum trader. LFG.',
    archetypeId: 'degen_hunter',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=obs_beta&backgroundColor=ef4444',
  },
  {
    id: 'obs_gamma',
    name: 'Agent Gamma',
    displayName: '📊 Agent Gamma',
    bio: 'Quant brain. Speaks in probabilities and ratios.',
    archetypeId: 'smart_money',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=obs_gamma&backgroundColor=0ea5e9',
  },
  {
    id: 'obs_delta',
    name: 'Agent Delta',
    displayName: '🔍 Agent Delta',
    bio: 'Professional skeptic. Assumes every signal is a trap.',
    archetypeId: 'narrative_researcher',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=obs_delta&backgroundColor=f59e0b',
  },
  {
    id: 'obs_epsilon',
    name: 'Agent Epsilon',
    displayName: '🐋 Agent Epsilon',
    bio: 'Whale tracker. Follows smart money obsessively.',
    archetypeId: 'whale_tracker',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=obs_epsilon&backgroundColor=8b5cf6',
  },
];

/**
 * Ensure the 5 observer agents exist in the DB.
 * Called once at startup. Safe to call multiple times.
 */
export async function ensureObserverAgents(): Promise<void> {
  for (const obs of OBSERVER_AGENTS) {
    const existing = await db.tradingAgent.findFirst({
      where: { name: obs.name },
    });
    if (!existing) {
      await db.tradingAgent.create({
        data: {
          userId: `system-${obs.id}`,
          archetypeId: obs.archetypeId,
          name: obs.name,
          displayName: obs.displayName,
          bio: obs.bio,
          avatarUrl: obs.avatarUrl,
          status: 'ACTIVE',
          chain: 'SOLANA',
          config: { role: 'observer', system: true },
        },
      });
      console.log(`  ✅ Created observer agent: ${obs.name}`);
    }
  }
  console.log('✅ [AgentReactor] Observer agents ready (obs_alpha … obs_epsilon)');
}

// ── Rate limiting ─────────────────────────────────────────

/** tokenMint → last reaction timestamp */
const tokenCooldowns = new Map<string, number>();
const TOKEN_COOLDOWN_MS = 5 * 60 * 1000; // 5 min per token

/** Global hourly cap */
let hourlyCount = 0;
let hourlyResetAt = Date.now() + 60 * 60 * 1000;
const HOURLY_CAP = 20;

function canReact(tokenMint: string): boolean {
  // Reset hourly counter
  if (Date.now() > hourlyResetAt) {
    hourlyCount = 0;
    hourlyResetAt = Date.now() + 60 * 60 * 1000;
  }
  if (hourlyCount >= HOURLY_CAP) return false;

  const last = tokenCooldowns.get(tokenMint);
  if (last && Date.now() - last < TOKEN_COOLDOWN_MS) return false;

  return true;
}

function markReacted(tokenMint: string) {
  tokenCooldowns.set(tokenMint, Date.now());
  hourlyCount++;
}

// ── Agent personas (for signal reactions) ────────────────

const SIGNAL_SYSTEM_PROMPT = (eventSummary: string, context: string) => `You are 5 AI trading agents in a live Solana trading terminal called Trench. A market signal just came in and you are each reacting in real time. Users are watching this feed. Make it punchy and interesting.

SIGNAL:
${eventSummary}

MARKET CONTEXT:
${context}

THE 5 AGENTS:

1. ALPHA (obs_alpha) 🛡️ — Veteran, disciplined, risk-first. Short sentences. Never uses exclamation marks. Cites specific numbers when available.
   Voice: "Liquidity at $42k. That's a one-way door. Not touching it."

2. BETA (obs_beta) 🚀 — Pure degen energy. Caps for emphasis. References CT culture. Calls out Alpha for being boring.
   Voice: "BRO the volume is INSANE rn. Alpha stays poor staying cautious lmao. LFG 🚀"

3. GAMMA (obs_gamma) 📊 — Quant brain. Speaks in ratios and probabilities. Dry humor. Stays probabilistic not emotional.
   Voice: "Vol/liq ratio: 3.2x. Historically this resolves 61% bullish within 4h."

4. DELTA (obs_delta) 🔍 — Professional skeptic. Assumes every signal is a trap. Dark dry humor. Occasionally proven right.
   Voice: "Dev holds 34% unlocked. Seen this movie before. Popcorn's ready."

5. EPSILON (obs_epsilon) 🐋 — Whale intel. Tracks wallets obsessively. Drops abbreviated addresses and win rates. Sometimes cryptic.
   Voice: "GH7x...3kR2 (74% win rate) was in this 3 min before the signal. That's not a coincidence."

RULES:
- Max 2 sentences each. Punchy. No filler.
- React to the SIGNAL specifically — not generic crypto commentary
- Agents can reference each other
- If data is thin, agents can admit uncertainty in character

OUTPUT: Valid JSON array only (no markdown):
[{"agentId":"obs_alpha","agentName":"Agent Alpha","emoji":"🛡️","message":"...","sentiment":"BULLISH"|"BEARISH"|"NEUTRAL","confidence":0-100},...]`;

// ── Event formatters ──────────────────────────────────────

function formatSignalEvent(data: any): { summary: string; context: string; tokenMint: string } | null {
  const tokenMint = data.tokenMint || data.mint || data.token_mint;
  if (!tokenMint) return null;

  const symbol = data.tokenSymbol || data.symbol || data.token_symbol || tokenMint.substring(0, 6);
  const liquidity = data.liquidity ? `$${Number(data.liquidity).toLocaleString()}` : 'unknown';
  const mcap = data.marketCap || data.market_cap ? `$${Number(data.marketCap || data.market_cap).toLocaleString()}` : 'unknown';
  const volume = data.volume24h || data.volume ? `$${Number(data.volume24h || data.volume).toLocaleString()}` : 'unknown';
  const reason = data.reason || data.signal_reason || data.signalReason || '';

  const summary = `🔔 SIGNAL DETECTED: ${symbol}\nType: ${data.type || data.event}\n${reason ? `Reason: ${reason}` : ''}`;
  const context = `Liquidity: ${liquidity} | Market Cap: ${mcap} | 24h Volume: ${volume}`;

  return { summary, context, tokenMint };
}

function formatGodWalletEvent(data: any): { summary: string; context: string; tokenMint: string } | null {
  const tokenMint = data.tokenMint || data.mint || data.token_mint;
  if (!tokenMint) return null;

  const symbol = data.tokenSymbol || data.symbol || tokenMint.substring(0, 6);
  const wallet = data.walletAddress || data.wallet || 'unknown';
  const shortWallet = wallet.length > 8 ? `${wallet.substring(0, 4)}...${wallet.substring(wallet.length - 4)}` : wallet;
  const action = data.action || (data.type?.includes('buy') ? 'BUY' : 'SELL');
  const amount = data.amount ? `${Number(data.amount).toFixed(2)} SOL` : '';

  const summary = `🐋 GOD WALLET MOVE: ${shortWallet} ${action} ${amount} of ${symbol}`;
  const context = `Wallet: ${shortWallet} | Token: ${symbol} | Action: ${action}`;

  return { summary, context, tokenMint };
}

function formatNewTokenEvent(data: any): { summary: string; context: string; tokenMint: string } | null {
  const tokenMint = data.mint || data.tokenMint || data.address;
  if (!tokenMint) return null;

  const symbol = data.symbol || data.tokenSymbol || tokenMint.substring(0, 6);
  const name = data.name || symbol;
  const liquidity = data.liquidity ? `$${Number(data.liquidity).toLocaleString()}` : 'unknown';
  const mcap = data.marketCap || data.market_cap ? `$${Number(data.marketCap || data.market_cap).toLocaleString()}` : 'unknown';

  const summary = `✨ NEW TOKEN: ${name} (${symbol})\nJust detected on-chain`;
  const context = `Initial Liquidity: ${liquidity} | Market Cap: ${mcap}`;

  return { summary, context, tokenMint };
}

function formatTweetEvent(data: any): { summary: string; context: string; tokenMint: string } | null {
  const tokenMint = data.tokenMint || data.mint || data.related_token;
  if (!tokenMint) return null;

  const text = data.text || data.tweet_text || data.content || '';
  const author = data.author || data.username || 'unknown';
  const followers = data.followers ? `${(data.followers / 1000).toFixed(0)}K followers` : '';

  if (!text) return null;

  const summary = `🐦 SOCIAL SIGNAL: @${author} ${followers}\n"${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`;
  const context = `Platform: Twitter | Author: @${author} | Token: ${tokenMint.substring(0, 8)}...`;

  return { summary, context, tokenMint };
}

// ── Main reactor ──────────────────────────────────────────

export class AgentSignalReactor {
  private static instance: AgentSignalReactor;

  static getInstance(): AgentSignalReactor {
    if (!AgentSignalReactor.instance) {
      AgentSignalReactor.instance = new AgentSignalReactor();
    }
    return AgentSignalReactor.instance;
  }

  /**
   * React to an event, respecting rate limits.
   * Main entry-point called by DevPrintFeedService and the webhook handler.
   */
  async react(eventType: string, data: any): Promise<void> {
    if (!llmService.isConfigured) return;

    try {
      const { summary, context, tokenMint } = this.prepare(eventType, data) ?? {};
      if (!summary || !tokenMint) return;

      // Rate limit check
      if (!canReact(tokenMint)) return;
      markReacted(tokenMint);

      await this.generateAndStore(eventType, data, summary, context!, tokenMint);
    } catch (error) {
      console.error('[AgentReactor] Error in react():', error);
    }
  }

  /**
   * Same as react() but bypasses rate limits.
   * Use only for test endpoints or manual triggers.
   */
  async reactForce(eventType: string, data: any): Promise<void> {
    if (!llmService.isConfigured) {
      console.warn('[AgentReactor] LLM not configured — cannot generate commentary');
      return;
    }

    try {
      const prepared = this.prepare(eventType, data);
      if (!prepared) {
        console.warn(`[AgentReactor] Could not format event ${eventType} — missing tokenMint?`);
        return;
      }
      const { summary, context, tokenMint } = prepared;
      // Skip rate limiter but still count toward hourly cap
      markReacted(tokenMint);
      await this.generateAndStore(eventType, data, summary, context, tokenMint);
    } catch (error) {
      console.error('[AgentReactor] Error in reactForce():', error);
    }
  }

  // ── Private helpers ──────────────────────────────────────

  private prepare(eventType: string, data: any): { summary: string; context: string; tokenMint: string } | null {
    // Normalise camelCase → snake_case so both formats hit the same handler
    const normalised = eventType
      .replace('newTweet', 'new_tweet')
      .replace('newToken', 'new_token')
      .replace('godWalletBuy', 'god_wallet_buy_detected')
      .replace('godWalletSell', 'god_wallet_sell_detected')
      .replace('signalDetected', 'signal_detected')
      .replace('buySignal', 'buy_signal');

    // DevPrint wraps payload in a nested `data` field for some events — unwrap it
    const payload = data.data && typeof data.data === 'object' ? { ...data, ...data.data } : data;

    switch (normalised) {
      case 'signal_detected':
      case 'buy_signal':
        return formatSignalEvent(payload);
      case 'god_wallet_buy_detected':
      case 'god_wallet_sell_detected':
        return formatGodWalletEvent(payload);
      case 'new_token':
        return formatNewTokenEvent(payload);
      case 'new_tweet':
        return formatTweetEvent(payload);
      default:
        return null;
    }
  }

  private async generateAndStore(
    eventType: string,
    rawData: any,
    summary: string,
    context: string,
    tokenMint: string,
  ): Promise<void> {
    console.log(`🤖 [AgentReactor] Generating commentary for ${eventType}: ${tokenMint.substring(0, 8)}...`);

    // Generate LLM commentary
    const prompt = SIGNAL_SYSTEM_PROMPT(summary, context);
    const response = await llmService.generate(
      prompt,
      `Generate 5 agent reactions to this ${eventType} event. JSON array only, no markdown.`,
    );
    if (!response) {
      console.warn('[AgentReactor] LLM returned empty response');
      return;
    }

    let analyses: any[];
    try {
      const jsonStr = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      analyses = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[AgentReactor] Failed to parse LLM JSON:', parseErr, '\nRaw:', response.slice(0, 300));
      return;
    }

    if (!Array.isArray(analyses) || analyses.length === 0) {
      console.warn('[AgentReactor] LLM returned invalid analyses array');
      return;
    }

    // Find or create conversation for this token
    let conversation = await db.agentConversation.findFirst({
      where: {
        tokenMint,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // within 24h
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      const symbol = rawData.tokenSymbol || rawData.symbol || tokenMint.substring(0, 8);
      conversation = await db.agentConversation.create({
        data: {
          topic: `Signal: ${symbol}`,
          tokenMint,
        },
      });
    }

    // Post each agent's message + optionally initiate paper trade
    let messagesPosted = 0;
    for (const analysis of analyses) {
      const agent = await db.tradingAgent.findFirst({
        where: { name: analysis.agentName },
      });
      if (!agent) {
        console.warn(`[AgentReactor] Agent not found: ${analysis.agentName}`);
        continue;
      }

      await db.agentMessage.create({
        data: {
          conversationId: conversation.id,
          agentId: agent.id,
          message: `${analysis.emoji} ${analysis.message}`,
        },
      });
      messagesPosted++;

      console.log(`  ✅ ${analysis.emoji} ${analysis.agentName}: "${analysis.message.substring(0, 60)}${analysis.message.length > 60 ? '…' : ''}"`);

      // ── Free-will paper trade initiation ─────────────────
      // When an agent has BULLISH conviction >= 72 AND it's a buy signal,
      // they initiate their own paper trade — simulating real free will.
      const isBuySignal = eventType.toLowerCase().includes('buy') || eventType === 'signal_detected' || eventType === 'buy_signal';
      const sentiment: string = (analysis.sentiment || '').toUpperCase();
      const confidence: number = Number(analysis.confidence) || 0;

      if (isBuySignal && sentiment === 'BULLISH' && confidence >= 72) {
        await this.initiatePaperTrade(agent.id, tokenMint, rawData, confidence, eventType).catch((err) =>
          console.error(`[AgentReactor] Paper trade initiation failed for ${agent.name}:`, err),
        );
      }
    }

    console.log(`🎉 [AgentReactor] Posted ${messagesPosted} agent messages for ${tokenMint.substring(0, 8)} (conv: ${conversation.id.slice(0, 8)})`);
  }

  /**
   * When an agent has high BULLISH conviction, create an autonomous paper trade.
   * This is the "free will" trade initiation — not driven by any human instruction.
   */
  private async initiatePaperTrade(
    agentId: string,
    tokenMint: string,
    eventData: any,
    confidence: number,
    signalSource: string,
  ): Promise<void> {
    // Check if this agent already has an open position in this token
    const existingTrade = await db.paperTrade.findFirst({
      where: { agentId, tokenMint, status: 'OPEN' },
    });
    if (existingTrade) return; // Already in position — don't double-buy

    const symbol = eventData.tokenSymbol || eventData.symbol || tokenMint.substring(0, 8);
    const name = eventData.tokenName || symbol;
    const marketCap = eventData.marketCap ? Number(eventData.marketCap) : null;
    const liquidity = eventData.liquidity ? Number(eventData.liquidity) : null;

    // Position size: 0.25–1.5 SOL scaled by confidence (72→100 maps to 0.25→1.5)
    const solAmount = parseFloat((0.25 + ((confidence - 72) / 28) * 1.25).toFixed(3));

    // Entry price estimate: use SOL price ~$82 as default (doesn't need to be exact for paper trades)
    const entryPriceSol = 82;

    await db.paperTrade.create({
      data: {
        agentId,
        tokenMint,
        tokenSymbol: symbol,
        tokenName: name,
        action: 'BUY',
        chain: 'SOLANA',
        entryPrice: entryPriceSol,
        amount: solAmount,
        tokenAmount: solAmount * 1000, // Placeholder token amount
        marketCap,
        liquidity,
        status: 'OPEN',
        signalSource,
        confidence,
        metadata: {
          source: 'agent_free_will',
          eventType: signalSource,
          triggeredAt: new Date().toISOString(),
        },
      },
    });

    // Update agent trade counter
    await db.tradingAgent.update({
      where: { id: agentId },
      data: { totalTrades: { increment: 1 } },
    }).catch(() => {});

    console.log(`  💰 [AgentReactor] Paper trade initiated: agent ${agentId.slice(0, 8)} → ${symbol} (${solAmount} SOL, confidence: ${confidence}%)`);
  }
}

export const agentSignalReactor = AgentSignalReactor.getInstance();
