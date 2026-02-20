/**
 * Example Usage of ERC-8004 Contract Client
 * This demonstrates how to integrate the smart contracts with SuperMolt backend
 */

import { createERC8004Client, ValidationResponseType } from './index';

async function exampleUsage() {
  // Initialize the client
  const client = createERC8004Client(
    process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY',
    'sepolia',
    process.env.PRIVATE_KEY
  );

  console.log('🚀 ERC-8004 Client initialized\n');

  // ========== 1. Register Liquidity Sniper Agent ==========
  console.log('📝 Registering Liquidity Sniper agent...');
  const agentURI = 'ipfs://QmLiquiditySniperMetadata'; // Upload metadata to IPFS first
  const agentId = await client.registerAgent(agentURI);
  console.log(`✅ Agent registered with ID: ${agentId}\n`);

  // ========== 2. Set Agent Metadata ==========
  console.log('🔧 Setting agent metadata...');
  await client.setAgentMetadata(agentId, 'name', 'Liquidity Sniper');
  await client.setAgentMetadata(agentId, 'category', 'Trading Bot');
  await client.setAgentMetadata(agentId, 'version', '1.0.0');
  await client.setAgentMetadata(agentId, 'network', 'Solana');
  console.log('✅ Metadata set\n');

  // ========== 3. Set Agent Wallet (with EIP-712 signature) ==========
  console.log('🔑 Setting agent wallet...');
  const newWalletAddress = '0x1234567890123456789012345678901234567890';
  const nonce = 0; // First wallet change
  
  // Sign the wallet change with EIP-712
  const signature = await client.signWalletChange(agentId, newWalletAddress, nonce);
  
  await client.setAgentWallet(agentId, newWalletAddress, signature);
  console.log(`✅ Agent wallet set to: ${newWalletAddress}\n`);

  // ========== 4. Give Feedback ==========
  console.log('⭐ Submitting feedback...');
  const feedbackIndex = await client.giveFeedback(
    agentId,
    92, // 92% success rate or 9.2/10 rating (decimals: 1)
    1,  // 1 decimal place
    'trading',
    'accuracy',
    'ipfs://QmFeedbackDetails'
  );
  console.log(`✅ Feedback submitted with index: ${feedbackIndex}\n`);

  // ========== 5. Get Reputation Summary ==========
  console.log('📊 Fetching reputation summary...');
  const clients = ['0xClient1Address', '0xClient2Address'];
  const summary = await client.getReputationSummary(agentId, clients);
  console.log(`Total feedback count: ${summary.count}`);
  console.log(`Average rating: ${summary.averageValue} (scaled to 18 decimals)\n`);

  // ========== 6. Request Validation ==========
  console.log('🔍 Requesting validation...');
  const validatorAddress = '0xValidatorAddress';
  const requestURI = 'ipfs://QmValidationRequest';
  const requestNonce = Date.now(); // Use timestamp as nonce
  
  const requestHash = await client.createValidationRequest(
    validatorAddress,
    agentId,
    requestURI,
    requestNonce
  );
  console.log(`✅ Validation request created: ${requestHash}\n`);

  // ========== 7. Validator Responds (from validator's perspective) ==========
  console.log('✅ Validator responding...');
  // Note: In practice, this would be called by the validator, not the agent owner
  await client.respondToValidation(
    requestHash,
    ValidationResponseType.Approved,
    'ipfs://QmValidationResponse'
  );
  console.log('✅ Validation approved\n');

  // ========== 8. Get Validation Stats ==========
  console.log('📈 Fetching validation stats...');
  const validators = [validatorAddress];
  const stats = await client.getValidationStats(agentId, validators);
  console.log(`Approved: ${stats.approvedCount}`);
  console.log(`Rejected: ${stats.rejectedCount}`);
  console.log(`Pending: ${stats.pendingCount}`);
  console.log(`Needs Info: ${stats.needsInfoCount}\n`);

  // ========== 9. Get Feedback by Tag ==========
  console.log('🏷️  Getting feedback by tag...');
  const tradingFeedback = await client.getFeedbackByTag(agentId, clients, 'trading');
  console.log(`Found ${tradingFeedback.length} feedback entries tagged "trading"\n`);

  console.log('🎉 All operations completed successfully!');
}

// Example: Register all 19 SuperMolt agents
async function registerAllAgents() {
  const client = createERC8004Client(
    process.env.SEPOLIA_RPC_URL!,
    'sepolia',
    process.env.PRIVATE_KEY
  );

  const agents = [
    { name: 'Liquidity Sniper', category: 'Trading', network: 'Solana' },
    { name: 'Arbitrage Bot', category: 'Trading', network: 'Solana' },
    { name: 'Market Maker', category: 'Liquidity', network: 'Solana' },
    { name: 'Trend Analyzer', category: 'Analysis', network: 'Solana' },
    { name: 'Volume Detector', category: 'Analysis', network: 'Solana' },
    { name: 'Whale Tracker', category: 'Monitoring', network: 'Solana' },
    { name: 'Flash Loan Hunter', category: 'DeFi', network: 'Solana' },
    { name: 'MEV Bot', category: 'Trading', network: 'Solana' },
    { name: 'Grid Trader', category: 'Trading', network: 'Solana' },
    { name: 'Sentiment Analyzer', category: 'Analysis', network: 'Solana' },
    // Add remaining 9 agents...
  ];

  console.log(`🚀 Registering ${agents.length} agents...\n`);

  for (const agent of agents) {
    const agentURI = `ipfs://Qm${agent.name.replace(/\s+/g, '')}Metadata`;
    const agentId = await client.registerAgent(agentURI);
    
    await client.setAgentMetadata(agentId, 'name', agent.name);
    await client.setAgentMetadata(agentId, 'category', agent.category);
    await client.setAgentMetadata(agentId, 'network', agent.network);
    
    console.log(`✅ ${agent.name} registered with ID: ${agentId}`);
  }

  console.log('\n🎉 All agents registered successfully!');
}

// Example: Monitor agent reputation
async function monitorAgentReputation(agentId: number) {
  const client = createERC8004Client(
    process.env.SEPOLIA_RPC_URL!,
    'sepolia'
  );

  console.log(`📊 Monitoring reputation for Agent #${agentId}...\n`);

  // Get all client addresses (in practice, fetch from your database)
  const clients = await getActiveClients(); // Your implementation

  const summary = await client.getReputationSummary(agentId, clients);
  
  console.log(`Total Feedback: ${summary.count}`);
  console.log(`Average Rating: ${formatRating(summary.averageValue)}`);

  // Get breakdown by category
  const tradingFeedback = await client.getFeedbackByTag(agentId, clients, 'trading');
  const accuracyFeedback = await client.getFeedbackByTag(agentId, clients, 'accuracy');
  
  console.log(`\nBreakdown:`);
  console.log(`- Trading: ${tradingFeedback.length} reviews`);
  console.log(`- Accuracy: ${accuracyFeedback.length} reviews`);
}

// Helper functions
function formatRating(value: bigint): string {
  // Convert from 18 decimals to human-readable format
  const rating = Number(value) / 1e18;
  return rating.toFixed(2);
}

async function getActiveClients(): Promise<string[]> {
  // In practice, fetch from your database
  return [
    '0xClient1Address',
    '0xClient2Address',
    '0xClient3Address'
  ];
}

// Export examples
export {
  exampleUsage,
  registerAllAgents,
  monitorAgentReputation
};

// Run example if executed directly
if (require.main === module) {
  exampleUsage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
