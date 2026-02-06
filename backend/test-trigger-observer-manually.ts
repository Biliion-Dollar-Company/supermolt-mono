#!/usr/bin/env bun
/**
 * Manually trigger observer analysis to test the fix
 * Simulates what happens when Helius webhook detects SuperRouter trade
 */

import { PrismaClient } from '@prisma/client';
import { handleSuperRouterTrade } from './src/services/superrouter-observer';

const db = new PrismaClient();

async function testObserverAnalysis() {
  console.log('🧪 Testing Observer Analysis System\n');
  console.log('⚠️  This will create a real conversation + messages in the database\n');

  // Simulate a SuperRouter trade
  const mockTrade = {
    signature: 'TEST_' + Date.now() + '_' + Math.random().toString(36).substring(7),
    tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC for testing
    tokenSymbol: 'USDC',
    tokenName: 'USD Coin',
    action: 'BUY' as const,
    amount: 10,
    timestamp: new Date(),
  };

  console.log('📊 Mock Trade:');
  console.log(`   Token: ${mockTrade.tokenSymbol} (${mockTrade.tokenMint.substring(0, 8)}...)`);
  console.log(`   Action: ${mockTrade.action}`);
  console.log(`   Amount: ${mockTrade.amount} SOL`);
  console.log(`   Signature: ${mockTrade.signature}\n`);

  try {
    console.log('🚀 Triggering observer analysis...\n');
    await handleSuperRouterTrade(mockTrade);
    console.log('\n✅ Test complete! Check the logs above for details.\n');

    // Query the conversation we just created
    console.log('🔍 Checking what was created...');
    const latestConv = await db.agentConversation.findFirst({
      where: {
        topic: {
          contains: mockTrade.tokenSymbol,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        messages: true,
      },
    });

    if (latestConv) {
      console.log(`\n📝 Conversation Created:`);
      console.log(`   ID: ${latestConv.id}`);
      console.log(`   Topic: ${latestConv.topic}`);
      console.log(`   Messages: ${latestConv.messages.length}`);

      if (latestConv.messages.length > 0) {
        console.log(`\n💬 Messages:`);
        latestConv.messages.forEach((msg, idx) => {
          console.log(`   ${idx + 1}. Agent: ${msg.agentId.substring(0, 12)}...`);
          console.log(`      Message: ${msg.message.substring(0, 80)}...`);
        });
        console.log('\n🎉 SUCCESS! Messages were created!\n');
      } else {
        console.log('\n❌ FAILED: Conversation created but no messages!\n');
      }
    } else {
      console.log('\n❌ FAILED: No conversation found!\n');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await db.$disconnect();
  }
}

testObserverAnalysis();
