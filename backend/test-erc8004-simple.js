/**
 * ERC-8004 Agent Registration Test Script - Simple Version
 * 
 * This demonstrates the agent registration process for the Surge Hackathon.
 * Since contracts aren't deployed yet, this simulates the flow.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Mock IPFS upload
function mockUploadToIPFS(data) {
  const dataStr = JSON.stringify(data);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(dataStr)).slice(0, 10);
  return `ipfs://Qm${hash}mock`;
}

// Build ERC-8004 compliant registration JSON
function buildAgentRegistration(agent) {
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
async function simulateRegistration(agent) {
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`Registering: ${agent.name} (${agent.id})`);
  console.log(`═══════════════════════════════════════════════\n`);

  // Step 1: Build registration JSON
  console.log('Step 1: Building ERC-8004 registration JSON...');
  const registration = buildAgentRegistration(agent);
  console.log(JSON.stringify(registration, null, 2));

  // Step 2: Upload to IPFS (simulated)
  console.log('\nStep 2: Uploading to IPFS...');
  const ipfsUri = mockUploadToIPFS(registration);
  console.log(`✅ IPFS URI: ${ipfsUri}`);

  // Step 3: Simulate on-chain registration
  console.log('\nStep 3: Simulating on-chain registration...');
  const mockOnChainId = Math.floor(Math.random() * 1000) + 1;
  const mockTxHash = ethers.keccak256(ethers.toUtf8Bytes(agent.id + Date.now()));
  
  console.log(`✅ On-chain Agent ID: ${mockOnChainId}`);
  console.log(`✅ Transaction: ${mockTxHash}`);
  console.log(`✅ Etherscan: https://sepolia.etherscan.io/tx/${mockTxHash}`);
  
  return {
    agentId: agent.id,
    agentName: agent.name,
    onChainId: mockOnChainId,
    ipfsUri,
    txHash: mockTxHash,
    etherscanUrl: `https://sepolia.etherscan.io/tx/${mockTxHash}`,
    registrationData: registration,
    success: true
  };
}

// Main test flow
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  ERC-8004 Agent Registration Test - Surge Hackathon  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log('Mode: 🎭 SIMULATION (contracts not deployed yet)\n');

  const results = [];

  // Register first agent
  const result1 = await simulateRegistration(TEST_AGENTS[0]);
  results.push(result1);

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));

  // Register second agent
  const result2 = await simulateRegistration(TEST_AGENTS[1]);
  results.push(result2);

  // Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                            ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  results.forEach((result, idx) => {
    console.log(`Agent ${idx + 1}: ${result.agentName}`);
    console.log(`  Agent ID: ${result.agentId}`);
    console.log(`  On-chain ID: ${result.onChainId}`);
    console.log(`  IPFS URI: ${result.ipfsUri}`);
    console.log(`  TX Hash: ${result.txHash}`);
    console.log(`  Etherscan: ${result.etherscanUrl}`);
    console.log(`  Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log('');
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Total: ${successCount}/${results.length} agents registered successfully\n`);

  // Save results to file
  const timestamp = new Date().toISOString();
  const resultsDoc = {
    testDate: timestamp,
    mode: 'simulation',
    network: 'sepolia',
    status: 'contracts_not_deployed',
    note: 'This is a simulated test. To run on actual Sepolia testnet, contracts must be deployed first.',
    agents: results,
    contracts: {
      identityRegistry: 'NOT_DEPLOYED',
      reputationRegistry: 'NOT_DEPLOYED',
      validationRegistry: 'NOT_DEPLOYED',
    },
    nextSteps: [
      '1. Deploy contracts to Sepolia: cd ../contracts && forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast',
      '2. Update ../contracts/deployments.json with deployed addresses',
      '3. Set ETHEREUM_RPC_URL and ETHEREUM_PRIVATE_KEY in .env',
      '4. Re-run this script with actual contract calls'
    ]
  };

  // Save to web/memory directory
  const outputPath = path.join(__dirname, '../web/memory/surge_hackathon/sepolia_test_results.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(resultsDoc, null, 2));
  
  console.log('Results saved to: web/memory/surge_hackathon/sepolia_test_results.json\n');
  
  return resultsDoc;
}

// Run
main()
  .then(() => {
    console.log('✅ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
