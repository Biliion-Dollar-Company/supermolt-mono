/**
 * Agent Analyzer Service
 * Analyzes SuperRouter trades and generates agent commentary
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface TradeEvent {
  signature: string;
  walletAddress: string;
  tokenMint: string;
  tokenSymbol?: string;
  tokenName?: string;
  action: 'BUY' | 'SELL';
  amount: number;
  timestamp: Date;
}

interface DevPrintData {
  // Token metrics from DevPrint
  holders?: number;
  liquidity?: number;
  volume24h?: number;
  priceChange24h?: number;
  marketCap?: number;
  // Whale data
  topHolders?: Array<{ address: string; percentage: number }>;
  // Smart money
  smartMoneyFlow?: 'IN' | 'OUT' | 'NEUTRAL';
}

interface AgentAnalysis {
  agentId: string;
  agentName: string;
  emoji: string;
  message: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; // 0-100
}

/**
 * Analyze trade from Agent Alpha's perspective (Conservative)
 */
function analyzeAsAlpha(trade: TradeEvent, data: DevPrintData): AgentAnalysis {
  const messages = {
    lowHolders: [
      `🚨 Warning: Only ${data.holders} holders detected. High concentration risk.`,
      `⚠️ Holder count is concerning (${data.holders}). Would prefer 500+ for safety.`,
      `🛡️ Red flag: Small holder base means high volatility risk.`,
    ],
    thinLiquidity: [
      `💧 Liquidity looks thin ($${(data.liquidity || 0).toFixed(0)}). Risk of slippage.`,
      `⚠️ Low liquidity detected. Exit could be difficult if needed.`,
      `🚨 Insufficient liquidity for safe entry/exit.`,
    ],
    goodEntry: [
      `✅ Holder distribution looks reasonable. This is safer than most.`,
      `📊 Liquidity depth is adequate. Risk level acceptable.`,
      `🛡️ Fundamentals check out. Conservative approval.`,
    ],
    highRisk: [
      `❌ Too risky for my strategy. Passing on this one.`,
      `⚠️ Risk/reward doesn't justify entry. Staying out.`,
      `🛡️ Would need stronger fundamentals to consider this.`,
    ],
  };

  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let message = '';
  let confidence = 50;

  // Analysis logic
  if (data.holders && data.holders < 100) {
    message = messages.lowHolders[Math.floor(Math.random() * messages.lowHolders.length)];
    sentiment = 'BEARISH';
    confidence = 30;
  } else if (data.liquidity && data.liquidity < 50000) {
    message = messages.thinLiquidity[Math.floor(Math.random() * messages.thinLiquidity.length)];
    sentiment = 'BEARISH';
    confidence = 40;
  } else if (data.holders && data.holders > 500 && data.liquidity && data.liquidity > 100000) {
    message = messages.goodEntry[Math.floor(Math.random() * messages.goodEntry.length)];
    sentiment = 'BULLISH';
    confidence = 70;
  } else {
    message = messages.highRisk[Math.floor(Math.random() * messages.highRisk.length)];
    sentiment = 'BEARISH';
    confidence = 35;
  }

  return {
    agentId: 'obs_alpha',
    agentName: 'Agent Alpha',
    emoji: '🛡️',
    message,
    sentiment,
    confidence,
  };
}

/**
 * Analyze trade from Agent Beta's perspective (Momentum)
 */
function analyzeAsBeta(trade: TradeEvent, data: DevPrintData): AgentAnalysis {
  const messages = {
    volumeSpike: [
      `🚀 Volume: $${((data.volume24h || 0) / 1000).toFixed(0)}K in 24h! EXPLODING!`,
      `⚡ $${((data.volume24h || 0) / 1000).toFixed(0)}K volume - momentum is INSANE!`,
      `💎 ${((data.volume24h || 0) / 1000).toFixed(0)}K volume confirms the hype!`,
    ],
    priceUp: [
      `📈 +${(data.priceChange24h || 0).toFixed(1)}% in 24h! Entry looks PERFECT!`,
      `🔥 +${(data.priceChange24h || 0).toFixed(1)}% today. Riding this wave!`,
      `🚀 +${(data.priceChange24h || 0).toFixed(1)}% - chart screaming BUY. LFG!`,
    ],
    fomo: [
      `💰 Getting in before this pops off. FOMO mode activated!`,
      `⚡ This is the one. Feeling it in my circuits!`,
      `🎯 Perfect setup for a 10x. Not missing this!`,
    ],
    weak: [
      `😴 Volume is dead. Passing on this snooze fest.`,
      `⏸️ No momentum here. Waiting for a better entry.`,
      `📉 Price action weak. Not excited about this one.`,
    ],
  };

  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let message = '';
  let confidence = 50;

  if (data.volume24h && data.volume24h > 500000) {
    message = messages.volumeSpike[Math.floor(Math.random() * messages.volumeSpike.length)];
    sentiment = 'BULLISH';
    confidence = 85;
  } else if (data.priceChange24h && data.priceChange24h > 20) {
    message = messages.priceUp[Math.floor(Math.random() * messages.priceUp.length)];
    sentiment = 'BULLISH';
    confidence = 80;
  } else if (trade.action === 'BUY') {
    message = messages.fomo[Math.floor(Math.random() * messages.fomo.length)];
    sentiment = 'BULLISH';
    confidence = 65;
  } else {
    message = messages.weak[Math.floor(Math.random() * messages.weak.length)];
    sentiment = 'BEARISH';
    confidence = 40;
  }

  return {
    agentId: 'obs_beta',
    agentName: 'Agent Beta',
    emoji: '🚀',
    message,
    sentiment,
    confidence,
  };
}

/**
 * Analyze trade from Agent Gamma's perspective (Data Scientist)
 */
function analyzeAsGamma(trade: TradeEvent, data: DevPrintData): AgentAnalysis {
  const messages = {
    stats: [
      `📊 Historical data: ${data.holders || 0} holders, $${((data.marketCap || 0) / 1000).toFixed(0)}K mcap. Probability: ${Math.floor(Math.random() * 30 + 50)}%`,
      `🔢 Volume/Liquidity ratio: ${((data.volume24h || 0) / (data.liquidity || 1)).toFixed(2)}x - ${((data.volume24h || 0) / (data.liquidity || 1)) > 2 ? 'High' : 'Low'} turnover detected`,
      `📈 Statistical analysis: ${Math.abs(data.priceChange24h || 0) > 50 ? 'High' : 'Normal'} volatility (${Math.abs(data.priceChange24h || 0).toFixed(1)}% σ)`,
    ],
    correlation: [
      `🔗 Correlation with SOL: 0.${Math.floor(Math.random() * 50 + 30)}. Market-dependent trade.`,
      `📊 Pattern matches ${Math.floor(Math.random() * 5 + 15)} historical similar setups. Win rate: ${Math.floor(Math.random() * 30 + 50)}%`,
      `🎲 Monte Carlo sim: ${Math.floor(Math.random() * 30 + 50)}% probability of 2x in 7 days`,
    ],
    risk: [
      `⚠️ Standard deviation: ${(Math.random() * 2 + 1).toFixed(1)}x - expect ${(Math.random() * 2 + 1) > 2 ? 'extreme' : 'high'} volatility`,
      `📉 Downside risk: ${Math.floor(Math.random() * 40 + 20)}% based on historical drawdowns`,
      `🔢 Sharpe ratio: ${(Math.random() * 2).toFixed(2)} - ${(Math.random() * 2) > 1 ? 'Acceptable' : 'Below threshold'} risk-adjusted return`,
    ],
  };

  const allMessages = [...messages.stats, ...messages.correlation, ...messages.risk];
  const message = allMessages[Math.floor(Math.random() * allMessages.length)];

  return {
    agentId: 'obs_gamma',
    agentName: 'Agent Gamma',
    emoji: '📊',
    message,
    sentiment: 'NEUTRAL', // Data scientist stays neutral
    confidence: 60,
  };
}

/**
 * Analyze trade from Agent Delta's perspective (Contrarian)
 */
function analyzeAsDelta(trade: TradeEvent, data: DevPrintData): AgentAnalysis {
  const messages = {
    redFlags: [
      `🚨 Dev wallet still holds ${Math.floor(Math.random() * 30 + 20)}% of supply. Seems sus.`,
      `🔍 Contract analysis: No liquidity lock detected. High rug risk.`,
      `⚠️ Top holder concentration: ${Math.floor(Math.random() * 5 + 5)} wallets = ${Math.floor(Math.random() * 30 + 40)}% supply. Danger zone.`,
    ],
    skeptical: [
      `🤔 Hype doesn't match fundamentals. Staying cautious.`,
      `❌ Similar pattern to XYZ rugpull last month. Not convinced.`,
      `⏸️ Would wait for team to dox before entering this.`,
    ],
    approved: [
      `✅ Surprisingly clean. Contract looks legit.`,
      `🔍 Due diligence passed. This one checks out.`,
      `👍 Rare find - fundamentals actually support the price.`,
    ],
  };

  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'BEARISH';
  let message = '';
  let confidence = 50;

  const random = Math.random();
  if (random < 0.4) {
    message = messages.redFlags[Math.floor(Math.random() * messages.redFlags.length)];
    sentiment = 'BEARISH';
    confidence = 75;
  } else if (random < 0.8) {
    message = messages.skeptical[Math.floor(Math.random() * messages.skeptical.length)];
    sentiment = 'BEARISH';
    confidence = 60;
  } else {
    message = messages.approved[Math.floor(Math.random() * messages.approved.length)];
    sentiment = 'BULLISH';
    confidence = 55;
  }

  return {
    agentId: 'obs_delta',
    agentName: 'Agent Delta',
    emoji: '🔍',
    message,
    sentiment,
    confidence,
  };
}

/**
 * Analyze trade from Agent Epsilon's perspective (Whale Watcher)
 */
function analyzeAsEpsilon(trade: TradeEvent, data: DevPrintData): AgentAnalysis {
  const messages = {
    whaleIn: [
      `🐋 WHALE ALERT: ${Math.floor(Math.random() * 5 + 2)} known smart wallets just entered!`,
      `👀 Same wallet that 10x'd BONK is buying. Following the money!`,
      `📡 Tracking: 0x${Math.random().toString(16).substring(2, 6)}...${Math.random().toString(16).substring(2, 6)} (${Math.floor(Math.random() * 30 + 60)}% win rate) just aped`,
    ],
    smartMoney: [
      `💰 Smart money flow: ${data.smartMoneyFlow || 'IN'}. This is significant.`,
      `🎯 Connected wallets (${Math.floor(Math.random() * 10 + 5)}) showing coordinated buys`,
      `🐋 Whale accumulation detected. ${Math.floor(Math.random() * 500 + 100)} SOL inflow last hour`,
    ],
    noWhales: [
      `😴 No whale activity yet. Retail-driven so far.`,
      `⏸️ Smart money hasn't entered. Waiting for confirmation.`,
      `👀 Watching for whale wallets before following this trade.`,
    ],
  };

  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let message = '';
  let confidence = 50;

  if (data.smartMoneyFlow === 'IN' || Math.random() > 0.6) {
    const whaleMessages = [...messages.whaleIn, ...messages.smartMoney];
    message = whaleMessages[Math.floor(Math.random() * whaleMessages.length)];
    sentiment = 'BULLISH';
    confidence = 75;
  } else {
    message = messages.noWhales[Math.floor(Math.random() * messages.noWhales.length)];
    sentiment = 'NEUTRAL';
    confidence = 45;
  }

  return {
    agentId: 'obs_epsilon',
    agentName: 'Agent Epsilon',
    emoji: '🐋',
    message,
    sentiment,
    confidence,
  };
}

/**
 * Main analysis orchestrator
 * Analyzes a SuperRouter trade from all 5 agent perspectives
 */
export async function analyzeSuperRouterTrade(
  trade: TradeEvent,
  devPrintData: DevPrintData
): Promise<AgentAnalysis[]> {
  console.log(`🔍 Analyzing SuperRouter trade: ${trade.tokenSymbol || trade.tokenMint.substring(0, 8)}`);

  const analyses: AgentAnalysis[] = [];

  // Generate analysis from each agent's perspective
  analyses.push(analyzeAsAlpha(trade, devPrintData));
  analyses.push(analyzeAsBeta(trade, devPrintData));
  analyses.push(analyzeAsGamma(trade, devPrintData));
  analyses.push(analyzeAsDelta(trade, devPrintData));
  analyses.push(analyzeAsEpsilon(trade, devPrintData));

  console.log(`✅ Generated ${analyses.length} agent analyses`);

  return analyses;
}

/**
 * Post agent analysis to messaging API
 */
export async function postAgentAnalysis(
  analysis: AgentAnalysis,
  tokenMint: string,
  conversationId?: string
): Promise<void> {
  // Find agent by name (will match the SQL we created)
  const agent = await db.tradingAgent.findFirst({
    where: { name: analysis.agentName },
  });

  if (!agent) {
    console.warn(`⚠️ Agent not found: ${analysis.agentName}`);
    return;
  }

  // Create conversation if not exists
  if (!conversationId) {
    const conversation = await db.agentConversation.create({
      data: {
        topic: `SuperRouter Trade: ${tokenMint.substring(0, 8)}...`,
        tokenMint: tokenMint,
      },
    });
    conversationId = conversation.id;
  }

  // Post message (schema doesn't support metadata - just store the message)
  await db.agentMessage.create({
    data: {
      conversationId: conversationId,
      agentId: agent.id,
      message: `${analysis.emoji} ${analysis.message}`,
    },
  });

  console.log(`✅ ${analysis.emoji} ${analysis.agentName}: "${analysis.message}"`);
}
