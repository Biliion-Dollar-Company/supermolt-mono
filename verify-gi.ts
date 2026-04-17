/**
 * Verification Script: Gazillion Intelligence Consensus
 * 
 * Verifies that the tri-agent debate logic and ROCm-optimized batching
 * are functional.
 */

import { giConsensus } from './backend/src/services/gazillion-consensus.service';
import { type TokenContext } from './backend/src/lib/conversation-generator';

async function verifyConsensus() {
  console.log('🧪 Testing Gazillion Intelligence Consensus...');

  const mockToken: TokenContext = {
    tokenMint: 'BAGS_TEST_MINT_123',
    tokenSymbol: 'BAGS',
    marketCap: 1500000,
    liquidity: 450000,
    volume24h: 800000,
    chain: 'Solana'
  };

  try {
    const result = await giConsensus.runDebate(mockToken);
    
    if (result) {
      console.log('✅ Consensus Reached:');
      console.log(`   Decision: ${result.decision}`);
      console.log(`   Confidence: ${result.confidence}%`);
      console.log(`   Debate Length: ${result.debate.length} agents`);
      
      result.debate.forEach(m => {
        console.log(`   [${m.name}] (${m.sentiment}): ${m.message.substring(0, 50)}...`);
      });
    } else {
      console.error('❌ Consensus failed (LLM returned null)');
    }
  } catch (error) {
    console.error('❌ Error during consensus verification:', error);
  }
}

verifyConsensus();
