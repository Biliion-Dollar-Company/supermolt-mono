import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function main() {
  // Get latest conversation
  const conversation = await prisma.agentConversation.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          agent: {
            select: {
              agentId: true,
              publicKey: true,
              config: true
            }
          }
        }
      }
    }
  });

  if (!conversation) {
    console.log('No conversations found');
    return;
  }

  console.log('\n📊 LATEST CONVERSATION\n');
  console.log(`Conversation ID: ${conversation.id}`);
  console.log(`Topic: ${conversation.topic}`);
  console.log(`Token: ${conversation.tokenMint || 'N/A'}`);
  console.log(`Created: ${conversation.createdAt.toISOString()}`);
  console.log(`Messages: ${conversation.messages.length}`);
  
  console.log('\n💬 AGENT MESSAGES:\n');
  
  conversation.messages.forEach((msg, i) => {
    const agentName = (msg.agent.config as any)?.name || 'Unknown';
    const emoji = msg.text.substring(0, 2); // Get emoji
    const text = msg.text.substring(2).trim(); // Get text without emoji
    
    console.log(`${i + 1}. ${emoji} ${agentName}`);
    console.log(`   ${text}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

main();
