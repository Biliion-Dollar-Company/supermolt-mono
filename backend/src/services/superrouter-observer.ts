/**
 * SuperRouter Observer
 * Monitors SuperRouter trades and triggers agent analysis
 */

import { PrismaClient } from '@prisma/client';
import { analyzeSuperRouterTrade, postAgentAnalysis } from './agent-analyzer';
import { websocketEvents } from './websocket-events';

const db = new PrismaClient();

const SUPERROUTER_WALLET = '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn';

interface SuperRouterTrade {
  signature: string;
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
    // DexScreener API (free, public, no key needed)
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`;
    const response = await fetch(url);
    
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
      holders: null, // DexScreener doesn't provide this
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
    console.error(`❌ Error fetching token data:`, error);
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
    holders: null,
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
    createAgentTasksAsync(trade.tokenMint, trade.tokenSymbol).catch(err => {
      console.error('❌ Failed to create agent tasks:', err);
    });

    // Step 2: Generate analyses from all 5 agents
    console.log('🤖 Generating agent analyses...\n');
    const analyses = await analyzeSuperRouterTrade(trade, tokenData);

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
    console.error('❌ Error handling SuperRouter trade:', error);
  }
}

/**
 * Create agent tasks asynchronously (fire and forget)
 * Runs in background to not block observer flow
 */
async function createAgentTasksAsync(tokenMint: string, tokenSymbol?: string): Promise<void> {
  try {
    const { AgentTaskManager } = await import('./agent-task-manager.service');
    const taskManager = new AgentTaskManager();
    
    const result = await taskManager.createTasksForToken(tokenMint, tokenSymbol);
    console.log(`\n✅ Created ${result.taskIds.length} agent tasks (${result.totalXP} XP available)\n`);
  } catch (error) {
    // Log but don't throw - task creation is non-critical
    console.error('⚠️  Agent task creation failed (non-critical):', error);
  }
}

/**
 * Check if this wallet is SuperRouter
 */
export function isSuperRouter(walletAddress: string): boolean {
  return walletAddress === SUPERROUTER_WALLET;
}
