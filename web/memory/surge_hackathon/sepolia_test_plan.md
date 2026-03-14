# Sepolia ERC-8004 Test Plan

## Objective
Test the Surge Hackathon ERC-8004 contracts on Sepolia testnet by deploying and registering 1-2 agents.

## Current Status
- ❌ Contracts NOT deployed to Sepolia (deployments.json is empty)
- ✅ Contract code exists in `/contracts/src/`
- ✅ Backend API routes exist in `/backend/src/routes/erc8004.routes.ts`
- ✅ Contract client wrapper exists in `/backend/src/contracts/client.ts`

## Prerequisites
1. Sepolia RPC URL (Infura/Alchemy)
2. Private key with Sepolia ETH (for deployment & gas)
3. Etherscan API key (for contract verification)

## Steps

### 1. Deploy Contracts to Sepolia
```bash
cd contracts
# Create .env from .env.example
# Set PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY

# Deploy using Forge
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify

# Update deployments.json with addresses
```

### 2. Register Test Agents
Once contracts are deployed, use the backend API to register agents:

**Option A: Direct API calls**
```bash
curl -X POST https://sr-mobile-production.up.railway.app/erc8004/register/cmlv8lizj005rs602lh076ctx
curl -X POST https://sr-mobile-production.up.railway.app/erc8004/register/cmlv8m8zz0084s602p86fq3e6
```

**Option B: Test script with ethers.js**
Create a standalone test script that:
- Uploads agent metadata to IPFS
- Calls AgentIdentityRegistry.register()
- Verifies registration on-chain

### 3. Verify on Etherscan
- Check contract addresses on Sepolia Etherscan
- Verify agent registrations (NFT mints)
- Check token URIs point to IPFS

### 4. Document Results
Record:
- Contract addresses
- Transaction hashes
- Agent IDs (on-chain)
- IPFS URIs
- Gas costs
- Any errors/issues

## Test Agents
From the leaderboard API:
1. **Smart Money**
   - ID: `cmlv8lizj005rs602lh076ctx`
   - Name: 🧠 Smart Money
   - Wallet: `nya666pQkP3PzWxi7JngU3rRMHuc7zbLK8c8wxQ4qpT`

2. **Degen Hunter**
   - ID: `cmlv8m8zz0084s602p86fq3e6`
   - Name: 🚀 Degen Hunter
   - Wallet: `CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o`

## Notes
- Contracts use EIP-712 signatures for wallet changes
- Registration creates ERC-721 NFTs
- IPFS metadata should follow ERC-8004 spec
