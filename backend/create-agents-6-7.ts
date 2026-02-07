#!/usr/bin/env bun
import { PrismaClient } from '@prisma/client';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const db = new PrismaClient();

async function createAgents67() {
  try {
    console.log('\n🚀 Creating Agents #6 and #7...\n');
    console.log('━'.repeat(70));
    
    // Generate new keypairs for agents 6 and 7
    const zetaKeypair = Keypair.generate();
    const thetaKeypair = Keypair.generate();
    
    const NEW_AGENTS = [
      {
        id: 'obs_6a9f8e2c1d5b4a3f',
        userId: zetaKeypair.publicKey.toBase58(),
        name: 'Agent Zeta',
        persona: 'Technical Analyst',
        strategy: 'Charts, indicators, and price action patterns',
        focusAreas: ['support_resistance', 'fibonacci', 'rsi', 'macd', 'chart_patterns'],
        emoji: '📈',
        traits: ['technical', 'chart-focused', 'pattern-recognition'],
        secretKey: bs58.encode(zetaKeypair.secretKey)
      },
      {
        id: 'obs_7b8c9d3e2f6g5h4i',
        userId: thetaKeypair.publicKey.toBase58(),
        name: 'Agent Theta',
        persona: 'Sentiment Tracker',
        strategy: 'Social media, community vibes, and narrative strength',
        focusAreas: ['twitter_sentiment', 'telegram_activity', 'narrative', 'community_strength'],
        emoji: '🧠',
        traits: ['social', 'sentiment-driven', 'community-focused'],
        secretKey: bs58.encode(thetaKeypair.secretKey)
      }
    ];
    
    const created = [];
    
    for (const agentData of NEW_AGENTS) {
      // Check if agent already exists
      const existing = await db.tradingAgent.findUnique({
        where: { id: agentData.id }
      });
      
      if (existing) {
        console.log(`⚠️  ${agentData.emoji} ${agentData.name} already exists`);
        continue;
      }
      
      // Create the agent
      const agent = await db.tradingAgent.create({
        data: {
          id: agentData.id,
          userId: agentData.userId,
          archetypeId: 'observer',
          name: agentData.name,
          status: 'ACTIVE',
          paperBalance: 0,
          config: {
            persona: agentData.persona,
            strategy: agentData.strategy,
            focusAreas: agentData.focusAreas,
            emoji: agentData.emoji,
            traits: agentData.traits,
            role: 'observer',
            observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
            secretKey: agentData.secretKey
          }
        }
      });
      
      console.log(`✅ Created ${agentData.emoji} ${agentData.name}`);
      console.log(`   Wallet: ${agentData.userId}`);
      console.log(`   Persona: ${agentData.persona}`);
      created.push(agent);
    }
    
    // Get all observer agents
    const allObservers = await db.tradingAgent.findMany({
      where: { archetypeId: 'observer' },
      select: {
        id: true,
        name: true,
        status: true,
        config: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('\n━'.repeat(70));
    console.log(`\n✅ SUCCESS! Created ${created.length} new agents`);
    console.log(`\n📊 Total Observer Agents: ${allObservers.length}`);
    console.log('\nAll Observers:');
    allObservers.forEach((agent, idx) => {
      const config = agent.config as any;
      console.log(`  ${idx + 1}. ${config.emoji} ${agent.name} - ${config.persona}`);
    });
    
    console.log('\n━'.repeat(70));
    console.log('\n🎉 System now has 7 observer agents ready to analyze SuperRouter trades!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
  }
}

createAgents67();
