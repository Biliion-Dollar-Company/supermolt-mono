const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Test script for EXISTING deployed contracts
 * Uses the contracts deployed on Feb 22 at:
 * - Identity: 0x34aDD8176a4EC7D1D022a56a0D4e7b153708B56a
 * - Reputation: 0xA8B9e9d942CD8aeA75B418dD9FDcEaC41B3689FF
 * - Validation: 0xb752fda472A5b76FE48d194809Af062a2271D52c
 */

async function main() {
  console.log("\n🧪 Testing ERC-8004 Contracts (Existing Deployment)\n");

  const [signer] = await hre.ethers.getSigners();
  console.log(`Tester address: ${signer.address}`);

  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("\n❌ No ETH balance!");
    console.log("   Get Sepolia ETH from: https://sepolia-faucet.pk910.de");
    console.log(`   Address: ${signer.address}\n`);
    process.exit(1);
  }

  console.log(`Network: ${hre.network.name}\n`);

  // Use existing deployed contract addresses
  const CONTRACTS = {
    Identity: "0x34aDD8176a4EC7D1D022a56a0D4e7b153708B56a",
    Reputation: "0xA8B9e9d942CD8aeA75B418dD9FDcEaC41B3689FF",
    Validation: "0xb752fda472A5b76FE48d194809Af062a2271D52c",
  };

  console.log("📋 Using deployed contracts:");
  console.log(`   Identity: ${CONTRACTS.Identity}`);
  console.log(`   Reputation: ${CONTRACTS.Reputation}`);
  console.log(`   Validation: ${CONTRACTS.Validation}\n`);

  // Connect to contracts
  const identityRegistry = await hre.ethers.getContractAt(
    "AgentIdentityRegistry",
    CONTRACTS.Identity
  );

  const reputationRegistry = await hre.ethers.getContractAt(
    "AgentReputationRegistry",
    CONTRACTS.Reputation
  );

  const validationRegistry = await hre.ethers.getContractAt(
    "AgentValidationRegistry",
    CONTRACTS.Validation
  );

  // Generate unique agent ID for this test
  const timestamp = Date.now();
  const agentName = `supermolt-agent-${timestamp}`;
  const agentId = hre.ethers.id(agentName);

  console.log(`🤖 Testing with agent: ${agentName}`);
  console.log(`   Agent ID: ${agentId}\n`);

  const testResults = {
    agentId: agentId,
    agentName: agentName,
    testerAddress: signer.address,
    contracts: CONTRACTS,
    tests: {},
    transactions: [],
  };

  // ========== TEST 1: Register Agent ==========
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📝 TEST 1: Register Agent Identity");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const metadataURI = `ipfs://Qm${agentName.slice(0, 44)}`;
  const strategyArchetype = "Momentum Trader";

  try {
    console.log(`   Metadata URI: ${metadataURI}`);
    console.log(`   Strategy: ${strategyArchetype}`);

    const tx = await identityRegistry.registerAgent(agentId, metadataURI, strategyArchetype);
    console.log(`   📤 Transaction: ${tx.hash}`);
    console.log(`   ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}\n`);

    testResults.transactions.push({ test: "registerAgent", hash: tx.hash, block: receipt.blockNumber });
    testResults.tests.registerAgent = { success: true, txHash: tx.hash };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    testResults.tests.registerAgent = { success: false, error: error.message };
  }

  // Verify registration
  console.log("   🔍 Verifying registration...");
  const agent = await identityRegistry.agents(agentId);
  console.log(`   Owner: ${agent.owner}`);
  console.log(`   Metadata: ${agent.metadataURI}`);
  console.log(`   Strategy: ${agent.strategyArchetype}`);
  console.log(`   Registered: ${new Date(Number(agent.registeredAt) * 1000).toISOString()}`);
  console.log(`   Active: ${agent.isActive}\n`);

  // ========== TEST 2: Update Performance ==========
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 TEST 2: Update Agent Performance");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const performanceData = {
    totalTrades: 42,
    successfulTrades: 30, // 71.4% win rate
    pnlBasisPoints: 1850, // 18.5% profit
  };

  try {
    console.log(`   Total trades: ${performanceData.totalTrades}`);
    console.log(`   Successful: ${performanceData.successfulTrades} (${((performanceData.successfulTrades / performanceData.totalTrades) * 100).toFixed(1)}%)`);
    console.log(`   PnL: ${(performanceData.pnlBasisPoints / 100).toFixed(2)}%`);

    const tx = await reputationRegistry.updatePerformance(
      agentId,
      performanceData.totalTrades,
      performanceData.successfulTrades,
      performanceData.pnlBasisPoints
    );
    console.log(`   📤 Transaction: ${tx.hash}`);
    console.log(`   ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}\n`);

    testResults.transactions.push({ test: "updatePerformance", hash: tx.hash, block: receipt.blockNumber });
    testResults.tests.updatePerformance = { success: true, txHash: tx.hash };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    testResults.tests.updatePerformance = { success: false, error: error.message };
  }

  // Verify performance
  console.log("   🔍 Verifying performance data...");
  const reputation = await reputationRegistry.reputations(agentId);
  const winRate = await reputationRegistry.getWinRate(agentId);
  console.log(`   Total trades: ${reputation.totalTrades}`);
  console.log(`   Win rate: ${(Number(winRate) / 100).toFixed(2)}%`);
  console.log(`   PnL: ${(Number(reputation.pnlBasisPoints) / 100).toFixed(2)}%\n`);

  // ========== TEST 3: Submit Feedback ==========
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💬 TEST 3: Submit Community Feedback");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const feedback = {
    rating: 5,
    comment: "Excellent momentum strategy! Consistent returns with good risk management.",
  };

  try {
    console.log(`   Rating: ${feedback.rating}/5 ⭐`);
    console.log(`   Comment: "${feedback.comment}"`);

    const tx = await reputationRegistry.submitFeedback(
      agentId,
      feedback.rating,
      feedback.comment
    );
    console.log(`   📤 Transaction: ${tx.hash}`);
    console.log(`   ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}\n`);

    testResults.transactions.push({ test: "submitFeedback", hash: tx.hash, block: receipt.blockNumber });
    testResults.tests.submitFeedback = { success: true, txHash: tx.hash };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    testResults.tests.submitFeedback = { success: false, error: error.message };
  }

  // Verify feedback
  console.log("   🔍 Verifying feedback...");
  const updatedRep = await reputationRegistry.reputations(agentId);
  const avgRating = await reputationRegistry.getAverageRating(agentId);
  console.log(`   Feedback count: ${updatedRep.feedbackCount}`);
  console.log(`   Average rating: ${avgRating}/5 ⭐\n`);

  // ========== TEST 4: Submit Strategy Proof ==========
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔐 TEST 4: Submit Strategy Proof");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const proofData = {
    proofURI: `ipfs://QmProof${agentName.slice(0, 38)}`,
    strategyHash: hre.ethers.id("if (rsi < 30 && volume > 3x_avg) { buy(); }"),
    sharpeRatio: 245, // 2.45
    maxDrawdown: 1200, // 12%
  };

  try {
    console.log(`   Proof URI: ${proofData.proofURI}`);
    console.log(`   Sharpe Ratio: ${(proofData.sharpeRatio / 100).toFixed(2)}`);
    console.log(`   Max Drawdown: ${(proofData.maxDrawdown / 100).toFixed(2)}%`);

    const tx = await validationRegistry.submitProof(
      agentId,
      proofData.proofURI,
      proofData.strategyHash,
      proofData.sharpeRatio,
      proofData.maxDrawdown
    );
    console.log(`   📤 Transaction: ${tx.hash}`);
    console.log(`   ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}\n`);

    testResults.transactions.push({ test: "submitProof", hash: tx.hash, block: receipt.blockNumber });
    testResults.tests.submitProof = { success: true, txHash: tx.hash };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    testResults.tests.submitProof = { success: false, error: error.message };
  }

  // Verify proof
  console.log("   🔍 Verifying proof submission...");
  const proof = await validationRegistry.proofs(agentId);
  console.log(`   Proof URI: ${proof.proofURI}`);
  console.log(`   Sharpe Ratio: ${(Number(proof.sharpeRatio) / 100).toFixed(2)}`);
  console.log(`   Max Drawdown: ${(Number(proof.maxDrawdown) / 100).toFixed(2)}%`);
  console.log(`   Approvals: ${proof.validatorApprovals}/${await validationRegistry.QUORUM()}`);
  console.log(`   Validated: ${proof.isValidated ? "✅ Yes" : "⏳ Pending"}\n`);

  // ========== FINAL SUMMARY ==========
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 TEST SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const successCount = Object.values(testResults.tests).filter((t) => t.success).length;
  const totalTests = Object.keys(testResults.tests).length;

  console.log(`✅ Passed: ${successCount}/${totalTests} tests\n`);

  console.log("Test Results:");
  for (const [testName, result] of Object.entries(testResults.tests)) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`   ${status} ${testName}`);
    if (result.txHash) {
      console.log(`      → https://sepolia.etherscan.io/tx/${result.txHash}`);
    }
  }

  console.log("\nAgent Profile:");
  console.log(`   Name: ${agentName}`);
  console.log(`   Owner: ${agent.owner}`);
  console.log(`   Win Rate: ${(Number(winRate) / 100).toFixed(2)}%`);
  console.log(`   PnL: ${(Number(reputation.pnlBasisPoints) / 100).toFixed(2)}%`);
  console.log(`   Rating: ${avgRating}/5 ⭐`);
  console.log(`   Proof: ${proof.isValidated ? "✅ Validated" : "⏳ Pending"}`);

  console.log(`\n🎉 Testing complete!\n`);

  // Save results
  const resultsPath = path.join(__dirname, "..", "test-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`💾 Results saved to: ${resultsPath}\n`);

  return testResults;
}

main()
  .then((results) => {
    const successCount = Object.values(results.tests).filter((t) => t.success).length;
    const totalTests = Object.keys(results.tests).length;
    process.exit(successCount === totalTests ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
