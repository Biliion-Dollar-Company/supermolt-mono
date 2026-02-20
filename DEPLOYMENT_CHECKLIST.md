# Deployment Checklist - ERC-8004 for SuperMolt

## ✅ Phase 1: Smart Contracts (COMPLETE)

- [x] Set up Foundry project
- [x] Install OpenZeppelin Contracts v5.5.0
- [x] Build AgentIdentityRegistry.sol
- [x] Build AgentReputationRegistry.sol
- [x] Build AgentValidationRegistry.sol
- [x] Write comprehensive tests (39 tests)
- [x] All tests passing
- [x] Create deployment script
- [x] Export ABIs to backend
- [x] Create TypeScript SDK
- [x] Write documentation

## 🔄 Phase 2: Deployment to Testnet (NEXT)

### Prerequisites
- [ ] Get Sepolia testnet ETH from faucet
  - https://sepoliafaucet.com/
  - https://www.alchemy.com/faucets/ethereum-sepolia
- [ ] Get Infura/Alchemy API key
  - https://infura.io/ or https://alchemy.com/
- [ ] Get Etherscan API key (for verification)
  - https://etherscan.io/apis

### Deployment Steps

1. **Configure Environment**
   ```bash
   cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt/contracts
   cp .env.example .env
   # Edit .env with your keys
   ```

2. **Deploy to Sepolia**
   ```bash
   source .env
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url $SEPOLIA_RPC_URL \
     --broadcast --verify
   ```

3. **Save Contract Addresses**
   - [ ] Copy addresses from deployment output
   - [ ] Update `deployments.json`
   - [ ] Commit to git

4. **Verify on Etherscan**
   - [ ] Check AgentIdentityRegistry on Sepolia Etherscan
   - [ ] Check AgentReputationRegistry on Sepolia Etherscan
   - [ ] Check AgentValidationRegistry on Sepolia Etherscan

5. **Test Contract Interactions**
   ```bash
   # Register test agent
   cast send <IDENTITY_REGISTRY_ADDRESS> \
     "register(string)" "ipfs://test-agent" \
     --rpc-url $SEPOLIA_RPC_URL \
     --private-key $PRIVATE_KEY
   
   # Get agent ID from transaction logs
   cast logs <TX_HASH> --rpc-url $SEPOLIA_RPC_URL
   
   # Give feedback
   cast send <REPUTATION_REGISTRY_ADDRESS> \
     "giveFeedback(uint256,int128,uint8,string,string,string)" \
     1 85 0 "trading" "accuracy" "ipfs://feedback" \
     --rpc-url $SEPOLIA_RPC_URL \
     --private-key $PRIVATE_KEY
   ```

## 🔄 Phase 3: Backend Integration (PENDING)

### Install Dependencies
```bash
cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt/backend
npm install ethers@^6.0.0
npm install --save-dev @types/node
```

### Create Routes

1. **Create Agent Routes** (`backend/src/routes/erc8004.routes.ts`)
   - [ ] `POST /api/erc8004/agents/register`
   - [ ] `GET /api/erc8004/agents/:id`
   - [ ] `POST /api/erc8004/agents/:id/wallet`
   - [ ] `POST /api/erc8004/agents/:id/metadata`
   - [ ] `GET /api/erc8004/agents/:id/metadata/:key`

2. **Create Reputation Routes**
   - [ ] `POST /api/erc8004/agents/:id/feedback`
   - [ ] `GET /api/erc8004/agents/:id/reputation`
   - [ ] `GET /api/erc8004/agents/:id/feedback`
   - [ ] `DELETE /api/erc8004/agents/:id/feedback/:index`

3. **Create Validation Routes**
   - [ ] `POST /api/erc8004/agents/:id/validation/request`
   - [ ] `POST /api/erc8004/validation/:hash/respond`
   - [ ] `GET /api/erc8004/agents/:id/validations`
   - [ ] `GET /api/erc8004/agents/:id/validation-stats`

### Integrate with Existing Code

1. **Update Agent Service**
   - [ ] Import ERC8004Client
   - [ ] Register agent on blockchain when created
   - [ ] Sync metadata to blockchain
   - [ ] Store blockchain agent ID in database

2. **Add Blockchain Sync Service**
   - [ ] Listen for on-chain events
   - [ ] Sync reputation data
   - [ ] Cache validation status
   - [ ] Update agent stats

3. **Test Integration**
   - [ ] Register Liquidity Sniper agent
   - [ ] Submit test feedback
   - [ ] Request validation
   - [ ] Verify all data on Etherscan

## 🔄 Phase 4: Production Deployment (PENDING)

### Deploy to Arbitrum Sepolia (for Hackathon)

1. **Get Arbitrum Sepolia ETH**
   - [ ] Bridge from Sepolia to Arbitrum Sepolia
   - Or use faucet: https://bwarelabs.com/faucets/arbitrum-sepolia

2. **Deploy Contracts**
   ```bash
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
     --broadcast --verify
   ```

3. **Update deployments.json**
   - [ ] Add Arbitrum Sepolia addresses

4. **Test on Arbitrum**
   - [ ] Register agent
   - [ ] Submit feedback
   - [ ] Verify on Arbiscan

### Deploy to Arbitrum Mainnet (Production)

⚠️ **Only when ready for production!**

1. **Security Audit**
   - [ ] Code review by senior dev
   - [ ] Test all edge cases
   - [ ] Verify gas costs

2. **Deploy to Mainnet**
   ```bash
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url $ARBITRUM_RPC_URL \
     --broadcast --verify
   ```

3. **Monitor Deployment**
   - [ ] Verify contracts on Arbiscan
   - [ ] Test with small amounts first
   - [ ] Monitor gas costs

## 📋 Pre-Hackathon Submission

- [ ] All 19 agents registered on Arbitrum
- [ ] Liquidity Sniper fully integrated
- [ ] Reputation system working
- [ ] Validation workflow tested
- [ ] Documentation complete
- [ ] Demo video recorded
- [ ] API documentation published
- [ ] Submit to Surge Hackathon

## 🎯 Success Criteria

- ✅ Smart contracts deployed and verified
- ✅ Backend integration complete
- ✅ All agents registered on-chain
- ✅ Reputation tracking functional
- ✅ Validation system operational
- ✅ Documentation comprehensive
- ✅ Ready for hackathon submission

## 📞 Resources

- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Infura**: https://infura.io/
- **Etherscan**: https://etherscan.io/
- **Arbiscan**: https://arbiscan.io/
- **ERC-8004 Spec**: https://eips.ethereum.org/EIPS/eip-8004
- **Foundry Docs**: https://book.getfoundry.sh/

---

**Current Status**: Phase 1 Complete ✅  
**Next Action**: Deploy to Sepolia Testnet  
**Timeline**: Phase 2-3 (5 days), Phase 4 (2 days)
