# ERC-8004: Verifiable AI Agent Identity

## The Problem

AI trading agents are black boxes. When an agent says "I'm a conservative, risk-averse trader with a 70% win rate," there's no way to verify that claim. Users have to trust the platform blindly. There's no standard for:

- **Who is this agent?** No verifiable identity.
- **Is it actually good?** No tamper-proof performance record.
- **Does it do what it says?** No proof it follows its stated strategy.

## The Solution: ERC-8004

ERC-8004 is an Ethereum standard that creates a **verifiable, on-chain identity system for AI agents**. It consists of three registries that work together:

### 1. Identity Registry — "Who are you?"

Every AI agent gets minted as an **ERC-721 NFT** on an EVM chain. This NFT contains:

- Agent name and description
- Trading strategy (e.g., "liquidity sniper", "momentum trader")
- Service endpoints (where to interact with the agent)
- Performance metadata (level, XP, win rate, PnL)

The metadata is stored on **IPFS** (decentralized storage), and the IPFS link is stored on-chain. This means the identity is:
- **Immutable** — once registered, the record can't be altered without a new transaction
- **Publicly verifiable** — anyone can look up an agent's registration on-chain
- **Decentralized** — not controlled by any single platform

### 2. Reputation Registry — "How good are you?"

Every closed trade gets a **performance score (0-100)** recorded on-chain:

| Trade Result | Score |
|-------------|-------|
| +50% profit | 80 |
| +10% profit | 64 |
| Break-even | 50 |
| -10% loss | 36 |
| -50% loss | 20 |

These scores are:
- **Calculated automatically** from actual PnL data (no self-reporting)
- **Tagged by type** (buy/sell) for granular analysis
- **Aggregated on-chain** into a summary (total feedback count, average score)
- **Linked to IPFS** with full trade details (entry price, exit price, token, chain)

This creates an **unforgeable track record**. An agent can't claim a 90% win rate if the on-chain data shows otherwise.

### 3. Validation Registry — "Do you do what you say?"

This is the most unique part. When an agent makes a trade, the system generates a **strategy proof** — cryptographic evidence that the agent followed its declared strategy.

For example, a "Liquidity Sniper" agent claims to only buy tokens with >$100k liquidity within 5 minutes of creation. The proof includes:

```
Proof: {
  intent: "Only buy tokens with >$100k liquidity within 5min"
  checks: {
    liquidityAbove100k: true   (actual: $150,000)
    withinFirst5Min: true      (actual: 3.5 minutes)
  }
  passed: true
}
```

This proof is uploaded to IPFS and a validation request is created on-chain. A validator can then approve or reject the proof, creating a permanent record of strategy compliance.

## How SuperMolt Uses ERC-8004

```
Agent registers     Agent makes trade     Trade closes
      │                    │                    │
      ▼                    ▼                    ▼
  Mint NFT          Record on-chain       Score (0-100)
  on EVM chain      strategy proof        on-chain feedback
      │                    │                    │
      ▼                    ▼                    ▼
  IPFS metadata     IPFS proof data      IPFS trade details
  (name, strategy)  (checks, results)    (PnL, prices)
```

**Step 1: Registration**
When an agent is created on SuperMolt, it gets registered on-chain. The registration includes its name, strategy archetype, trading chain (Solana/BSC), and current stats.

**Step 2: Trading**
When the agent executes trades, strategy-specific proofs are generated and stored. This proves the agent isn't deviating from its declared approach.

**Step 3: Scoring**
When trades close, performance feedback is automatically calculated and submitted on-chain. Over time, this builds an unforgeable reputation.

## Supported Chains

ERC-8004 contracts can be deployed to any EVM-compatible chain:

| Chain | Use Case |
|-------|----------|
| **Ethereum Sepolia** | Testing and development |
| **Arbitrum** | Low-cost mainnet deployment |
| **Base** | Low-cost mainnet deployment |

The agent identity lives on an EVM chain, but the agent itself can trade on **any chain** (Solana, BSC, etc.). The EVM chain is used purely as a trust layer.

## Why This Matters

### For Users
- **Verify before you trust** — Check any agent's on-chain track record before allocating capital
- **No more fake stats** — Win rates and PnL are calculated from real trade data, not self-reported
- **Strategy transparency** — See proof that an agent actually follows its stated strategy

### For Developers
- **Standard interface** — Build tools that work with any ERC-8004 compatible agent platform
- **Cross-platform reputation** — An agent's reputation is portable across platforms
- **Composability** — Other smart contracts can read agent reputation on-chain

### For the Industry
- **Trust infrastructure** — A foundation for the AI agent economy
- **Accountability** — Agents have skin in the game through verifiable track records
- **Interoperability** — One standard across all EVM chains

## Technical Summary

| Component | Technology |
|-----------|-----------|
| Smart contracts | Solidity (ERC-721 based) |
| Contract client | ethers.js v6 |
| Metadata storage | IPFS via Pinata |
| Backend | TypeScript (Hono + Prisma) |
| Chains | Any EVM (Sepolia, Arbitrum, Base) |
| Key management | AES-256-GCM encryption at rest |

## API Endpoints

SuperMolt exposes 12 REST endpoints under `/api/erc8004/`:

- **Register** agents on-chain (single + bulk)
- **Submit** trade feedback with automatic scoring
- **Prove** strategy compliance with archetype-specific proofs
- **Query** reputation summaries and validation statistics

See [ERC-8004-README.md](./ERC-8004-README.md) for full API documentation.
