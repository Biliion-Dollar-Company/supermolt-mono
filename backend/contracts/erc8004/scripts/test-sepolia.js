const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  console.log(`\n🧪 Testing ERC-8004 Contracts on ${network}\n`);

  // Load deployment addresses
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ No deployment found for ${network}`);
    console.error(`   Run: npm run deploy:${network}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const [signer] = await hre.ethers.getSigners();

  console.log(`Tester address: ${signer.address}`);
  console.log(`Network: ${network}\n`);

  // Connect to contracts
  const identityRegistry = await hre.ethers.getContractAt(
    "AgentIdentityRegistry",
    deployment.contracts.AgentIdentityRegistry
  );

  const reputationRegistry = await hre.ethers.getContractAt(
    "AgentReputationRegistry",
    deployment.contracts.AgentReputationRegistry
  );

  const validationRegistry = await hre.ethers.getContractAt(
    "AgentValidationRegistry",
    deployment.contracts.AgentValidationRegistry
  );

  // Test 1: Register Agent
  console.log("📝 Test 1: Register Agent");
  const agentId = hre.ethers.id("supermolt-agent-test-1");
  const metadataURI = "ipfs://QmTest123456789"; // Mock IPFS hash
  const strategyArchetype = "Momentum Trader";

  try {
    const tx = await identityRegistry.registerAgent(agentId, metadataURI, strategyArchetype);
    console.log(`   Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log(`   ✅ Agent registered successfully\n`);
  } catch (error) {
    if (error.message.includes("Agent already exists")) {
      console.log(`   ⚠️  Agent already registered (expected if re-running)\n`);
    } else {
      throw error;
    }
  }

  // Verify registration
  const agent = await identityRegistry.agents(agentId);
  console.log(`   Agent owner: ${agent.owner}`);
  console.log(`   Metadata URI: ${agent.metadataURI}`);
  console.log(`   Strategy: ${agent.strategyArchetype}`);
  console.log(`   Registered at: ${new Date(Number(agent.registeredAt) * 1000).toISOString()}`);
  console.log(`   Active: ${agent.isActive}\n`);

  // Test 2: Update Performance
  console.log("📊 Test 2: Update Agent Performance");
  try {
    const tx = await reputationRegistry.updatePerformance(
      agentId,
      50,  // totalTrades
      35,  // successfulTrades (70% win rate)
      1500 // pnlBasisPoints (15% profit)
    );
    console.log(`   Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log(`   ✅ Performance updated\n`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
  }

  // Verify performance
  const reputation = await reputationRegistry.reputations(agentId);
  const winRate = await reputationRegistry.getWinRate(agentId);
  console.log(`   Total trades: ${reputation.totalTrades}`);
  console.log(`   Successful trades: ${reputation.successfulTrades}`);
  console.log(`   Win rate: ${(Number(winRate) / 100).toFixed(2)}%`);
  console.log(`   PnL: ${(Number(reputation.pnlBasisPoints) / 100).toFixed(2)}%\n`);

  // Test 3: Submit Feedback
  console.log("💬 Test 3: Submit Community Feedback");
  try {
    const hasReviewed = await reputationRegistry.hasReviewed(agentId, signer.address);
    if (!hasReviewed) {
      const tx = await reputationRegistry.submitFeedback(
        agentId,
        5,
        "Excellent performance! Very consistent returns."
      );
      console.log(`   Transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Feedback submitted\n`);
    } else {
      console.log(`   ⚠️  Already submitted feedback (expected if re-running)\n`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
  }

  // Verify feedback
  const updatedRep = await reputationRegistry.reputations(agentId);
  const avgRating = await reputationRegistry.getAverageRating(agentId);
  console.log(`   Feedback count: ${updatedRep.feedbackCount}`);
  console.log(`   Average rating: ${avgRating}/5 ⭐\n`);

  // Test 4: Submit Strategy Proof
  console.log("🔐 Test 4: Submit Strategy Proof");
  try {
    const proofURI = "ipfs://QmProof789456123"; // Mock IPFS proof
    const strategyHash = hre.ethers.id("if (rsi < 30 && volume > 3x) buy();");
    const sharpeRatio = 234; // 2.34
    const maxDrawdown = 1500; // 15%

    const existingProof = await validationRegistry.proofs(agentId);
    if (existingProof.submittedAt === 0n) {
      const tx = await validationRegistry.submitProof(
        agentId,
        proofURI,
        strategyHash,
        sharpeRatio,
        maxDrawdown
      );
      console.log(`   Transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Strategy proof submitted\n`);
    } else {
      console.log(`   ⚠️  Proof already submitted (expected if re-running)\n`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
  }

  // Verify proof
  const proof = await validationRegistry.proofs(agentId);
  console.log(`   Proof URI: ${proof.proofURI}`);
  console.log(`   Sharpe Ratio: ${(Number(proof.sharpeRatio) / 100).toFixed(2)}`);
  console.log(`   Max Drawdown: ${(Number(proof.maxDrawdown) / 100).toFixed(2)}%`);
  console.log(`   Validator Approvals: ${proof.validatorApprovals}`);
  console.log(`   Validated: ${proof.isValidated}\n`);

  // Test 5: Validator Approval (if owner)
  console.log("✅ Test 5: Validator Approval");
  try {
    const isValidator = await validationRegistry.validators(signer.address);
    if (isValidator) {
      const hasValidated = await validationRegistry.hasValidated(agentId, signer.address);
      if (!hasValidated && !proof.isValidated) {
        const tx = await validationRegistry.validateProof(agentId, true);
        console.log(`   Transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log(`   ✅ Proof validated by validator\n`);

        const updatedProof = await validationRegistry.proofs(agentId);
        console.log(`   Validator Approvals: ${updatedProof.validatorApprovals}/${await validationRegistry.QUORUM()}`);
        console.log(`   Validated: ${updatedProof.isValidated}\n`);
      } else {
        console.log(`   ⚠️  Already validated or quorum reached\n`);
      }
    } else {
      console.log(`   ⚠️  Not a validator (owner is auto-validator)\n`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
  }

  // Final Summary
  console.log("📋 Test Summary:");
  console.log(`   ✅ Agent registered: ${agent.isActive}`);
  console.log(`   ✅ Performance tracked: ${reputation.totalTrades} trades`);
  console.log(`   ✅ Community feedback: ${updatedRep.feedbackCount} reviews`);
  console.log(`   ✅ Strategy proof: ${proof.proofURI !== "" ? "Submitted" : "Not submitted"}`);
  console.log(`\n🎉 All tests completed!\n`);

  // Return test results
  return {
    agentId: agentId,
    contracts: deployment.contracts,
    results: {
      registered: agent.isActive,
      totalTrades: Number(reputation.totalTrades),
      winRate: Number(winRate) / 100,
      avgRating: Number(avgRating),
      proofSubmitted: proof.proofURI !== "",
      validated: proof.isValidated,
    },
  };
}

main()
  .then((results) => {
    console.log("📊 Test Results:");
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
