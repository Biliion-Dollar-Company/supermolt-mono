/**
 * Create Scanner for Epic Reward agent - Direct database insert
 */

import { db } from '../src/lib/db.js';

const AGENT_ID = 'cmlnwnyyd005ks502eqyr38v0';
const WALLET = '615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs';

async function createScanner() {
  try {
    console.log('🔧 Creating Scanner record for Epic Reward...\n');
    
    // Check if agent exists
    const agent = await db.tradingAgent.findUnique({
      where: { id: AGENT_ID }
    });
    
    if (!agent) {
      console.log('❌ Agent not found!');
      process.exit(1);
    }
    
    console.log('✅ Agent found:', agent.name);
    console.log('   Wallet:', agent.userId);
    
    // Check if scanner already exists
    const existing = await db.scanner.findFirst({
      where: { pubkey: WALLET }
    });
    
    if (existing) {
      console.log('\n✅ Scanner already exists!');
      console.log('   ID:', existing.id);
      console.log('   Name:', existing.name);
      process.exit(0);
    }
    
    // Create scanner
    const scanner = await db.scanner.create({
      data: {
        agentId: AGENT_ID,
        name: agent.name,
        pubkey: WALLET,
        privateKey: '',
        strategy: 'general',
        description: 'Auto-created agent scanner',
        active: true
      }
    });
    
    console.log('\n✅ Scanner created successfully!');
    console.log('   ID:', scanner.id);
    console.log('   Name:', scanner.name);
    console.log('   Pubkey:', scanner.pubkey);
    console.log('   Active:', scanner.active);
    console.log('\n🎯 Check leaderboard now:');
    console.log('   https://sr-mobile-production.up.railway.app/api/leaderboard');
    
    await db.$disconnect();
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createScanner();
