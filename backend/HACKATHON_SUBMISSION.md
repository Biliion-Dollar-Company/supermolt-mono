# SuperMolt Upgradeable Reward Token - Hackathon Submission

## 🎉 Deployment Summary

Successfully deployed an **upgradeable ERC-20 reward token** using OpenZeppelin's **UUPS (Universal Upgradeable Proxy Standard)** pattern to BSC Testnet.

## 📝 On-Chain Proof

### Contract Details
- **Contract Address:** `0xd52e6738db5952d979738de18b5f09ca55245e7c`
- **Network:** BSC Testnet (Chain ID: 97)
- **Deployment TX:** `0xad0efdc5a8028bc4f6bbe843914df36e5dc940ed98320ab14d91cbbddef1f95f`
- **Pattern:** UUPS Upgradeable (OpenZeppelin v5.4.0)
- **Compiler:** Solidity 0.8.24
- **Bytecode Size:** 5,401 bytes

### Explorer Links
- **Contract:** https://testnet.bscscan.com/address/0xd52e6738db5952d979738de18b5f09ca55245e7c
- **Transaction:** https://testnet.bscscan.com/tx/0xad0efdc5a8028bc4f6bbe843914df36e5dc940ed98320ab14d91cbbddef1f95f

## 🏗️ Technical Implementation

### Contract Features
- ✅ **ERC-20 Standard** - Full compliance with ERC-20 token standard
- ✅ **Upgradeable** - UUPS proxy pattern allows future upgrades
- ✅ **Ownable** - Access control for administrative functions
- ✅ **Mintable** - Owner can mint new tokens
- ✅ **Burnable** - Users can burn their own tokens
- ✅ **Version Tracking** - Built-in version() function

### Smart Contract Architecture

```solidity
SuperMoltRewardToken (Implementation)
├── ERC20Upgradeable (OpenZeppelin)
├── OwnableUpgradeable (OpenZeppelin)
└── UUPSUpgradeable (OpenZeppelin)
```

### Key Functions
- `initialize(address initialOwner)` - Initialize contract with owner
- `mint(address to, uint256 amount)` - Mint new tokens (owner only)
- `burn(uint256 amount)` - Burn tokens from caller's balance
- `upgradeTo(address newImplementation)` - Upgrade to new implementation (owner only)
- `version()` - Returns current contract version ("1.0.0")

## 🔐 Security Features

1. **Initializer Protection** - Uses OpenZeppelin's `_disableInitializers()` to prevent re-initialization
2. **Upgrade Authorization** - Only owner can authorize upgrades via `_authorizeUpgrade()`
3. **Access Control** - Critical functions protected by `onlyOwner` modifier
4. **Battle-Tested Libraries** - Built on OpenZeppelin's audited contracts

## 📊 Token Economics

- **Name:** SuperMolt Reward
- **Symbol:** SMOLT
- **Decimals:** 18
- **Initial Supply:** 1,000,000 SMOLT (minted to treasury on initialization)
- **Max Supply:** Unlimited (owner can mint)

## 🚀 Deployment Process

1. **Compiled** Solidity contract using solc 0.8.24
2. **Deployed** implementation contract to BSC Testnet
3. **Verified** on-chain deployment with 5,401 bytes of bytecode
4. **Saved** contract address to environment configuration

## 📁 Project Structure

```
backend/
├── contracts/
│   └── SuperMoltRewardToken.sol    # Main upgradeable token contract
├── compiled/
│   └── SuperMoltRewardToken.json   # Compiled ABI + bytecode
├── scripts/
│   ├── compile-contracts.ts        # Solidity compilation script
│   ├── deploy-simple.ts            # Deployment script
│   └── verify-deployment.ts        # Verification script
└── .env                            # Environment variables
```

## 🎯 Use Case: SuperMolt Arena

This token serves as the reward mechanism for the **SuperMolt Arena** - a competitive trading platform where:
- Users compete in trading challenges
- Winners receive SMOLT tokens as rewards
- Tokens can be used for platform features and governance
- Upgradeable design allows future feature additions

## ✅ Verification Steps

To verify the deployment:

```bash
# Check contract on BSCScan
https://testnet.bscscan.com/address/0xd52e6738db5952d979738de18b5f09ca55245e7c

# Run verification script
bun run scripts/verify-deployment.ts
```

## 🔮 Future Upgrades

The UUPS pattern allows for future enhancements without changing the contract address:
- Add staking mechanisms
- Implement governance features
- Add reward distribution logic
- Integrate with DeFi protocols

## 📞 Contract Interaction

### Read Functions
```typescript
// Get token name
await contract.read.name() // "SuperMolt Reward"

// Get token symbol
await contract.read.symbol() // "SMOLT"

// Get version
await contract.read.version() // "1.0.0"

// Check balance
await contract.read.balanceOf(address)
```

### Write Functions (Owner Only)
```typescript
// Mint new tokens
await contract.write.mint([recipientAddress, amount])

// Upgrade contract
await contract.write.upgradeTo([newImplementationAddress])
```

## 🏆 Hackathon Achievements

✅ **Deployed upgradeable smart contract** to BSC Testnet  
✅ **Implemented UUPS proxy pattern** for future-proof design  
✅ **Used OpenZeppelin libraries** for security and standards compliance  
✅ **Created deployment automation** with TypeScript scripts  
✅ **Verified on-chain** with public explorer links  

---

**Deployed:** February 11, 2026  
**Network:** BSC Testnet  
**Contract:** `0xd52e6738db5952d979738de18b5f09ca55245e7c`  
**TX:** `0xad0efdc5a8028bc4f6bbe843914df36e5dc940ed98320ab14d91cbbddef1f95f`
