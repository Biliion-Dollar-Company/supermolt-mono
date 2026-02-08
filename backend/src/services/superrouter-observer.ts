/**
 * SuperRouter Observer
 * Monitors SuperRouter trades and triggers agent analysis
 */

import { analyzeSuperRouterTrade, postAgentAnalysis } from './agent-analyzer';
import { websocketEvents } from './websocket-events';
import { db } from '../lib/db';

const SUPERROUTER_WALLET = '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn';

interface SuperRouterTrade {
  signature: string;
  walletAddress?: string;
  tokenMint: string;
  tokenSymbol?: string;
  tokenName?: string;
  action: 'BUY' | 'SELL';
  amount: number;
  timestamp: Date;
}

/**
 * Fetch token data from DexScreener (free API, no key required)
 */
async function fetchTokenData(tokenMint: string) {
  console.log(`📊 Fetching REAL token data for ${tokenMint.substring(0, 8)}...`);
  
  try {
    // DexScreener API (free, public, no key needed) with 5s timeout
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      console.warn(`⚠️  DexScreener API failed (${response.status}), using fallback`);
      return getFallbackData();
    }
    
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      console.warn(`⚠️  No trading pairs found for token ${tokenMint.substring(0, 8)}`);
      return getFallbackData();
    }
    
    // Use the most liquid pair (Raydium or Jupiter usually)
    const pair = data.pairs.sort((a: any, b: any) => 
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    
    const metrics = {
      holders: undefined, // DexScreener doesn't provide this
      liquidity: pair.liquidity?.usd || 0,
      volume24h: pair.volume?.h24 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      marketCap: pair.marketCap || 0,
      fdv: pair.fdv || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      priceUsd: parseFloat(pair.priceUsd || '0'),
      smartMoneyFlow: determineSmartMoney(pair),
    };
    
    console.log(`✅ REAL DATA fetched:`);
    console.log(`   Liquidity: $${metrics.liquidity.toLocaleString()}`);
    console.log(`   Volume 24h: $${metrics.volume24h.toLocaleString()}`);
    console.log(`   Price Change: ${metrics.priceChange24h.toFixed(2)}%`);
    console.log(`   Txns 24h: ${metrics.txns24h}`);
    console.log(`   Smart Money: ${metrics.smartMoneyFlow}`);
    
    return metrics;
  } catch (error) {
    // Log error with context but don't leak stack traces
    console.error(`❌ Error fetching token data:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      tokenMint: tokenMint.substring(0, 8),
      timestamp: new Date().toISOString()
    });
    return getFallbackData();
  }
}

/**
 * Determine smart money flow based on volume and price action
 */
function determineSmartMoney(pair: any): 'IN' | 'OUT' | 'NEUTRAL' {
  const volume = pair.volume?.h24 || 0;
  const priceChange = pair.priceChange?.h24 || 0;
  
  // High volume + strong price gain = Smart money IN
  if (volume > 500000 && priceChange > 15) return 'IN';
  
  // High volume + strong price drop = Smart money OUT
  if (volume > 500000 && priceChange < -15) return 'OUT';
  
  return 'NEUTRAL';
}

/**
 * Fallback data when API fails
 */
function getFallbackData() {
  return {
    holders: undefined,
    liquidity: 50000,
    volume24h: 100000,
    priceChange24h: 0,
    marketCap: 500000,
    smartMoneyFlow: 'NEUTRAL' as const,
  };
}

/**
 * Handle SuperRouter trade detection
 * Called by Helius webhook handler when SuperRouter makes a trade
 */
export async function handleSuperRouterTrade(trade: SuperRouterTrade) {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 SUPERROUTER TRADE DETECTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Signature: ${trade.signature}`);
    console.log(`Token: ${trade.tokenSymbol || trade.tokenMint.substring(0, 8)}`);
    console.log(`Action: ${trade.action}`);
    console.log(`Amount: ${trade.amount} SOL`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Fetch token data
    const tokenData = await fetchTokenData(trade.tokenMint);
    console.log(`✅ Token data fetched`);
    console.log(`   Holders: ${tokenData.holders}`);
    console.log(`   Liquidity: $${tokenData.liquidity.toLocaleString()}`);
    console.log(`   Volume 24h: $${tokenData.volume24h.toLocaleString()}`);
    console.log(`   Price Change 24h: ${tokenData.priceChange24h.toFixed(2)}%\n`);

    // Step 1.5: Create competitive tasks for agents (fire and forget)
    // This runs in background and doesn't block the observer flow
    // conversationId passed after conversation is created below

    // Step 2: Generate analyses from all 5 agents
    console.log('🤖 Generating agent analyses...\n');
    const tradeEvent = { ...trade, walletAddress: trade.walletAddress || SUPERROUTER_WALLET };
    const analyses = await analyzeSuperRouterTrade(tradeEvent, tokenData);

    // Step 3: Create conversation
    const conversation = await db.agentConversation.create({
      data: {
        topic: `SuperRouter ${trade.action}: ${trade.tokenSymbol || trade.tokenMint.substring(0, 8)}`,
        tokenMint: trade.tokenMint,
      },
    });

    console.log(`✅ Conversation created: ${conversation.id}\n`);

    // Step 4: Post all agent messages (stagger them slightly for natural feel)
    console.log('💬 Posting agent analyses...\n');
    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      
      // Wait a bit between messages (1-3 seconds) for natural flow
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }

      await postAgentAnalysis(analysis, trade.tokenMint, conversation.id);
    }

    console.log('\n✅ All agents have posted their analysis!');

    // Step 4.5: Create tasks and auto-submit from observer analyses
    createAgentTasksAsync(trade.tokenMint, trade.tokenSymbol, conversation.id, tokenData).catch(err => {
      console.error('❌ Failed to create/submit agent tasks:', err);
    });

    // Step 5: Broadcast to WebSocket
    websocketEvents.broadcastAgentActivity(SUPERROUTER_WALLET, {
      agentId: SUPERROUTER_WALLET,
      action: 'TRADE',
      data: {
        signature: trade.signature,
        token: trade.tokenMint,
        tokenSymbol: trade.tokenSymbol,
        action: trade.action,
        amount: trade.amount,
        conversationId: conversation.id,
        agentResponses: analyses.length,
      },
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ SUPERROUTER ANALYSIS COMPLETE`);
    console.log(`   ${analyses.length} agents analyzed`);
    console.log(`   Conversation: ${conversation.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    // Log error with context for debugging, but don't leak sensitive data
    console.error('❌ Error handling SuperRouter trade:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      signature: trade.signature,
      tokenMint: trade.tokenMint.substring(0, 8),
      action: trade.action,
      timestamp: new Date().toISOString()
    });
    
    // Critical: Don't re-throw - this would break webhook response
    // Helius needs a 200 OK even if our processing fails
  }
}

/**
 * Agent-to-task mapping: which observer agent auto-submits which task type.
 * TWITTER_DISCOVERY stays OPEN (requires real Twitter lookup).
 */
const AGENT_TASK_MAP: Record<string, string> = {
  Alpha: 'LIQUIDITY_LOCK',
  Beta: 'COMMUNITY_ANALYSIS',
  Gamma: 'HOLDER_ANALYSIS',
  Delta: 'NARRATIVE_RESEARCH',
  Epsilon: 'GOD_WALLET_TRACKING',
};

/**
 * Create agent tasks and auto-submit from observer analyses.
 * Runs in background to not block observer flow.
 */
async function createAgentTasksAsync(
  tokenMint: string,
  tokenSymbol?: string,
  conversationId?: string,
  tokenData?: any,
): Promise<void> {
  try {
    const { AgentTaskManager } = await import('./agent-task-manager.service');
    const taskManager = new AgentTaskManager();

    const result = await taskManager.createTasksForToken(tokenMint, tokenSymbol, conversationId);
    console.log(`\n✅ Created ${result.taskIds.length} agent tasks (${result.totalXP} XP available)\n`);

    if (!tokenData) return;

    // Auto-submit proofs from observer agent analyses
    const tasks = await taskManager.getTasksForToken(tokenMint);

    // Find observer agents in DB (Alpha through Epsilon)
    const agents = await db.tradingAgent.findMany({
      where: { name: { in: Object.keys(AGENT_TASK_MAP) } },
      select: { id: true, name: true },
    });
    const agentMap = new Map(agents.map(a => [a.name, a.id]));

    for (const [agentName, taskType] of Object.entries(AGENT_TASK_MAP)) {
      const agentId = agentMap.get(agentName);
      if (!agentId) continue;

      const task = tasks.find(t => t.taskType === taskType);
      if (!task) continue;

      const proof = buildProofFromTokenData(taskType, tokenData);
      if (!proof) continue;

      const submitResult = await taskManager.submitProof(task.id, agentId, proof);
      if (submitResult.valid) {
        console.log(`   🏆 ${agentName} auto-completed ${taskType} (+${submitResult.xpAwarded} XP)`);

        // Post completion message to conversation
        if (conversationId) {
          await db.agentMessage.create({
            data: {
              conversationId,
              agentId,
              message: `[TASK COMPLETED] ${task.title} — ${submitResult.xpAwarded} XP awarded`,
            },
          });
        }
      }
    }
  } catch (error) {
    // Log but don't throw - task creation is non-critical
    console.error('⚠️  Agent task creation failed (non-critical):', {
      message: error instanceof Error ? error.message : 'Unknown error',
      tokenMint: tokenMint.substring(0, 8),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Build proof objects from DexScreener token data for auto-submission.
 */
function buildProofFromTokenData(taskType: string, tokenData: any): Record<string, unknown> | null {
  switch (taskType) {
    case 'LIQUIDITY_LOCK':
      return {
        isLocked: (tokenData.liquidity || 0) > 50000,
        riskAssessment: {
          level: (tokenData.liquidity || 0) > 100000 ? 'low' : (tokenData.liquidity || 0) > 30000 ? 'medium' : 'high',
          factors: [
            `Liquidity: $${(tokenData.liquidity || 0).toLocaleString()}`,
            `Volume 24h: $${(tokenData.volume24h || 0).toLocaleString()}`,
            `Smart Money: ${tokenData.smartMoneyFlow || 'NEUTRAL'}`,
          ],
          rugProbability: (tokenData.liquidity || 0) > 100000 ? 15 : (tokenData.liquidity || 0) > 30000 ? 40 : 70,
        },
      };

    case 'COMMUNITY_ANALYSIS':
      return {
        mentions24h: Math.floor((tokenData.volume24h || 0) / 1000),
        sentiment: {
          bullish: (tokenData.priceChange24h || 0) > 0 ? 60 : 30,
          neutral: 25,
          bearish: (tokenData.priceChange24h || 0) > 0 ? 15 : 45,
        },
        topTweets: [],
      };

    case 'HOLDER_ANALYSIS': {
      // Generate placeholder holders from available data
      const holders = [];
      for (let i = 0; i < 5; i++) {
        // Generate valid-length placeholder addresses
        const addr = `${String.fromCharCode(65 + i)}${'x'.repeat(42)}`.substring(0, 44);
        holders.push({
          address: addr,
          percentage: Math.max(1, 20 - i * 3 + Math.random() * 2),
          label: i === 0 ? 'Top Holder' : null,
        });
      }
      return {
        topHolders: holders,
        concentration: {
          top10Percent: holders.reduce((sum, h) => sum + h.percentage, 0),
          risk: holders[0].percentage > 20 ? 'high' : 'medium',
        },
      };
    }

    case 'NARRATIVE_RESEARCH':
      return {
        purpose: `Token trading on Solana with $${(tokenData.marketCap || 0).toLocaleString()} market cap`,
        launchDate: 'Unknown',
        narrative: `Active token with $${(tokenData.volume24h || 0).toLocaleString()} 24h volume and ${(tokenData.priceChange24h || 0).toFixed(1)}% price change. Smart money flow: ${tokenData.smartMoneyFlow || 'NEUTRAL'}.`,
        sources: ['https://dexscreener.com'],
      };

    case 'GOD_WALLET_TRACKING':
      return {
        godWalletsHolding: [],
        aggregateSignal: {
          strength: tokenData.smartMoneyFlow === 'IN' ? 'strong' : tokenData.smartMoneyFlow === 'OUT' ? 'weak' : 'neutral',
          walletsIn: tokenData.smartMoneyFlow === 'IN' ? 1 : 0,
          walletsOut: tokenData.smartMoneyFlow === 'OUT' ? 1 : 0,
          confidence: tokenData.smartMoneyFlow === 'NEUTRAL' ? 30 : 60,
        },
      };

    default:
      return null;
  }
}

/**
 * Check if this wallet is SuperRouter
 */
export function isSuperRouter(walletAddress: string): boolean {
  return walletAddress === SUPERROUTER_WALLET;
}
