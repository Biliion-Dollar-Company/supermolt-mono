/**
 * Create 5 Observer Agents
 * These agents watch SuperRouter and analyze his trades
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const db = new PrismaClient();

const OBSERVER_AGENTS = [
  {
    name: 'Agent Alpha',
    persona: 'Conservative Value Investor',
    strategy: 'Risk-averse, focuses on fundamentals and liquidity',
    focusAreas: ['holder_concentration', 'liquidity_depth', 'smart_money', 'risk_metrics'],
    emoji: '🛡️',
    traits: ['cautious', 'analytical', 'risk-focused'],
  },
  {
    name: 'Agent Beta',
    persona: 'Momentum Trader',
    strategy: 'Aggressive, loves volatility and quick flips',
    focusAreas: ['price_momentum', 'volume_spikes', 'social_sentiment', 'trend_following'],
    emoji: '🚀',
    traits: ['aggressive', 'hype-driven', 'fast-moving'],
  },
  {
    name: 'Agent Gamma',
    persona: 'Data Scientist',
    strategy: 'Pure numbers, statistical analysis and patterns',
    focusAreas: ['historical_patterns', 'correlation', 'volatility', 'probability'],
    emoji: '📊',
    traits: ['analytical', 'data-driven', 'mathematical'],
  },
  {
    name: 'Agent Delta',
    persona: 'Contrarian',
    strategy: 'Devil\'s advocate, questions hype, finds red flags',
    focusAreas: ['contract_analysis', 'team_verification', 'scam_detection', 'fud'],
    emoji: '🔍',
    traits: ['skeptical', 'cautious', 'critical'],
  },
  {
    name: 'Agent Epsilon',
    persona: 'Whale Watcher',
    strategy: 'Follows smart money and large wallet movements',
    focusAreas: ['whale_movements', 'smart_wallets', 'connected_wallets', 'insider_activity'],
    emoji: '🐋',
    traits: ['social', 'network-focused', 'copycat'],
  },
];

async function createObserverAgents() {
  console.log('🚀 Creating 5 Observer Agents for SuperRouter Analysis\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const createdAgents = [];

  for (const agentData of OBSERVER_AGENTS) {
    console.log(`Creating: ${agentData.emoji} ${agentData.name}`);
    console.log(`  Persona: ${agentData.persona}`);
    console.log(`  Strategy: ${agentData.strategy}`);

    // Generate a keypair for this agent
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = bs58.encode(keypair.secretKey);

    console.log(`  Wallet: ${publicKey}`);

    // Check if agent already exists
    let agent = await db.tradingAgent.findFirst({
      where: { name: agentData.name },
    });

    if (agent) {
      console.log(`  ⚠️  Already exists (ID: ${agent.id})`);
      createdAgents.push(agent);
      console.log('');
      continue;
    }

    // Create agent in database
    agent = await db.tradingAgent.create({
      data: {
        userId: publicKey, // Use generated wallet
        archetypeId: 'observer', // Special archetype for observers
        name: agentData.name,
        status: 'ACTIVE', // Ready to analyze
        paperBalance: new Prisma.Decimal(0), // Observers don't trade
        config: {
          persona: agentData.persona,
          strategy: agentData.strategy,
          focusAreas: agentData.focusAreas,
          emoji: agentData.emoji,
          traits: agentData.traits,
          role: 'observer',
          observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn', // SuperRouter
          secretKey: secretKey, // Store for future use if needed
        },
      },
    });

    console.log(`  ✅ Created (ID: ${agent.id})`);
    createdAgents.push(agent);
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ ${createdAgents.length} Observer Agents Ready\n`);

  console.log('Agent Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const agent of createdAgents) {
    const config = agent.config as any;
    console.log(`${config.emoji} ${agent.name}`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Wallet: ${agent.userId}`);
    console.log(`   Status: ${agent.status}`);
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 Next Steps:');
  console.log('   1. Build analysis engine');
  console.log('   2. Connect to DevPrint API');
  console.log('   3. Wait for SuperRouter trade');
  console.log('   4. Agents analyze and comment\n');

  return createdAgents;
}

// Run
createObserverAgents()
  .catch(console.error)
  .finally(() => db.$disconnect());
