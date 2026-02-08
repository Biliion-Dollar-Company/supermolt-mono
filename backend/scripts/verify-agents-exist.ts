#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

// Get DATABASE_URL from Railway
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:GrHgoylHRBnWygCwOkovCKkmVgprCAXP@postgres.railway.internal:5432/railway';

const db = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL.replace('postgres.railway.internal', 'viaduct.proxy.rlwy.net').replace(':5432', ':28015')
    }
  }
});

async function verifyAgents() {
  try {
    console.log('\n🔍 VERIFYING AGENTS IN PRODUCTION DATABASE...\n');
    console.log('━'.repeat(70));
    
    // 1. Count all agents
    const totalAgents = await db.tradingAgent.count();
    console.log(`\n📊 Total Agents: ${totalAgents}`);
    
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
    
    console.log(`\n👥 Observer Agents: ${observers.length}`);
    observers.forEach((agent, idx) => {
      console.log(`  ${idx + 1}. ${agent.displayName} (${agent.agentId})`);
      console.log(`     Wallet: ${agent.walletAddress}`);
      console.log(`     Created: ${new Date(agent.createdAt).toLocaleString()}`);
    });
    
    // 3. Count conversations
    const convCount = await db.agentConversation.count();
    console.log(`\n📝 Total Conversations: ${convCount}`);
    
    // 4. Count messages
    const msgCount = await db.agentMessage.count();
    console.log(`💬 Total Messages: ${msgCount}`);
    
    // 5. Get last 10 messages
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
    
    console.log(`\n💬 Last 10 Messages:`);
    recentMessages.forEach((msg, idx) => {
      const time = new Date(msg.createdAt).toLocaleString();
      console.log(`  ${idx + 1}. [${time}] ${msg.agent.displayName}:`);
      console.log(`     "${msg.content.substring(0, 80)}..."`);
      console.log(`     Token: ${msg.conversation.tokenMint.substring(0, 8)}...`);
    });
    
    // 6. Check monitoring status
    const monitoredWallets = await db.walletMonitoring.count();
    console.log(`\n👁️  Monitored Wallets: ${monitoredWallets}`);
    
    console.log('\n━'.repeat(70));
    
    if (totalAgents === 0) {
      console.log('\n❌ NO AGENTS FOUND - Database is empty');
      console.log('   Need to recreate observer agents');
    } else if (observers.length === 0) {
      console.log('\n⚠️  Agents exist but NO OBSERVERS');
      console.log('   Need to create observer agents');
    } else {
      console.log(`\n✅ AGENTS ARE PRESENT: ${observers.length} observers active`);
      if (msgCount > 0) {
        console.log(`✅ AGENTS ARE WORKING: ${msgCount} messages posted`);
      } else {
        console.log(`⚠️  Agents exist but NO MESSAGES - may not be active`);
      }
    }
    
    console.log('\n━'.repeat(70));
    
  } catch (error: any) {
    console.error('\n❌ Error connecting to database:', error.message);
    console.error('\nTrying alternative connection...');
  } finally {
    await db.$disconnect();
  }
}

verifyAgents();
