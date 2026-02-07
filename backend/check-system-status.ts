#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function checkSystemStatus() {
  try {
    console.log('\n🔍 SYSTEM STATUS CHECK\n');
    console.log('━'.repeat(60));
    
    // 1. Count observer agents
    const observerCount = await db.tradingAgent.count({
      where: { role: 'observer' }
    });
    console.log(`\n📊 Observer Agents: ${observerCount}`);
    
    // 2. List all observer agents
    const observers = await db.tradingAgent.findMany({
      where: { role: 'observer' },
      select: {
        agentId: true,
        displayName: true,
        walletAddress: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('\n👥 Observer List:');
    observers.forEach((agent, idx) => {
      console.log(`  ${idx + 1}. ${agent.displayName} (${agent.agentId})`);
      console.log(`     Wallet: ${agent.walletAddress}`);
    });
    
    // 3. Count messages posted
    const messageCount = await db.agentMessage.count();
    console.log(`\n💬 Total Messages Posted: ${messageCount}`);
    
    // 4. Count conversations
    const conversationCount = await db.agentConversation.count();
    console.log(`📝 Total Conversations: ${conversationCount}`);
    
    // 5. Recent activity (last 10 messages)
    const recentMessages = await db.agentMessage.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: {
          select: { displayName: true }
        },
        conversation: {
          select: { tokenMint: true }
        }
      }
    });
    
    console.log('\n💬 Last 10 Messages:');
    recentMessages.forEach((msg, idx) => {
      const time = new Date(msg.createdAt).toLocaleString();
      console.log(`  ${idx + 1}. [${time}] ${msg.agent.displayName}:`);
      console.log(`     "${msg.content.substring(0, 80)}..."`);
    });
    
    // 6. Check if we need more agents
    console.log('\n━'.repeat(60));
    if (observerCount < 7) {
      console.log(`\n⚠️  You have ${observerCount} observer agents. Need ${7 - observerCount} more to reach 7.`);
    } else {
      console.log(`\n✅ You have ${observerCount} observer agents (target: 7)`);
    }
    
    // 7. System health
    console.log('\n🏥 System Health:');
    console.log(`  Database: ✅ Connected`);
    console.log(`  Agents: ${observerCount > 0 ? '✅' : '❌'} ${observerCount} active`);
    console.log(`  Messages: ${messageCount > 0 ? '✅' : '❌'} ${messageCount} posted`);
    console.log(`  Conversations: ${conversationCount > 0 ? '✅' : '❌'} ${conversationCount} created`);
    
    console.log('\n━'.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkSystemStatus();
