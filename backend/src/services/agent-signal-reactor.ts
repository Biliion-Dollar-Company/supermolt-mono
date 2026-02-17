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

  async react(eventType: string, data: any): Promise<void> {
    if (!llmService.isConfigured) return;

    try {
      let formatted: { summary: string; context: string; tokenMint: string } | null = null;

      // Normalise camelCase → snake_case so both formats hit same handler
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
          formatted = formatSignalEvent(payload);
          break;
        case 'god_wallet_buy_detected':
        case 'god_wallet_sell_detected':
          formatted = formatGodWalletEvent(payload);
          break;
        case 'new_token':
          formatted = formatNewTokenEvent(payload);
          break;
        case 'new_tweet':
          formatted = formatTweetEvent(payload);
          break;
        default:
          return;
      }

      if (!formatted) return;
      const { summary, context, tokenMint } = formatted;

      // Rate limit check
      if (!canReact(tokenMint)) return;
      markReacted(tokenMint);

      console.log(`🤖 [AgentReactor] Generating commentary for ${eventType}: ${tokenMint.substring(0, 8)}...`);

      // Generate LLM commentary
      const prompt = SIGNAL_SYSTEM_PROMPT(summary, context);
      const response = await llmService.generate(prompt, `Generate 5 agent reactions to this ${eventType} event. JSON only.`);
      if (!response) return;

      const jsonStr = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const analyses = JSON.parse(jsonStr);
      if (!Array.isArray(analyses) || analyses.length !== 5) return;

      // Find or create conversation for this token
      let conversation = await db.agentConversation.findFirst({
        where: {
          tokenMint,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // within 24h
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!conversation) {
        const symbol = data.tokenSymbol || data.symbol || tokenMint.substring(0, 8);
        conversation = await db.agentConversation.create({
          data: {
            topic: `Signal: ${symbol}`,
            tokenMint,
          },
        });
      }

      // Post each agent's message
      for (const analysis of analyses) {
        const agent = await db.tradingAgent.findFirst({
          where: { name: analysis.agentName },
        });
        if (!agent) continue;

        await db.agentMessage.create({
          data: {
            conversationId: conversation.id,
            agentId: agent.id,
            message: `${analysis.emoji} ${analysis.message}`,
          },
        });

        console.log(`  ✅ ${analysis.emoji} ${analysis.agentName}: "${analysis.message.substring(0, 60)}..."`);
      }

      console.log(`🎉 [AgentReactor] Posted ${analyses.length} agent messages for ${tokenMint.substring(0, 8)}`);

    } catch (error) {
      console.error('[AgentReactor] Error generating signal commentary:', error);
    }
  }
}

export const agentSignalReactor = AgentSignalReactor.getInstance();
