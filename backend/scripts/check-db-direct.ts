#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function check() {
  try {
    console.log('🔍 Checking database...\n');
    
    const agents = await db.tradingAgent.count();
    console.log('Total agents:', agents);
    
    const observers = await db.tradingAgent.findMany({
      where: { role: 'observer' },
      select: { agentId: true, displayName: true }
    });
    
    console.log('\nObservers:', observers.length);
    observers.forEach(o => console.log('  -', o.displayName, '(' + o.agentId + ')'));
    
    const messages = await db.agentMessage.count();
    console.log('\nMessages:', messages);
    
    const convs = await db.agentConversation.count();
    console.log('Conversations:', convs);
    
    if (messages > 0) {
      const recent = await db.agentMessage.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: { agent: true }
      });
      console.log('\nLast 3 messages:');
      recent.forEach(m => {
        console.log('  [' + new Date(m.createdAt).toLocaleTimeString() + ']', m.agent.displayName);
        console.log('   ', m.content.substring(0, 60) + '...');
      });
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await db.$disconnect();
  }
}

check();
