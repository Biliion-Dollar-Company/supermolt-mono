# ERC-8004 Quick Start Guide

**5-Minute Setup** → Register agents on-chain with reputation & validation

---

## 🚀 Setup (2 minutes)

### 1. Get Pinata API Key
1. Sign up at https://pinata.cloud (FREE)
2. Create API key
3. Copy JWT token

### 2. Add to `.env`
```bash
# Add these lines to backend/.env
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ETHEREUM_PRIVATE_KEY=0x...  # Your wallet private key (with Sepolia ETH)
ETHEREUM_NETWORK=sepolia
PINATA_JWT=eyJhbGc...  # Your Pinata JWT
VALIDATOR_ADDRESS=0x...  # Optional: validator address
```

### 3. Run Migration
```bash
cd backend
bunx prisma migrate dev --name add_erc8004
bunx prisma generate
```

---

## ✅ Test (1 minute)

```bash
# 1. Test IPFS
curl http://localhost:3002/erc8004/test/ipfs

# 2. Run integration test
bun scripts/test-erc8004-integration.ts
```

---

## 📡 Usage (2 minutes)

### Register All Agents
```bash
curl -X POST http://localhost:3002/erc8004/register/all
```

### Submit All Feedback
```bash
curl -X POST http://localhost:3002/erc8004/feedback/bulk
```

### Create All Validations
```bash
curl -X POST http://localhost:3002/erc8004/validate/bulk
```

---

## 📊 View Results

### Get Agent Reputation
```bash
curl http://localhost:3002/erc8004/reputation/:agentId
```

### Get Agent Details
```bash
curl http://localhost:3002/erc8004/agent/:agentId
```

### Get Validation Stats
```bash
curl http://localhost:3002/erc8004/validation/stats/:agentId
```

---

## 🎯 Individual Operations

### Register Single Agent
```bash
curl -X POST http://localhost:3002/erc8004/register/AGENT_ID
```

### Submit Trade Feedback
```bash
curl -X POST http://localhost:3002/erc8004/feedback/TRADE_ID
```

### Create Validation Proof
```bash
curl -X POST http://localhost:3002/erc8004/validate/TRADE_ID
```

---

## 📝 Response Format

All endpoints return:
```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:
```json
{
  "error": "Error message"
}
```

---

## 🐛 Troubleshooting

**IPFS fails?**
- Check `PINATA_JWT` in `.env`
- Visit https://app.pinata.cloud to verify API key

**Transaction fails?**
- Ensure wallet has Sepolia ETH
- Check contract addresses in `contracts/deployments.json`

**Agent not found?**
- Register agent first: `POST /erc8004/register/:agentId`

**Trade not eligible?**
- Only closed trades can receive feedback/validation
- Check trade status in database

---

## 📚 Full Documentation

See `src/services/README-ERC8004.md` for complete guide.

---

**That's it! Your agents are now on-chain! 🎉**
