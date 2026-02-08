/**
 * Create Observer Agents Remotely
 * Run with: railway run bun run create-observers-remote.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createObservers() {
  console.log('🚀 Creating 5 Observer Agents...\n');

  try {
    // Create all 5 agents
    const agents = await prisma.$transaction([
      // 🛡️ Agent Alpha
      prisma.tradingAgent.create({
        data: {
          id: 'obs_2d699d1509105cd0',
          userId: '2wXYgPnrG4k5EPrBD2SXAtWRuzgiEJP5hGJrkng1o8QU',
          archetypeId: 'observer',
          name: 'Agent Alpha',
          status: 'ACTIVE',
          config: {
            persona: 'Conservative Value Investor',
            strategy: 'Risk-averse, focuses on fundamentals and liquidity',
            focusAreas: ['holder_concentration', 'liquidity_depth', 'smart_money', 'risk_metrics'],
            emoji: '🛡️',
            traits: ['cautious', 'analytical', 'risk-focused'],
            role: 'observer',
            observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
            secretKey: '5t6MbHLuJ1WT9PvhvKUsURGFZDSqgTNRcB8ezD6cRvfuVFqg2S4TaLKo6bw11SD3QhGRPGeMU4JdChsMrq4ASryr'
          }
        }
      }),
      
      // 🚀 Agent Beta
      prisma.tradingAgent.create({
        data: {
          id: 'obs_d5e20717b2f7a46d',
          userId: 'FJJ2fhgGpykpSYQ3gmQVeqc3ed43bNxiLyzRtneXLhU',
          archetypeId: 'observer',
          name: 'Agent Beta',
          status: 'ACTIVE',
          config: {
            persona: 'Momentum Trader',
            strategy: 'Aggressive, loves volatility and quick flips',
            focusAreas: ['price_momentum', 'volume_spikes', 'social_sentiment', 'trend_following'],
            emoji: '🚀',
            traits: ['aggressive', 'hype-driven', 'fast-moving'],
            role: 'observer',
            observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
            secretKey: '4QL8TuEvUWpoGqw9UihyVk2jUD6QFZrjkK3Nwq7XJVmrgJQVNR1BKfeSQJ7xC7TWwupUak3pYv2TpYmoQaLe3RK4'
          }
        }
      }),
      
      // 📊 Agent Gamma
      prisma.tradingAgent.create({
        data: {
          id: 'obs_f235dbdc98f3a578',
          userId: '8g1DmwCVhMEbQk4ugvCTdfjjf4fCXddYdkAiS66PSmrH',
          archetypeId: 'observer',
          name: 'Agent Gamma',
          status: 'ACTIVE',
          config: {
            persona: 'Data Scientist',
            strategy: 'Pure numbers, statistical analysis and patterns',
            focusAreas: ['historical_patterns', 'correlation', 'volatility', 'probability'],
            emoji: '📊',
            traits: ['analytical', 'data-driven', 'mathematical'],
            role: 'observer',
            observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
            secretKey: '5M2wiEz9fvUBwgh9YXyVWVFNYCQSM6ew9VSJcBcd926m8UvaLJt5W2Wpf3uVrWbFhFkyjzFDtWtWCg1r9URz6fJy'
          }
        }
      }),
      
      // 🔍 Agent Delta
      prisma.tradingAgent.create({
        data: {
          id: 'obs_b66d4c1a7ee58537',
          userId: 'DehG5EPJSgFFeEV6hgBvvDx6JG68sdvTm4tKa9dMLJzC',
          archetypeId: 'observer',
          name: 'Agent Delta',
          status: 'ACTIVE',
          config: {
            persona: 'Contrarian',
            strategy: "Devil's advocate, questions hype, finds red flags",
            focusAreas: ['contract_analysis', 'team_verification', 'scam_detection', 'fud'],
            emoji: '🔍',
            traits: ['skeptical', 'cautious', 'critical'],
            role: 'observer',
            observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
            secretKey: 'H1yQF7obdgPRWogbTqyH7aKzo2A8QRjpkQyTQa45XDQeLhatvw39DgWRKLmHdEp53sCsvgqJf8HXDyTpeGbKBvQ'
          }
        }
      }),
      
      // 🐋 Agent Epsilon
      prisma.tradingAgent.create({
        data: {
          id: 'obs_b84563ff6101876e',
          userId: 'FfYEDWyQa5vKwsdd9x5GyqMS5ZBUPRd6Zyb1HL4ZruG9',
          archetypeId: 'observer',
          name: 'Agent Epsilon',
          status: 'ACTIVE',
          config: {
            persona: 'Whale Watcher',
            strategy: 'Follows smart money and large wallet movements',
            focusAreas: ['whale_movements', 'smart_wallets', 'connected_wallets', 'insider_activity'],
            emoji: '🐋',
            traits: ['social', 'network-focused', 'copycat'],
            role: 'observer',
            observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
            secretKey: '49wVoH3T5fru1eNs65MZRMNbS6Vvo9iApfM4DSQEnMhL8u767fqbgawYCUfwQSWR9ZCbBW3prjosfpDNv1WV4iVK'
          }
        }
      })
    ]);

    console.log('✅ Successfully created 5 observer agents:\n');
    agents.forEach((agent, i) => {
      const config = agent.config as any;
      console.log(`${i + 1}. ${config.emoji} ${agent.name}`);
      console.log(`   Persona: ${config.persona}`);
      console.log(`   Strategy: ${config.strategy}`);
      console.log(`   ID: ${agent.id}\n`);
    });

    console.log('🎉 All done! Observer agents are ready.\n');
    console.log('They will now automatically analyze SuperRouter trades.');
    
  } catch (error) {
    console.error('❌ Error creating observers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createObservers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
