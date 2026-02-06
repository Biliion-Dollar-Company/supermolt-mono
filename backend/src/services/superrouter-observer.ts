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
 * Fetch token data from DevPrint or Birdeye
 */
async function fetchTokenData(tokenMint: string) {
  console.log(`📊 Fetching token data for ${tokenMint.substring(0, 8)}...`);
  
  // TODO: Replace with actual DevPrint API call
  // For now, return mock data
  return {
    holders: Math.floor(Math.random() * 1000 + 100),
    liquidity: Math.floor(Math.random() * 500000 + 50000),
    volume24h: Math.floor(Math.random() * 1000000 + 100000),
    priceChange24h: (Math.random() - 0.5) * 100,
    marketCap: Math.floor(Math.random() * 5000000 + 500000),
    smartMoneyFlow: Math.random() > 0.5 ? 'IN' : (Math.random() > 0.5 ? 'OUT' : 'NEUTRAL'),
  } as any;
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

    // Step 2: Generate analyses from all 5 agents
    console.log('🤖 Generating agent analyses...\n');
    const analyses = await analyzeSuperRouterTrade(trade, tokenData);

    // Step 3: Create conversation
    const conversation = await db.agentConversation.create({
      data: {
        topic: `SuperRouter ${trade.action}: ${trade.tokenSymbol || trade.tokenMint.substring(0, 8)}`,
        tokenMint: trade.tokenMint,
        metadata: {
          superRouterSignature: trade.signature,
          action: trade.action,
          amount: trade.amount,
          timestamp: trade.timestamp.toISOString(),
        },
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
 * Check if this wallet is SuperRouter
 */
export function isSuperRouter(walletAddress: string): boolean {
  return walletAddress === SUPERROUTER_WALLET;
}
