# ERC-8004 Smart Contracts Deployment Guide

## Prerequisites

1. **Install Foundry** (already done via `foundryup`)
2. **Get testnet ETH** for Sepolia from a faucet:
   - https://sepoliafaucet.com/
   - https://www.alchemy.com/faucets/ethereum-sepolia

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your `.env` file:
   - `PRIVATE_KEY`: Your wallet's private key (without 0x prefix)
   - `SEPOLIA_RPC_URL`: Infura/Alchemy Sepolia RPC endpoint
   - `ETHERSCAN_API_KEY`: For contract verification (get from etherscan.io)

## Build Contracts

```bash
forge build
```

## Run Tests

```bash
forge test -vv
```

## Deploy to Sepolia Testnet

```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
```

Or deploy without verification (verify later):

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $SEPOLIA_RPC_URL --broadcast
```

## Verify Contracts (if not done during deployment)

```bash
# Identity Registry
forge verify-contract <CONTRACT_ADDRESS> \
  src/AgentIdentityRegistry.sol:AgentIdentityRegistry \
  --chain-id 11155111 \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Reputation Registry
forge verify-contract <CONTRACT_ADDRESS> \
  src/AgentReputationRegistry.sol:AgentReputationRegistry \
  --chain-id 11155111 \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Validation Registry
forge verify-contract <CONTRACT_ADDRESS> \
  src/AgentValidationRegistry.sol:AgentValidationRegistry \
  --chain-id 11155111 \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## Deploy to Arbitrum Sepolia (for hackathon)

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --broadcast --verify
```

## Deploy to Production (Arbitrum Mainnet)

⚠️ **Only do this when ready for production!**

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $ARBITRUM_RPC_URL --broadcast --verify
```

## Export ABIs for Backend Integration

ABIs are automatically generated in `out/` directory after `forge build`:

```bash
# Copy ABIs to backend
mkdir -p ../backend/src/contracts/abis
cp out/AgentIdentityRegistry.sol/AgentIdentityRegistry.json ../backend/src/contracts/abis/
cp out/AgentReputationRegistry.sol/AgentReputationRegistry.json ../backend/src/contracts/abis/
cp out/AgentValidationRegistry.sol/AgentValidationRegistry.json ../backend/src/contracts/abis/
```

## Contract Addresses

After deployment, save the addresses to `deployments.json`:

```json
{
  "sepolia": {
    "identityRegistry": "0x...",
    "reputationRegistry": "0x...",
    "validationRegistry": "0x..."
  },
  "arbitrumSepolia": {
    "identityRegistry": "0x...",
    "reputationRegistry": "0x...",
    "validationRegistry": "0x..."
  },
  "arbitrum": {
    "identityRegistry": "0x...",
    "reputationRegistry": "0x...",
    "validationRegistry": "0x..."
  }
}
```

## Testing on Sepolia

Use Foundry's `cast` to interact with deployed contracts:

```bash
# Register an agent
cast send <IDENTITY_REGISTRY_ADDRESS> \
  "register(string)" "ipfs://QmYourAgentMetadata" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Give feedback
cast send <REPUTATION_REGISTRY_ADDRESS> \
  "giveFeedback(uint256,int128,uint8,string,string,string)" \
  1 85 0 "trading" "accuracy" "ipfs://feedback" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

## Next Steps (Phase 2)

1. ✅ Deploy contracts to Sepolia testnet
2. Export ABIs to backend
3. Build TypeScript SDK for contract interaction
4. Integrate with SuperMolt backend
5. Test end-to-end flow
6. Deploy to Arbitrum for Surge hackathon
