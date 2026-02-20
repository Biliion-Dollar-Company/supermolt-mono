# ERC-8004 Quick Reference Card

## 🚀 Quick Start

```bash
# Build contracts
forge build

# Run tests
forge test -vv

# Deploy to Sepolia
source .env
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast --verify
```

## 📜 Contract Addresses

Update `deployments.json` after deployment:

```json
{
  "sepolia": {
    "identityRegistry": "0x...",
    "reputationRegistry": "0x...",
    "validationRegistry": "0x..."
  }
}
```

## 🔧 Common Operations

### Register Agent
```bash
cast send <IDENTITY_REGISTRY> \
  "register(string)" "ipfs://metadata" \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### Give Feedback
```bash
cast send <REPUTATION_REGISTRY> \
  "giveFeedback(uint256,int128,uint8,string,string,string)" \
  1 85 0 "trading" "accuracy" "ipfs://feedback" \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### Request Validation
```bash
# Generate hash first
cast call <VALIDATION_REGISTRY> \
  "generateRequestHash(address,uint256,string,uint256)" \
  <VALIDATOR> 1 "ipfs://request" 12345

# Then request
cast send <VALIDATION_REGISTRY> \
  "validationRequest(address,uint256,string,bytes32)" \
  <VALIDATOR> 1 "ipfs://request" <HASH> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## 📊 Read Operations

### Get Agent Info
```bash
# Owner
cast call <IDENTITY_REGISTRY> "ownerOf(uint256)" 1

# Token URI
cast call <IDENTITY_REGISTRY> "tokenURI(uint256)" 1

# Wallet
cast call <IDENTITY_REGISTRY> "getAgentWallet(uint256)" 1

# Metadata
cast call <IDENTITY_REGISTRY> "getMetadata(uint256,string)" 1 "name"
```

### Get Reputation
```bash
# Summary (requires client addresses array)
cast call <REPUTATION_REGISTRY> \
  "getSummary(uint256,address[])" \
  1 "[0xClient1,0xClient2]"

# Feedback count
cast call <REPUTATION_REGISTRY> \
  "getFeedbackCount(uint256,address)" 1 0xClient
```

### Get Validation Status
```bash
cast call <VALIDATION_REGISTRY> \
  "getValidationStatus(bytes32)" <HASH>
# Returns: 0=Pending, 1=Approved, 2=Rejected, 3=NeedsInfo
```

## 💻 TypeScript Usage

```typescript
import { createERC8004Client } from './backend/src/contracts';

// Initialize
const client = createERC8004Client(
  process.env.RPC_URL,
  'sepolia',
  process.env.PRIVATE_KEY
);

// Register agent
const agentId = await client.registerAgent('ipfs://metadata');

// Set metadata
await client.setAgentMetadata(agentId, 'name', 'Liquidity Sniper');

// Give feedback
const feedbackIndex = await client.giveFeedback(
  agentId, 85, 0, 'trading', 'accuracy', 'ipfs://feedback'
);

// Get reputation
const summary = await client.getReputationSummary(
  agentId,
  ['0xClient1', '0xClient2']
);
console.log(`Average: ${summary.averageValue}`);
```

## 🧪 Test Specific Contract

```bash
# Test only identity registry
forge test --match-contract AgentIdentityRegistry -vv

# Test only reputation registry
forge test --match-contract AgentReputationRegistry -vv

# Test only validation registry
forge test --match-contract AgentValidationRegistry -vv

# Test specific function
forge test --match-test testRegisterAgent -vvv
```

## 🔍 Debug Commands

```bash
# Check compilation
forge build --force

# Gas report
forge test --gas-report

# Coverage
forge coverage

# Check contract size
forge build --sizes

# Format code
forge fmt

# Lint
forge lint
```

## 📦 Export ABIs

```bash
# ABIs are in out/ after build
cp out/AgentIdentityRegistry.sol/AgentIdentityRegistry.json \
   ../backend/src/contracts/abis/

cp out/AgentReputationRegistry.sol/AgentReputationRegistry.json \
   ../backend/src/contracts/abis/

cp out/AgentValidationRegistry.sol/AgentValidationRegistry.json \
   ../backend/src/contracts/abis/
```

## 🌐 Networks

### Sepolia Testnet
- Chain ID: 11155111
- RPC: https://sepolia.infura.io/v3/YOUR_KEY
- Explorer: https://sepolia.etherscan.io
- Faucet: https://sepoliafaucet.com

### Arbitrum Sepolia
- Chain ID: 421614
- RPC: https://arbitrum-sepolia.infura.io/v3/YOUR_KEY
- Explorer: https://sepolia.arbiscan.io
- Faucet: https://bwarelabs.com/faucets/arbitrum-sepolia

### Arbitrum One
- Chain ID: 42161
- RPC: https://arbitrum-mainnet.infura.io/v3/YOUR_KEY
- Explorer: https://arbiscan.io

## 🔐 Security Checklist

- [ ] Private keys in `.env` (never commit!)
- [ ] `.env` in `.gitignore`
- [ ] Test on testnet first
- [ ] Verify contracts on explorer
- [ ] Check gas prices before mainnet
- [ ] Use hardware wallet for production

## 📚 Documentation

- **README.md** - Project overview
- **DEPLOYMENT.md** - Deployment guide
- **PHASE1_COMPLETE.md** - Completion summary
- **example.ts** - TypeScript usage examples

## 🆘 Troubleshooting

### Compilation errors
```bash
forge clean
forge install --no-commit
forge build
```

### Test failures
```bash
forge test -vvvv  # Extra verbose
forge test --debug testFunctionName  # Interactive debugger
```

### Deployment issues
```bash
# Check balance
cast balance <YOUR_ADDRESS> --rpc-url $RPC_URL

# Check nonce
cast nonce <YOUR_ADDRESS> --rpc-url $RPC_URL

# Simulate deployment (no broadcast)
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL
```

## 📞 Support

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- Foundry: https://book.getfoundry.sh
- Ethers.js: https://docs.ethers.org/v6
- OpenZeppelin: https://docs.openzeppelin.com/contracts/5.x
