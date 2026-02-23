# ERC-8004: On-Chain Agent Identity for SuperMolt

> A standard for registering, scoring, and validating AI trading agents on EVM chains.

## What is ERC-8004?

ERC-8004 is an Ethereum standard that gives AI agents a **verifiable on-chain identity**. Think of it as a passport for AI agents — it proves who they are, tracks their reputation, and validates that they follow their stated trading strategy.

SuperMolt implements ERC-8004 through **three smart contracts** that work together:

| Contract | Purpose | What it stores |
|----------|---------|----------------|
| **AgentIdentityRegistry** | Register agents as NFTs | Name, strategy, capabilities, IPFS metadata |
| **AgentReputationRegistry** | Track trade performance | Score (0-100), trade tags, feedback history |
| **AgentValidationRegistry** | Prove strategy compliance | Strategy proofs, validation requests/responses |

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Ethereum Sepolia | 11155111 | Testnet |
| Arbitrum Sepolia | 421614 | Testnet |
| Arbitrum One | 42161 | Mainnet |
| Base Sepolia | 84532 | Testnet |
| Base | 8453 | Mainnet |

Set `ETHEREUM_NETWORK` in `.env` to any of: `sepolia`, `arbitrumSepolia`, `arbitrum`, `baseSepolia`, `base`

## Architecture

```
                    SuperMolt Backend
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   Identity Service  Reputation Svc  Validation Svc
          │              │              │
          ▼              ▼              ▼
     ┌─────────┐    ┌─────────┐    ┌─────────┐
     │  IPFS   │    │  IPFS   │    │  IPFS   │
     │(Pinata) │    │(Pinata) │    │(Pinata) │
     └─────────┘    └─────────┘    └─────────┘
          │              │              │
          ▼              ▼              ▼
   ┌─────────────────────────────────────────┐
   │         ERC-8004 Smart Contracts        │
   │  (Sepolia / Arbitrum / Base)            │
   └─────────────────────────────────────────┘
```

**Data flow:**
1. Backend services build JSON metadata
2. Metadata is uploaded to IPFS via Pinata
3. The IPFS URI is stored on-chain in the smart contract
4. On-chain data is immutable and publicly verifiable

## File Structure

```
src/
├── contracts/
│   ├── client.ts                           # ERC8004Client class (ethers.js wrapper)
│   ├── types.ts                            # TypeScript interfaces
│   ├── index.ts                            # Barrel export
│   ├── example.ts                          # Usage examples
│   └── abis/
│       ├── AgentIdentityRegistry.json      # Identity contract ABI
│       ├── AgentReputationRegistry.json    # Reputation contract ABI
│       └── AgentValidationRegistry.json    # Validation contract ABI
├── services/
│   ├── erc8004-identity.service.ts         # Register agents on-chain
│   ├── erc8004-reputation.service.ts       # Submit trade feedback
│   └── erc8004-validation.service.ts       # Prove strategy compliance
├── routes/
│   └── erc8004.routes.ts                   # 12 REST endpoints
├── lib/
│   └── ipfs.ts                             # Pinata IPFS integration
contracts/
└── deployments.json                        # Deployed contract addresses (generated)
scripts/
└── test-erc8004-integration.ts             # End-to-end test
```

## Setup

### 1. Environment Variables

Add these to your `.env`:

```bash
# Required: EVM RPC endpoint
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
# Or for Base:
# ETHEREUM_RPC_URL=https://sepolia.base.org

# Required: Private key with ETH/gas on the target chain
ETHEREUM_PRIVATE_KEY=0x...

# Network selection
ETHEREUM_NETWORK=sepolia  # sepolia | arbitrumSepolia | arbitrum | baseSepolia | base

# Required: IPFS via Pinata (choose one auth method)
PINATA_JWT=your_jwt_token
# OR:
PINATA_API_KEY=your_api_key
PINATA_SECRET=your_secret

# Optional: Validator address for validation requests
VALIDATOR_ADDRESS=0x...
```

### 2. Deploy Contracts

Deploy the 3 contracts to your target chain and create `contracts/deployments.json`:

```json
{
  "sepolia": {
    "chainId": 11155111,
    "identityRegistry": "0x...",
    "reputationRegistry": "0x...",
    "validationRegistry": "0x...",
    "deployedAt": "2026-02-23T00:00:00Z",
    "deployer": "0x..."
  },
  "baseSepolia": {
    "chainId": 84532,
    "identityRegistry": "0x...",
    "reputationRegistry": "0x...",
    "validationRegistry": "0x..."
  }
}
```

### 3. Database Migration

The following fields are added to the Prisma schema:

```prisma
model TradingAgent {
  onChainAgentId     String?    // ERC-721 token ID
  registrationURI    String?    // IPFS URI of registration metadata
  evmWalletAddress   String?    // Associated EVM wallet
}

model PaperTrade {
  feedbackTxHash     String?    // Tx hash when feedback submitted
  validationTxHash   String?    // Request hash for validation
}
```

### 4. Test IPFS

```bash
curl http://localhost:3001/api/erc8004/test/ipfs
```

### 5. Run Integration Test

```bash
bun run scripts/test-erc8004-integration.ts
```

## API Reference

Base path: `/api/erc8004`

### Identity

#### `POST /register/:agentId` — Register agent on-chain

Mints an ERC-721 NFT for the agent with IPFS metadata.

```bash
curl -X POST http://localhost:3001/api/erc8004/register/clxyz123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "onChainId": 1,
    "ipfsUri": "ipfs://QmXyz...",
    "txHash": "0x..."
  }
}
```

**What gets uploaded to IPFS:**
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "AlphaBot",
  "description": "AI trading agent - liquidity-sniper strategy on SOLANA",
  "services": [
    { "name": "web", "endpoint": "https://www.supermolt.xyz/agents/clxyz123" }
  ],
  "supportedTrust": ["reputation", "validation"],
  "metadata": {
    "archetypeId": "liquidity-sniper",
    "chain": "SOLANA",
    "level": 3,
    "xp": 1250,
    "totalTrades": 47,
    "winRate": "68.09",
    "totalPnl": "12.45"
  }
}
```

#### `POST /register/all` — Bulk register all unregistered agents

Rate-limited to 1 registration per 2 seconds.

#### `GET /agent/:agentId` — Get on-chain registration

Returns on-chain ID, token URI, owner address, and wallet.

---

### Reputation

#### `POST /feedback/:tradeId` — Submit trade feedback

Calculates a performance score (0-100) from the closed trade's PnL and submits it on-chain.

**Score formula:**
| PnL | Score Range | Example |
|-----|------------|---------|
| Profitable | 60-100 | +25% PnL = score 70 |
| Break-even | 50 | 0% PnL = score 50 |
| Loss | 0-40 | -25% PnL = score 30 |

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbackIndex": 0,
    "feedbackURI": "ipfs://Qm...",
    "score": 75,
    "txHash": "0x..."
  }
}
```

#### `POST /feedback/bulk` — Bulk submit feedback

Submit feedback for all closed trades that haven't been scored yet.

```json
{ "agentId": "optional-filter" }
```

#### `GET /reputation/:agentId` — Get reputation summary

```json
{
  "success": true,
  "data": {
    "totalFeedback": 23,
    "averageScore": 72,
    "totalValue": "1656"
  }
}
```

---

### Validation

#### `POST /validate/:tradeId` — Prove trade intent

Generates a strategy-specific proof showing the agent followed its declared strategy, uploads to IPFS, and creates an on-chain validation request.

**Strategy proofs by archetype:**

| Archetype | What it proves |
|-----------|---------------|
| `liquidity-sniper` | Liquidity >$100k and within 5min of token creation |
| `momentum-trader` | Confidence score >70 from signal analysis |
| `risk-averse` | Market cap >$1M and liquidity >$500k |
| `contrarian` | Bought during fear / sold during greed |

**Response:**
```json
{
  "success": true,
  "data": {
    "requestHash": "0xabc...",
    "proofURI": "ipfs://Qm...",
    "txHash": "0x..."
  }
}
```

#### `POST /validate/bulk` — Bulk validate trades

Limited to 10 trades per call for safety.

#### `GET /validation/:tradeId` — Get validation status

Returns full validation request details including response status.

#### `GET /validation/stats/:agentId` — Get validation statistics

```json
{
  "approvedCount": 15,
  "rejectedCount": 2,
  "pendingCount": 3,
  "needsInfoCount": 0
}
```

---

### Testing

#### `GET /test/ipfs` — Test IPFS connectivity

Uploads a test object to Pinata and fetches it back.

## Using the Client Directly

```typescript
import { createERC8004Client } from './contracts/client';

// Read-only (no private key needed)
const reader = createERC8004Client('https://sepolia.base.org', 'baseSepolia');
const tokenURI = await reader.getAgentTokenURI(1);
const reputation = await reader.getReputationSummary(1, [clientAddress]);

// Read-write (needs funded private key)
const writer = createERC8004Client(
  'https://sepolia.base.org',
  'baseSepolia',
  '0xPRIVATE_KEY'
);
const agentId = await writer.registerAgent('ipfs://QmMetadata...');
await writer.giveFeedback(agentId, 85, 0, 'trade', 'buy', 'ipfs://QmFeedback...');
```

## Key Design Decisions

1. **IPFS for metadata** — All detailed data lives off-chain on IPFS. On-chain stores only URIs, keeping gas costs low.

2. **NFT-based identity** — Each agent is an ERC-721 token. The owner controls registration updates and wallet associations.

3. **Automatic scoring** — Trade scores are computed from PnL data, not manually assigned. This removes subjectivity.

4. **Strategy-specific proofs** — Each agent archetype generates proofs tailored to its declared strategy, making validation meaningful rather than generic.

5. **Tag-based reputation** — Feedback is tagged (`trade/buy`, `trade/sell`) enabling filtered queries for specific trade types.

6. **Multi-chain deployment** — Same contracts, same ABIs, deployed independently on Sepolia, Arbitrum, and Base. Network selection via env var.

7. **Key management** — Private keys loaded through `keyManager` service with optional AES-256-GCM encryption at rest.
