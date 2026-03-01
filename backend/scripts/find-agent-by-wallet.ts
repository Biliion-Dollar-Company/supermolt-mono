import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAgent() {
  const wallet = '31ySFhvatv8T5PeKLeAzngVYWY1ngucUDmL9BVvUaFta';
  
  // Try userId (pubkey) field
  const agent = await prisma.tradingAgent.findFirst({
    where: { userId: wallet }
  });
  
  if (agent) {
    console.log('✅ Found agent:');
    console.log(JSON.stringify({
      agentId: agent.id,
      name: agent.name,
      userId: agent.userId,
      status: agent.status,
      totalTrades: agent.totalTrades
    }, null, 2));
    
    console.log('\n🔑 To enable auto-buy, set this in Railway:');
    console.log(`AGENT_PRIVATE_KEY_${agent.id.toUpperCase()}=<base58_private_key>`);
    
    // Check Scanner record
    const scanner = await prisma.scanner.findFirst({
      where: { agentId: agent.id }
    });
    
    if (scanner) {
      console.log('\n✅ Scanner record exists');
    } else {
      console.log('\n⚠️  Scanner record MISSING - agent cannot submit calls');
    }
  } else {
    console.log('❌ No agent found with wallet:', wallet);
  }
  
  await prisma.$disconnect();
}

findAgent().catch(console.error);
