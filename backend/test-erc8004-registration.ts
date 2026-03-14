/**
 * ERC-8004 Agent Registration Test Script
 * 
 * This script simulates the agent registration process for the Surge Hackathon.
 * Since contracts aren't deployed yet, this demonstrates the flow without actual transactions.
 * 
 * To run with actual deployment:
 * 1. Deploy contracts: cd contracts && forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
 * 2. Update deployments.json with addresses
 * 3. Set ETHEREUM_RPC_URL and ETHEREUM_PRIVATE_KEY in backend/.env
 * 4. Run: npx tsx test-erc8004-registration.ts --real
 */

import { ethers } from 'ethers';

// Test agent data from the leaderboard
const TEST_AGENTS = [
  {
    id: 'cmlv8lizj005rs602lh076ctx',
    name: '🧠 Smart Money',
    displayName: 'Smart Money',
    walletAddress: 'nya666pQkP3PzWxi7JngU3rRMHuc7zbLK8c8wxQ4qpT',
    chain: 'SOLANA',
    archetypeId: 'smart-money',
    level: 5,
    xp: 1250,
    totalTrades: 40023,
    winRate: 29.44,
    totalPnl: 4602.12,
    avatarUrl: 'https://supermolt.xyz/avatars/smart-money.png'
  },
  {
    id: 'cmlv8m8zz0084s602p86fq3e6',
    name: '🚀 Degen Hunter',
    displayName: 'Degen Hunter',
    walletAddress: 'CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o',
    chain: 'SOLANA',
    archetypeId: 'degen-hunter',
    level: 7,
    xp: 2100,
    totalTrades: 18059,
    winRate: 10.61,
    totalPnl: 19097.59,
    avatarUrl: 'https://supermolt.xyz/avatars/degen-hunter.png'
  }
];

// Mock IPFS upload (in real scenario, would use Pinata/IPFS)
function mockUploadToIPFS(data: any): string {
  const dataStr = JSON.stringify(data);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(dataStr)).slice(0, 10);
  return `ipfs://Qm${hash}mock`;
}

// Build ERC-8004 compliant registration JSON
function buildAgentRegistration(agent: typeof TEST_AGENTS[0]) {
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.displayName,
    description: `AI trading agent - ${agent.archetypeId} strategy on ${agent.chain}`,
    image: agent.avatarUrl,
    services: [
      {
        name: 'web',
        endpoint: `https://www.supermolt.xyz/agents/${agent.id}`,
      },
      {
        name: 'api',
        endpoint: `https://sr-mobile-production.up.railway.app/arena/agents/${agent.id}`,
      }
    ],
    supportedTrust: ['reputation', 'validation'],
    metadata: {
      agentId: agent.id,
      archetypeId: agent.archetypeId,
      chain: agent.chain,
      solanaWallet: agent.walletAddress,
      level: agent.level,
      xp: agent.xp,
      totalTrades: agent.totalTrades,
      winRate: agent.winRate.toString(),
      totalPnl: agent.totalPnl.toString(),
    },
  };
}

// Simulate registration
async function simulateRegistration(agent: typeof TEST_AGENTS[0], mode: 'mock' | 'real' = 'mock') {
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`Registering: ${agent.name} (${agent.id})`);
  console.log(`═══════════════════════════════════════════════\n`);

  // Step 1: Build registration JSON
  console.log('Step 1: Building ERC-8004 registration JSON...');
  const registration = buildAgentRegistration(agent);
  console.log(JSON.stringify(registration, null, 2));

  // Step 2: Upload to IPFS
  console.log('\nStep 2: Uploading to IPFS...');
  const ipfsUri = mode === 'mock' 
    ? mockUploadToIPFS(registration)
    : ''; // Would call real IPFS upload
  console.log(`✅ IPFS URI: ${ipfsUri}`);

  if (mode === 'mock') {
    // Simulate on-chain registration
    console.log('\nStep 3: Simulating on-chain registration...');
    const mockOnChainId = Math.floor(Math.random() * 1000) + 1;
    const mockTxHash = ethers.keccak256(ethers.toUtf8Bytes(agent.id + Date.now()));
    
    console.log(`✅ On-chain Agent ID: ${mockOnChainId}`);
    console.log(`✅ Transaction: ${mockTxHash}`);
    console.log(`✅ Etherscan: https://sepolia.etherscan.io/tx/${mockTxHash}`);
    
    return {
      agentId: agent.id,
      onChainId: mockOnChainId,
      ipfsUri,
      txHash: mockTxHash,
      success: true
    };
  } else {
    // Would call real contract registration
    console.log('\nStep 3: Calling AgentIdentityRegistry.register()...');
    console.log('⚠️  Real registration requires deployed contracts and ETH for gas');
    return {
      agentId: agent.id,
      onChainId: null,
      ipfsUri,
      txHash: null,
      success: false,
      error: 'Contracts not deployed'
    };
  }
}

// Main test flow
async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--real') ? 'real' : 'mock';

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  ERC-8004 Agent Registration Test - Surge Hackathon  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log(`Mode: ${mode === 'mock' ? '🎭 SIMULATION' : '🔴 LIVE'}\n`);

  if (mode === 'real') {
    console.log('⚠️  Real mode requires:');
    console.log('   1. Deployed contracts on Sepolia');
    console.log('   2. ETHEREUM_RPC_URL in .env');
    console.log('   3. ETHEREUM_PRIVATE_KEY with Sepolia ETH');
    console.log('   4. PINATA_API_KEY for IPFS uploads\n');
  }

  const results = [];

  // Register first agent
  const result1 = await simulateRegistration(TEST_AGENTS[0], mode);
  results.push(result1);

  // Wait a bit before second registration
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Register second agent
  const result2 = await simulateRegistration(TEST_AGENTS[1], mode);
  results.push(result2);

  // Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                            ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  results.forEach((result, idx) => {
    console.log(`Agent ${idx + 1}: ${TEST_AGENTS[idx].name}`);
    console.log(`  Agent ID: ${result.agentId}`);
    console.log(`  On-chain ID: ${result.onChainId || 'N/A'}`);
    console.log(`  IPFS URI: ${result.ipfsUri}`);
    console.log(`  TX Hash: ${result.txHash || 'N/A'}`);
    console.log(`  Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log('');
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`Total: ${successCount}/${results.length} agents registered successfully\n`);

  // Save results to file
  const timestamp = new Date().toISOString();
  const resultsDoc = {
    timestamp,
    mode,
    network: 'sepolia',
    agents: results,
    contracts: {
      identityRegistry: mode === 'real' ? 'TBD' : 'MOCK',
      reputationRegistry: mode === 'real' ? 'TBD' : 'MOCK',
      validationRegistry: mode === 'real' ? 'TBD' : 'MOCK',
    }
  };

  console.log('Results saved to memory/surge_hackathon/sepolia_test_results.json\n');
  
  return resultsDoc;
}

// Run if called directly
if (require.main === module) {
  main()
    .then(results => {
      const fs = require('fs');
      const path = require('path');
      const outputPath = path.join(__dirname, 'memory/surge_hackathon/sepolia_test_results.json');
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log('✅ Test complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { main, simulateRegistration, buildAgentRegistration };
