const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  console.log(`\n🚀 Deploying ERC-8004 Contracts to ${network}\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Deploy AgentIdentityRegistry
  console.log("📝 Deploying AgentIdentityRegistry...");
  const AgentIdentityRegistry = await hre.ethers.getContractFactory("AgentIdentityRegistry");
  const identityRegistry = await AgentIdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log(`✅ AgentIdentityRegistry deployed to: ${identityAddress}\n`);

  // Deploy AgentReputationRegistry
  console.log("📊 Deploying AgentReputationRegistry...");
  const AgentReputationRegistry = await hre.ethers.getContractFactory("AgentReputationRegistry");
  const reputationRegistry = await AgentReputationRegistry.deploy();
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log(`✅ AgentReputationRegistry deployed to: ${reputationAddress}\n`);

  // Deploy AgentValidationRegistry
  console.log("🔐 Deploying AgentValidationRegistry...");
  const AgentValidationRegistry = await hre.ethers.getContractFactory("AgentValidationRegistry");
  const validationRegistry = await AgentValidationRegistry.deploy();
  await validationRegistry.waitForDeployment();
  const validationAddress = await validationRegistry.getAddress();
  console.log(`✅ AgentValidationRegistry deployed to: ${validationAddress}\n`);

  // Save deployment info
  const deployment = {
    network: network,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AgentIdentityRegistry: identityAddress,
      AgentReputationRegistry: reputationAddress,
      AgentValidationRegistry: validationAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentPath = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log("📋 Deployment Summary:");
  console.log(`   Network: ${network} (chainId: ${hre.network.config.chainId})`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Identity: ${identityAddress}`);
  console.log(`   Reputation: ${reputationAddress}`);
  console.log(`   Validation: ${validationAddress}`);
  console.log(`\n💾 Saved to: ${deploymentPath}\n`);

  // Etherscan verification instructions
  if (network !== "hardhat" && network !== "localhost") {
    console.log("🔍 To verify contracts on Etherscan:");
    console.log(`   npx hardhat verify --network ${network} ${identityAddress}`);
    console.log(`   npx hardhat verify --network ${network} ${reputationAddress}`);
    console.log(`   npx hardhat verify --network ${network} ${validationAddress}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
