/**
 * Quick test script for the trade reactor
 * Run with: bun run test-trade-reactor.ts
 */

import { db } from './src/lib/db';
import { agentTradeReactor } from './src/services/agent-trade-reactor';

async function testTradeReactor() {
  console.log('🧪 Testing Trade Reactor...\n');

  try {
    // Find a recent trade to test with
    const recentTrade = await db.paperTrade.findFirst({
      where: { status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      include: { agent: true },
    });

    if (!recentTrade) {
      console.log('❌ No open trades found. Creating a test trade...');
      
      // Find an agent to create a test trade
      const agent = await db.tradingAgent.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!agent) {
        console.log('❌ No active agents found. Cannot test.');
        process.exit(1);
      }

      // Create a test trade
      const testTrade = await db.paperTrade.create({
        data: {
          agentId: agent.id,
          tokenMint: 'TEST123456789',
          tokenSymbol: 'TEST',
          tokenName: 'Test Token',
          action: 'BUY',
          chain: 'SOLANA',
          entryPrice: 100,
          amount: 1.5,
          tokenAmount: 1500,
          status: 'OPEN',
          signalSource: 'test_reactor',
          confidence: 85,
          liquidity: 50000,
          marketCap: 500000,
          metadata: { test: true },
        },
      });

      console.log(`✅ Created test trade: ${testTrade.id}`);
      console.log(`   Agent: ${agent.name}`);
      console.log(`   Token: ${testTrade.tokenSymbol}`);
      console.log(`   Amount: ${testTrade.amount} SOL\n`);

      // Test the reactor
      console.log('🔥 Triggering trade reactor...\n');
      await agentTradeReactor.reactForce(testTrade.id);

      // Check if conversation was created
      const conversation = await db.agentConversation.findFirst({
        where: { tokenMint: testTrade.tokenMint },
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      if (conversation) {
        console.log('\n🎉 SUCCESS! Conversation created:');
        console.log(`   Conversation ID: ${conversation.id}`);
        console.log(`   Topic: ${conversation.topic}`);
        console.log(`   Messages: ${conversation.messages.length}\n`);

        console.log('📝 Sample messages:');
        for (const msg of conversation.messages.slice(0, 3)) {
          console.log(`   - ${msg.message.substring(0, 100)}...`);
        }
      } else {
        console.log('\n⚠️  No conversation created. Check logs above.');
      }

    } else {
      console.log(`✅ Found existing trade: ${recentTrade.id}`);
      console.log(`   Agent: ${recentTrade.agent.name}`);
      console.log(`   Token: ${recentTrade.tokenSymbol}`);
      console.log(`   Status: ${recentTrade.status}\n`);

      // Test the reactor
      console.log('🔥 Triggering trade reactor...\n');
      await agentTradeReactor.reactForce(recentTrade.id);

      // Check if conversation was created
      const conversation = await db.agentConversation.findFirst({
        where: { tokenMint: recentTrade.tokenMint },
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      if (conversation && conversation.messages.length > 0) {
        console.log('\n🎉 SUCCESS! Conversation updated:');
        console.log(`   Conversation ID: ${conversation.id}`);
        console.log(`   Topic: ${conversation.topic}`);
        console.log(`   Messages: ${conversation.messages.length}\n`);

        console.log('📝 Recent messages:');
        for (const msg of conversation.messages.slice(0, 3)) {
          console.log(`   - ${msg.message.substring(0, 100)}...`);
        }
      } else {
        console.log('\n⚠️  No conversation found or no messages generated. Check logs above.');
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

testTradeReactor();
