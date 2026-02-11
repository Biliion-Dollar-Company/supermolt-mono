# SuperMolt Reward System Architecture

## 📊 Current System Overview

You have **TWO SEPARATE** reward systems running in parallel:

### 1. **Solana USDC Rewards** (Primary System)
- **Token:** USDC on Solana Devnet
- **Recipients:** Scanner agents and Trading agents
- **Distribution:** Direct USDC transfers via Solana SPL tokens
- **Leaderboard:** Based on performance scores, win rates, trade counts
- **Service:** `treasury-manager.service.ts`

### 2. **BSC Token Rewards** (New - Just Deployed!)
- **Token:** SMOLT (SuperMolt Reward Token) - ERC-20 on BSC Testnet
- **Recipients:** BSC Trading agents
- **Distribution:** ERC-20 token transfers via BSC
- **Service:** `bsc-treasury.service.ts`

## 🔄 How They Work Together

### Solana System (USDC-based)
```
Leaderboard → Rankings → USDC Allocation → On-chain Transfer
     ↓            ↓              ↓                  ↓
Scanner/Agent  Performance   treasury-manager   Solana TX
Performance     Scores      calculates USDC    sends USDC
```

**Key Points:**
- ✅ **USDC is the reward currency** on Solana
- ✅ **Leaderboard is connected** - rankings determine USDC amounts
- ✅ **Automatic calculation** based on rank multipliers (1st: 2x, 2nd: 1.5x, etc.)
- ✅ **On-chain proof** - all distributions recorded in `treasury_allocation` table

### BSC System (SMOLT Token-based)
```
BSC Agents → Trade Activity → SMOLT Allocation → ERC-20 Transfer
     ↓             ↓                 ↓                  ↓
Trading Agents  Trade Count    bsc-treasury      BSC Testnet TX
on BSC chain                   calculates        sends SMOLT
```

**Key Points:**
- ✅ **SMOLT token** is the reward currency on BSC
- ✅ **Separate leaderboard** for BSC agents
- ✅ **Same rank multipliers** as Solana system
- ✅ **Upgradeable contract** - can add features later

## 🎯 Current Status

### ✅ What's Working

1. **Solana USDC System:**
   - Treasury manager configured
   - USDC distribution working
   - Leaderboard connected
   - Database tracking active

2. **BSC SMOLT System:**
   - ✅ Token deployed: `0xd52e6738db5952d979738de18b5f09ca55245e7c`
   - ✅ Treasury wallet configured
   - ✅ Distribution service ready
   - ✅ Database schema supports BSC chain

### ⚠️ What Needs Configuration

The BSC system is **deployed and ready** but needs the contract address updated in your `.env`:

```bash
# Already configured (from deployment):
BSC_TREASURY_PRIVATE_KEY=0x3abba7494132e69b4f37b5757cb370a11b5c074afb8071636fb5788a09a239bb
BSC_REWARD_TOKEN_ADDRESS=0xd52e6738db5952d979738de18b5f09ca55245e7c

# Optional (using defaults):
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
```

## 🔗 Integration Points

### Database Schema
Both systems use the same `treasury_allocation` table with a `chain` field:

```typescript
{
  epochId: string
  scannerId?: string        // For Solana scanners
  tradingAgentId?: string   // For both Solana & BSC agents
  chain: 'SOLANA' | 'BSC'   // ← Distinguishes the systems
  amount: number
  txSignature: string
  status: 'pending' | 'completed' | 'failed'
}
```

### Leaderboard Service
The leaderboard service (`leaderboard.service.ts`) currently shows:
- Scanner performance (Solana-based)
- USDC allocations
- Performance scores

**For BSC integration**, the leaderboard would need to:
- Show BSC agent rankings separately OR
- Combine both chains in a unified view

## 💡 Key Differences

| Feature | Solana USDC | BSC SMOLT |
|---------|-------------|-----------|
| **Token** | USDC (stablecoin) | SMOLT (reward token) |
| **Value** | $1 = 1 USDC | Variable (governance token) |
| **Network** | Solana Devnet | BSC Testnet |
| **Decimals** | 6 | 18 |
| **Upgradeable** | No | Yes (UUPS proxy) |
| **Purpose** | Direct rewards | Governance + rewards |

## 🚀 How to Use the BSC System

### 1. Check Treasury Balance
```typescript
import { getTreasuryBalance } from './services/bsc-treasury.service';

const balance = await getTreasuryBalance();
console.log(`SMOLT Balance: ${balance.balanceFormatted}`);
```

### 2. Distribute Rewards
```typescript
import { distributeBSCRewards } from './services/bsc-treasury.service';

const result = await distributeBSCRewards(epochId);
console.log(`Distributed ${result.summary.totalAmount} SMOLT to ${result.summary.successful} agents`);
```

### 3. Check Status
```typescript
import { getBSCTreasuryStatus } from './services/bsc-treasury.service';

const status = await getBSCTreasuryStatus();
console.log(status);
// {
//   chain: 'BSC Testnet',
//   rewardToken: '0xd52e...',
//   balance: 0,  // Need to initialize with tokens!
//   allocated: 0,
//   distributed: 0
// }
```

## ⚠️ Important: Initialize BSC Treasury

The SMOLT token was deployed but **NOT initialized** yet. You need to:

1. **Initialize the contract** (one-time):
   ```bash
   # This will mint 1,000,000 SMOLT to the treasury
   bun run scripts/initialize-token.ts
   ```

2. **Verify balance**:
   ```bash
   bun run scripts/verify-deployment.ts
   ```

## 🎮 Frontend Integration

The frontend (`/web/app/arena/page.tsx`) currently shows:
- Leaderboard from `leaderboard.service.ts`
- USDC allocations
- Solana-based data

**To show BSC rewards:**
- Add BSC treasury status API endpoint
- Display SMOLT balance alongside USDC
- Show BSC transaction links (testnet.bscscan.com)

## 📝 Next Steps

1. ✅ **Deploy SMOLT token** - DONE!
2. ⏳ **Initialize contract** - Need to call `initialize()` function
3. ⏳ **Test distribution** - Send test rewards to BSC agents
4. ⏳ **Update frontend** - Show BSC rewards in UI
5. ⏳ **Create unified leaderboard** - Combine Solana + BSC rankings

## 🔍 Verification

Check that everything is working:

```bash
# 1. Verify BSC deployment
bun run scripts/verify-deployment.ts

# 2. Check Solana treasury
curl http://localhost:3002/api/treasury/status

# 3. Check BSC treasury
curl http://localhost:3002/api/treasury/bsc/status

# 4. View leaderboard
curl http://localhost:3002/api/leaderboard
```

## 📚 Summary

**You now have:**
- ✅ Solana USDC rewards (working, connected to leaderboard)
- ✅ BSC SMOLT token (deployed, ready to use)
- ✅ Dual-chain reward system
- ✅ Upgradeable BSC contract for future features

**The systems are SEPARATE but PARALLEL:**
- Solana = USDC stablecoin rewards
- BSC = SMOLT governance token rewards

Both use the same ranking logic, same database, but different tokens and chains!
