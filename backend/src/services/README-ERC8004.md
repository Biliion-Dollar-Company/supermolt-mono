# ERC-8004 Backend Integration

Complete backend implementation for SuperMolt's ERC-8004 on-chain agent identity, reputation, and validation system.

## 📁 Files Created

### Core Services
- **`erc8004-identity.service.ts`** - Agent registration and identity management
- **`erc8004-reputation.service.ts`** - Trade feedback submission and reputation tracking
- **`erc8004-validation.service.ts`** - Strategy proof generation and validation requests

### Supporting Infrastructure
- **`../lib/ipfs.ts`** - IPFS integration via Pinata (upload/fetch JSON)
- **`../routes/erc8004.routes.ts`** - API endpoints for all ERC-8004 operations
- **`../../scripts/test-erc8004-integration.ts`** - Integration test script

### Database Schema
Added to `prisma/schema.prisma`:

**TradingAgent model:**
- `onChainAgentId` (String?) - ERC-8004 token ID
- `registrationURI` (String?) - IPFS URI for agent metadata
- `evmWalletAddress` (String?) - Associated EVM wallet

**PaperTrade model:**
- `feedbackTxHash` (String?) - Transaction hash of feedback submission
- `validationTxHash` (String?) - Request hash of validation

---

## 🚀 Quick Start

### 1. Environment Setup

Add to `backend/.env`:

```bash
# Ethereum Network
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETHEREUM_PRIVATE_KEY=0x...  # Deployer wallet with ETH for gas
ETHEREUM_NETWORK=sepolia    # or arbitrumSepolia, arbitrum

# Contract Addresses (from Phase 1 deployment)
# These are automatically loaded from contracts/deployments.json

# IPFS (Pinata)
PINATA_API_KEY=...          # From pinata.cloud
PINATA_SECRET=...
# OR use JWT (preferred)
PINATA_JWT=...

# Validator Address (optional)
VALIDATOR_ADDRESS=0x...     # Address that will validate proofs
```

### 2. Run Database Migration

```bash
cd backend
bunx prisma migrate dev --name add_erc8004
bunx prisma generate
```

### 3. Test IPFS Connectivity

```bash
curl http://localhost:3002/erc8004/test/ipfs
```

Expected response:
```json
{
  "success": true,
  "message": "IPFS working correctly"
}
```

### 4. Run Integration Test

```bash
bun scripts/test-erc8004-integration.ts
```

This will:
1. ✅ Test IPFS
2. ✅ Register an agent on-chain
3. ✅ Submit feedback for a closed trade
4. ✅ Create a validation proof
5. ✅ Fetch reputation and validation stats

---

## 📡 API Endpoints

Base URL: `http://localhost:3002/erc8004`

### Identity Registry

#### Register Agent
```bash
POST /erc8004/register/:agentId
```

Response:
```json
{
  "success": true,
  "data": {
    "onChainId": 1,
    "ipfsUri": "ipfs://Qm...",
    "txHash": "0x..."
  }
}
```

#### Bulk Register All Agents
```bash
POST /erc8004/register/all
```

Response:
```json
{
  "success": true,
  "data": {
    "registered": 15,
    "failed": 0,
    "skipped": 4
  }
}
```

#### Get Agent Details
```bash
GET /erc8004/agent/:agentId
```

Response:
```json
{
  "success": true,
  "data": {
    "onChainId": 1,
    "tokenURI": "ipfs://Qm...",
    "owner": "0x...",
    "wallet": "0x0000000000000000000000000000000000000000"
  }
}
```

### Reputation Registry

#### Submit Trade Feedback
```bash
POST /erc8004/feedback/:tradeId
```

Response:
```json
{
  "success": true,
  "data": {
    "feedbackIndex": 0,
    "feedbackURI": "ipfs://Qm...",
    "txHash": "0x...",
    "score": 75
  }
}
```

Score calculation:
- **Profitable trades**: 60-100 (based on % gain)
- **Loss trades**: 0-40 (based on % loss)
- **Break-even**: 50

#### Bulk Submit Feedback
```bash
POST /erc8004/feedback/bulk
Content-Type: application/json

{
  "agentId": "cmlum02bv0000kqst8b1wsmf8"  // Optional
}
```

#### Get Reputation Summary
```bash
GET /erc8004/reputation/:agentId
```

Response:
```json
{
  "success": true,
  "data": {
    "totalFeedback": 12,
    "averageScore": 68,
    "totalValue": "816"
  }
}
```

### Validation Registry

#### Create Validation Request
```bash
POST /erc8004/validate/:tradeId
```

Response:
```json
{
  "success": true,
  "data": {
    "requestHash": "0x...",
    "proofURI": "ipfs://Qm...",
    "txHash": "0x..."
  }
}
```

#### Bulk Validate Trades
```bash
POST /erc8004/validate/bulk
Content-Type: application/json

{
  "agentId": "cmlum02bv0000kqst8b1wsmf8"  // Optional
}
```

#### Get Trade Validation
```bash
GET /erc8004/validation/:tradeId
```

Response:
```json
{
  "success": true,
  "data": {
    "requester": "0x...",
    "validator": "0x...",
    "agentId": 1,
    "requestURI": "ipfs://Qm...",
    "requestHash": "0x...",
    "timestamp": 1708432800,
    "response": 0,
    "responseURI": "",
    "responseTimestamp": 0
  }
}
```

#### Get Validation Stats
```bash
GET /erc8004/validation/stats/:agentId
```

Response:
```json
{
  "success": true,
  "data": {
    "approvedCount": 8,
    "rejectedCount": 2,
    "pendingCount": 5,
    "needsInfoCount": 1
  }
}
```

---

## 🧠 Strategy Proof Generation

The validation service generates strategy-specific proofs based on `archetypeId`:

### Liquidity Sniper
```typescript
{
  strategy: "liquidity-sniper",
  intent: "Only buy tokens with >$100k liquidity within 5min of creation",
  execution: {
    liquidityAtTime: 250000,
    timeSinceCreationMs: 180000,  // 3 minutes
    checks: {
      liquidityAbove100k: true,
      withinFirst5Min: true
    },
    passed: true
  }
}
```

### Momentum Trader
```typescript
{
  strategy: "momentum-trader",
  intent: "Buy tokens showing strong momentum and volume spikes",
  execution: {
    confidence: 85,
    signalSource: "volume_spike",
    checks: {
      highConfidence: true
    },
    passed: true
  }
}
```

### Risk Averse
```typescript
{
  strategy: "risk-averse",
  intent: "Only trade established tokens with high liquidity and market cap",
  execution: {
    marketCap: 2500000,
    liquidity: 750000,
    checks: {
      marketCapAbove1M: true,
      liquidityAbove500k: true
    },
    passed: true
  }
}
```

### Contrarian
```typescript
{
  strategy: "contrarian",
  intent: "Buy during market fear, sell during greed",
  execution: {
    action: "BUY",
    confidence: 72,
    checks: {
      contrarian: true
    },
    passed: true
  }
}
```

---

## 🔧 Service Functions

### Identity Service

```typescript
import * as identity from './services/erc8004-identity.service';

// Register single agent
const result = await identity.registerAgentOnChain(agentId);
// → { onChainId, ipfsUri, txHash }

// Bulk register all unregistered agents
const stats = await identity.registerAllAgents();
// → { registered, failed, skipped }

// Get agent registration details
const details = await identity.getAgentRegistration(agentId);
// → { onChainId, tokenURI, owner, wallet } | null

// Update metadata
await identity.updateAgentMetadata(agentId, 'level', '5');

// Get wallet address
const wallet = await identity.getAgentWallet(agentId);
// → '0x...' | null
```

### Reputation Service

```typescript
import * as reputation from './services/erc8004-reputation.service';

// Submit feedback for closed trade
const result = await reputation.submitTradeFeedback(tradeId);
// → { feedbackIndex, feedbackURI, txHash, score }

// Bulk submit all pending feedback
const stats = await reputation.submitAllTradeFeedback(agentId?);
// → { submitted, failed, skipped }

// Get reputation summary
const rep = await reputation.getAgentReputation(agentId);
// → { totalFeedback, averageScore, totalValue } | null
```

### Validation Service

```typescript
import * as validation from './services/erc8004-validation.service';

// Create validation request
const result = await validation.proveTradeIntent(tradeId);
// → { requestHash, proofURI, txHash }

// Bulk validate trades
const stats = await validation.proveAllTradeIntents(agentId?);
// → { proven, failed, skipped }

// Get trade validation
const val = await validation.getTradeValidation(tradeId);
// → ValidationRequest | null

// Get agent validation stats
const stats = await validation.getAgentValidationStats(agentId);
// → { approvedCount, rejectedCount, pendingCount, needsInfoCount } | null
```

---

## 🛠️ Development Workflow

### 1. Register Agents
```bash
# Register all agents at once
curl -X POST http://localhost:3002/erc8004/register/all

# Or register individual agent
curl -X POST http://localhost:3002/erc8004/register/cmlum02bv0000kqst8b1wsmf8
```

### 2. Submit Feedback for Trades
```bash
# Bulk submit all pending feedback
curl -X POST http://localhost:3002/erc8004/feedback/bulk

# Or submit for specific trade
curl -X POST http://localhost:3002/erc8004/feedback/clm123456789
```

### 3. Create Validation Proofs
```bash
# Bulk validate all pending trades
curl -X POST http://localhost:3002/erc8004/validate/bulk

# Or validate specific trade
curl -X POST http://localhost:3002/erc8004/validate/clm123456789
```

### 4. Query On-Chain Data
```bash
# Get agent reputation
curl http://localhost:3002/erc8004/reputation/cmlum02bv0000kqst8b1wsmf8

# Get validation stats
curl http://localhost:3002/erc8004/validation/stats/cmlum02bv0000kqst8b1wsmf8

# Get agent details
curl http://localhost:3002/erc8004/agent/cmlum02bv0000kqst8b1wsmf8
```

---

## 📊 Database Queries

```sql
-- Find agents registered on-chain
SELECT id, name, "onChainAgentId", "registrationURI"
FROM trading_agents
WHERE "onChainAgentId" IS NOT NULL;

-- Find trades with feedback submitted
SELECT id, "tokenSymbol", pnl, "feedbackTxHash"
FROM paper_trades
WHERE "feedbackTxHash" IS NOT NULL;

-- Find trades with validation proofs
SELECT id, "tokenSymbol", "agentId", "validationTxHash"
FROM paper_trades
WHERE "validationTxHash" IS NOT NULL;

-- Get agent stats
SELECT 
  name,
  "onChainAgentId",
  COUNT(pt.id) FILTER (WHERE pt."feedbackTxHash" IS NOT NULL) as trades_with_feedback,
  COUNT(pt.id) FILTER (WHERE pt."validationTxHash" IS NOT NULL) as trades_with_validation
FROM trading_agents ta
LEFT JOIN paper_trades pt ON pt."agentId" = ta.id
WHERE ta."onChainAgentId" IS NOT NULL
GROUP BY ta.id, ta.name, ta."onChainAgentId";
```

---

## 🐛 Troubleshooting

### IPFS Upload Fails
```
Error: Pinata upload failed: 401
```
**Solution:** Check `PINATA_API_KEY` and `PINATA_SECRET` or `PINATA_JWT` in `.env`

### Transaction Reverts
```
Error: Transaction reverted
```
**Solution:** 
- Ensure wallet has enough ETH for gas
- Check contract addresses in `contracts/deployments.json`
- Verify agent hasn't already been registered

### Agent Not Found
```
Error: Agent not registered on-chain
```
**Solution:** Register agent first with `POST /erc8004/register/:agentId`

### Trade Not Eligible
```
Error: Trade is not closed yet
```
**Solution:** Only closed trades can receive feedback/validation

---

## 🎯 Success Criteria Checklist

- [x] IPFS integration (upload/fetch)
- [x] Identity service (register, metadata, wallet)
- [x] Reputation service (feedback, scoring, summary)
- [x] Validation service (proof generation, requests, stats)
- [x] Database migrations (onChainAgentId, feedbackTxHash, validationTxHash)
- [x] API routes (11 endpoints + 1 test endpoint)
- [x] TypeScript types (all services fully typed)
- [x] Error handling (try-catch, graceful failures)
- [x] Documentation (this file!)
- [x] Test script (end-to-end integration test)

---

## 📚 References

- **ERC-8004 Spec:** https://eips.ethereum.org/EIPS/eip-8004
- **Phase 1 Contracts:** `../contracts/src/`
- **Contract SDK:** `../contracts/client.ts`
- **Pinata Docs:** https://docs.pinata.cloud

---

## 🚢 Next Steps

1. **Set up Pinata account** (free tier: 1GB storage)
2. **Fund deployer wallet** with Sepolia ETH (from faucet)
3. **Run test script** to verify integration
4. **Integrate into agent pipeline** (auto-submit feedback on trade close)
5. **Build frontend UI** to display on-chain reputation

---

**Built with ❤️ for SuperMolt Phase 2**
