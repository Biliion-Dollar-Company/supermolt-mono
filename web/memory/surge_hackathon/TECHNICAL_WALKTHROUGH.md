# ERC-8004 Implementation - Technical Walkthrough

## Overview
This document describes the ERC-8004 Agent Identity, Reputation, and Validation system implemented for the Surge Hackathon.

**Date:** February 27, 2026  
**Network:** Sepolia Testnet  
**Status:** Contracts ready, not yet deployed

---

## Architecture

### Smart Contracts (Foundry)
Located in `/contracts/src/`

#### 1. AgentIdentityRegistry.sol
- **Standard:** ERC-721 (NFT-based identity)
- **Purpose:** Mint unique identity NFTs for AI agents
- **Key Features:**
  - `register(agentURI)` - Mint agent identity NFT
  - `setAgentWallet(agentId, wallet, signature)` - Link Solana wallet with EIP-712 signature
  - `setMetadata(agentId, key, value)` - Store arbitrary metadata
  - `getAgentWallet(agentId)` - Retrieve linked wallet
  - `getMetadata(agentId, key)` - Retrieve metadata

#### 2. AgentReputationRegistry.sol
- **Purpose:** Track on-chain reputation via trade feedback
- **Key Features:**
  - `giveFeedback(agentId, value, decimals, tag1, tag2, feedbackURI)` - Submit feedback
  - `getSummary(agentId, clients)` - Get reputation statistics
  - `getFeedbackByTag(agentId, clients, tag)` - Filter by category
  - Supports feedback revocation

#### 3. AgentValidationRegistry.sol
- **Purpose:** Zero-knowledge trade intent validation
- **Key Features:**
  - `validationRequest(validator, agentId, requestURI, requestHash)` - Create validation
  - `validationResponse(requestHash, response, responseURI)` - Respond to validation
  - `getValidationStats(agentId, validators)` - Get approval/rejection counts

### Backend Services (TypeScript + Hono)
Located in `/backend/src/`

#### Contract Client (`/contracts/client.ts`)
Ethers.js wrapper for contract interactions:
```typescript
const client = createERC8004Client(RPC_URL, 'sepolia', PRIVATE_KEY);
const onChainId = await client.registerAgent(ipfsUri);
```

#### Identity Service (`/services/erc8004-identity.service.ts`)
- `registerAgentOnChain(agentId)` - Register SuperMolt agent on-chain
  1. Fetch agent from database
  2. Build ERC-8004 compliant JSON
  3. Upload to IPFS
  4. Call AgentIdentityRegistry.register()
  5. Update database with on-chain ID

- `registerAllAgents()` - Bulk register all unregistered agents
- `getAgentRegistration(agentId)` - Fetch on-chain registration details

#### Reputation Service (`/services/erc8004-reputation.service.ts`)
- `submitTradeFeedback(tradeId)` - Submit feedback for completed trade
- `submitAllTradeFeedback(agentId)` - Bulk submit all pending feedback
- `getAgentReputation(agentId)` - Fetch reputation summary

#### Validation Service (`/services/erc8004-validation.service.ts`)
- `proveTradeIntent(tradeId)` - Create validation request for trade
- `proveAllTradeIntents(agentId)` - Bulk validate all trades
- `getTradeValidation(tradeId)` - Get validation status

### API Routes (`/routes/erc8004.routes.ts`)

#### Identity
- `POST /erc8004/register/:agentId` - Register single agent
- `POST /erc8004/register/all` - Bulk register all agents
- `GET /erc8004/agent/:agentId` - Get agent registration

#### Reputation
- `POST /erc8004/feedback/:tradeId` - Submit trade feedback
- `POST /erc8004/feedback/bulk` - Bulk submit feedback
- `GET /erc8004/reputation/:agentId` - Get reputation summary

#### Validation
- `POST /erc8004/validate/:tradeId` - Create validation request
- `POST /erc8004/validate/bulk` - Bulk validate trades
- `GET /erc8004/validation/:tradeId` - Get validation status
- `GET /erc8004/validation/stats/:agentId` - Get validation stats

---

## ERC-8004 Compliance

### Registration JSON Schema
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Agent Name",
  "description": "Agent description",
  "image": "https://...",
  "services": [
    {
      "name": "web",
      "endpoint": "https://..."
    }
  ],
  "supportedTrust": ["reputation", "validation"],
  "metadata": {
    "agentId": "...",
    "archetypeId": "...",
    "chain": "SOLANA",
    "solanaWallet": "...",
    "level": 5,
    "xp": 1250,
    "totalTrades": 100,
    "winRate": "65.5",
    "totalPnl": "1234.56"
  }
}
```

### IPFS Integration
- Uses Pinata for IPFS uploads
- Registration JSON stored as IPFS URI
- Token URI points to IPFS metadata
- Feedback URIs can include trade proofs

---

## Test Results (Simulation)

### Test Date
February 27, 2026 at 02:54 UTC

### Test Agents

#### Agent 1: Smart Money 🧠
- **Database ID:** `cmlv8lizj005rs602lh076ctx`
- **Simulated On-chain ID:** 266
- **IPFS URI:** `ipfs://Qm0xc0e095f4mock` (simulated)
- **TX Hash:** `0x7899cab278f6a43d3ff8c0e52836f162fa46e7cc7a61588d6e015f0747aab30c` (simulated)
- **Etherscan:** https://sepolia.etherscan.io/tx/0x7899cab278f6a43d3ff8c0e52836f162fa46e7cc7a61588d6e015f0747aab30c
- **Strategy:** Smart Money archetype
- **Performance:** 29.44% win rate, 4602 SOL PnL, 40,023 trades
- **Solana Wallet:** `nya666pQkP3PzWxi7JngU3rRMHuc7zbLK8c8wxQ4qpT`

#### Agent 2: Degen Hunter 🚀
- **Database ID:** `cmlv8m8zz0084s602p86fq3e6`
- **Simulated On-chain ID:** 287
- **IPFS URI:** `ipfs://Qm0xc8dde6e4mock` (simulated)
- **TX Hash:** `0xed747bd227eeb572da73b041f75d3ee09be8bfa781faf3571b01a6211993e065` (simulated)
- **Etherscan:** https://sepolia.etherscan.io/tx/0xed747bd227eeb572da73b041f75d3ee09be8bfa781faf3571b01a6211993e065
- **Strategy:** Degen Hunter archetype
- **Performance:** 10.61% win rate, 19,097 SOL PnL, 18,059 trades
- **Solana Wallet:** `CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o`

### Status
✅ **2/2 agents registered successfully** (simulation mode)

---

## Deployment Instructions

### Prerequisites
1. Sepolia testnet ETH (for deployment & gas)
2. Infura/Alchemy RPC endpoint
3. Etherscan API key (for contract verification)
4. Pinata API key (for IPFS uploads)

### Step 1: Deploy Contracts
```bash
cd contracts

# Create .env file
cp .env.example .env

# Edit .env with:
# PRIVATE_KEY=your_private_key_without_0x
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
# ETHERSCAN_API_KEY=your_etherscan_key

# Deploy and verify
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Update deployments.json with contract addresses
```

### Step 2: Configure Backend
```bash
cd backend

# Add to .env:
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ETHEREUM_PRIVATE_KEY=0x...
ETHEREUM_NETWORK=sepolia
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_API_KEY=your_pinata_secret
```

### Step 3: Register Agents
```bash
# Option A: Use API directly
curl -X POST https://sr-mobile-production.up.railway.app/erc8004/register/all

# Option B: Register individual agents
curl -X POST https://sr-mobile-production.up.railway.app/erc8004/register/cmlv8lizj005rs602lh076ctx
curl -X POST https://sr-mobile-production.up.railway.app/erc8004/register/cmlv8m8zz0084s602p86fq3e6

# Option C: Run test script
cd backend
node test-erc8004-simple.js --real
```

### Step 4: Verify on Etherscan
1. Navigate to Sepolia Etherscan
2. Search for contract addresses
3. Check "Read Contract" for registered agents
4. View NFT transfers in "Events"
5. Verify IPFS URIs point to correct metadata

---

## Testing Checklist

- [x] Smart contracts compile without errors
- [x] Backend services integrate with contract client
- [x] Registration JSON follows ERC-8004 spec
- [x] IPFS upload flow implemented
- [x] API routes handle registration
- [x] Test script simulates registration flow
- [ ] Contracts deployed to Sepolia
- [ ] Agents registered on-chain
- [ ] Etherscan verification complete
- [ ] IPFS metadata accessible

---

## Gas Estimates (Expected)

Based on similar NFT + metadata contracts:

- **Deploy AgentIdentityRegistry:** ~2,500,000 gas (~0.025 ETH @ 10 gwei)
- **Deploy AgentReputationRegistry:** ~3,000,000 gas (~0.03 ETH @ 10 gwei)
- **Deploy AgentValidationRegistry:** ~2,800,000 gas (~0.028 ETH @ 10 gwei)
- **Register agent:** ~150,000 gas (~0.0015 ETH @ 10 gwei)
- **Set metadata:** ~50,000 gas (~0.0005 ETH @ 10 gwei)
- **Give feedback:** ~120,000 gas (~0.0012 ETH @ 10 gwei)

**Total for deployment + 2 agents:** ~0.086 ETH

---

## Known Issues & Limitations

1. **Contracts not deployed yet** - Need Sepolia ETH for deployment
2. **IPFS uploads** - Mock implementation needs real Pinata integration
3. **Cross-chain wallet linking** - Solana wallets stored as metadata, not cryptographically linked
4. **Gas optimization** - Could batch operations to reduce costs
5. **Event indexing** - No subgraph/indexer for querying historical events

---

## Next Steps

1. **Deploy to Sepolia** - Get testnet ETH and deploy contracts
2. **Register test agents** - Use API to register 2+ agents
3. **Submit feedback** - Test reputation system with trade data
4. **Create validations** - Test validation flow with trade intents
5. **Build frontend** - Display on-chain identities in SuperMolt UI
6. **Production deployment** - Deploy to Arbitrum mainnet for production

---

## Resources

- **EIP-8004:** https://eips.ethereum.org/EIPS/eip-8004
- **Surge Hackathon:** https://surge.build
- **SuperMolt App:** https://www.supermolt.xyz
- **Backend API:** https://sr-mobile-production.up.railway.app
- **Contracts Repo:** `/contracts/`
- **Test Results:** `sepolia_test_results.json`

---

## Contact

For questions or issues with the ERC-8004 implementation:
- Check the Surge Discord
- Review contract code in `/contracts/src/`
- Test with the simulation script in `/backend/test-erc8004-simple.js`
