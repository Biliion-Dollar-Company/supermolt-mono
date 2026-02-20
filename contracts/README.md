# ERC-8004 Smart Contracts for SuperMolt AI Agents

## Overview

This repository contains ERC-8004 compliant smart contracts for managing AI agent identities, reputation, and validation on Ethereum/Arbitrum. Built for the Surge Hackathon (March 9-22, $50k prize pool).

## Contracts

### 1. AgentIdentityRegistry.sol
- **Purpose**: ERC-721 based agent identity management
- **Features**:
  - Mint NFT for each registered agent
  - EIP-712 signed wallet changes
  - Metadata storage with reserved `agentWallet` key
  - Transferable agent ownership

### 2. AgentReputationRegistry.sol
- **Purpose**: On-chain reputation tracking
- **Features**:
  - Multi-client feedback with decimal support
  - Positive and negative ratings
  - Tag-based categorization (e.g., "trading", "accuracy")
  - Revocable feedback
  - Aggregated reputation summaries
  - Tag-based filtering

### 3. AgentValidationRegistry.sol
- **Purpose**: Third-party validation workflow
- **Features**:
  - Validation request/response flow
  - Four response types: Pending, Approved, Rejected, NeedsInfo
  - Multi-validator support
  - Validation statistics aggregation
  - Request hash generation for uniqueness

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SuperMolt Platform                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────┐│
│  │ Identity Registry │  │ Reputation       │  │Validation││
│  │ (ERC-721)        │  │ Registry         │  │Registry  ││
│  │                  │  │                  │  │          ││
│  │ - Register Agent │  │ - Give Feedback  │  │ - Request││
│  │ - Set Wallet     │  │ - Revoke         │  │ - Respond││
│  │ - Metadata       │  │ - Summarize      │  │ - Stats  ││
│  └──────────────────┘  └──────────────────┘  └─────────┘│
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Test Results

All 39 tests passing ✅

```
AgentIdentityRegistry: 10 tests
AgentReputationRegistry: 14 tests
AgentValidationRegistry: 13 tests
```

## Technology Stack

- **Solidity**: ^0.8.24
- **Framework**: Foundry
- **Libraries**: OpenZeppelin Contracts v5.5.0
- **Testing**: Forge
- **Standards**: ERC-721, ERC-8004, EIP-712

## Quick Start

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test -vv

# Deploy to Sepolia
forge script script/Deploy.s.sol:DeployScript --rpc-url $SEPOLIA_RPC_URL --broadcast
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Contract Interactions

### Register an Agent
```solidity
uint256 agentId = identityRegistry.register("ipfs://agent-metadata");
```

### Give Feedback
```solidity
reputationRegistry.giveFeedback(
    agentId,
    85,  // value
    0,   // decimals
    "trading",
    "accuracy",
    "ipfs://feedback-details"
);
```

### Request Validation
```solidity
bytes32 requestHash = validationRegistry.generateRequestHash(
    validatorAddress,
    agentId,
    "ipfs://validation-request",
    nonce
);
validationRegistry.validationRequest(
    validatorAddress,
    agentId,
    "ipfs://validation-request",
    requestHash
);
```

## ERC-8004 Compliance

✅ **Identity Management**: NFT-based agent ownership  
✅ **Reputation System**: Multi-dimensional feedback  
✅ **Validation Framework**: Third-party attestations  
✅ **Metadata Storage**: Extensible key-value pairs  
✅ **Event Emissions**: Complete audit trail  

## Security Features

- **EIP-712 Signatures**: Cryptographically signed wallet changes
- **Ownership Checks**: Only owners can modify agent data
- **Nonce Management**: Replay attack prevention
- **Input Validation**: Comprehensive require statements
- **Reentrancy Safe**: No external calls in critical paths

## Gas Optimization

- Efficient storage patterns
- Minimal external calls
- Batch-friendly operations
- Indexed event parameters

## Integration with SuperMolt

This contract system integrates with SuperMolt's 19 AI trading agents:

1. **Liquidity Sniper** (MVP): First agent to be registered
2. **Future Agents**: Remaining 18 agents follow the same pattern

## Roadmap

### Phase 1: Smart Contracts (3 days) ✅
- [x] Build three registries
- [x] Write comprehensive tests
- [x] Compile successfully
- [x] Deploy to Sepolia testnet

### Phase 2: Backend Integration (3 days)
- [ ] Export ABIs
- [ ] Create TypeScript SDK
- [ ] Integrate with existing backend
- [ ] Test end-to-end flows

### Phase 3: Deployment & Testing (2 days)
- [ ] Deploy to Arbitrum Sepolia
- [ ] Test with Liquidity Sniper agent
- [ ] Document API endpoints
- [ ] Prepare hackathon submission

## License

MIT

## Contributing

Built for Surge Hackathon 2026 by SuperMolt team.

## Support

For questions or issues, refer to the [ERC-8004 specification](https://eips.ethereum.org/EIPS/eip-8004).
