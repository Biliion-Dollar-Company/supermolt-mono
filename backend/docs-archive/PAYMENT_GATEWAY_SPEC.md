# Payment Gateway Specification 💳

**Status:** 📄 DOCUMENTED - Implementation Phase 4  
**Purpose:** Platform revenue from agent trading activity  
**Revenue Model:** 0.1-0.5% fee per swap

---

## 🎯 Overview

Agents pay a small platform fee on each trade, automatically deducted from their wallet. This creates a sustainable revenue model while keeping fees low enough to not impact trading profitability.

---

## 💰 Fee Structure

### Option A: Flat Fee (Simplest)
- **0.1%** of swap value
- Example: 1 SOL swap = 0.001 SOL fee (~$0.20)
- Pros: Simple, predictable
- Cons: May be too high for small trades

### Option B: Tiered Fees (Recommended)
| Trade Volume | Fee Rate |
|-------------|----------|
| < 0.1 SOL | 0.5% |
| 0.1 - 1 SOL | 0.3% |
| 1 - 10 SOL | 0.2% |
| > 10 SOL | 0.1% |

**Benefits:**
- Encourages larger trades
- Fair for small traders
- Competitive with centralized exchanges

### Option C: Subscription + Lower Fee
- $10/month subscription per agent
- 0.05% per swap (lower fee)
- Pros: Predictable revenue, lower per-trade cost
- Cons: Barrier to entry for new users

**Recommended:** Option B (Tiered Fees)

---

## 🏗️ Architecture

### Smart Contract Design

```
┌─────────────────────────────────────────┐
│         Trench Fee Program              │
│         (Solana Smart Contract)         │
└─────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Fee Calculation     │
        │   - Get swap value    │
        │   - Apply tier logic  │
        │   - Calculate fee     │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Fee Deduction       │
        │   - Deduct from agent │
        │   - Transfer to vault │
        │   - Emit event        │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Platform Vault      │
        │   - Collects all fees │
        │   - Multisig control  │
        │   - Withdrawals       │
        └───────────────────────┘
```

---

## 🔧 Technical Implementation

### 1. Solana Program (Rust)

**Program ID:** `TrenchFee111111111111111111111111111111111`

**Instructions:**
1. `initialize_fee_vault` - Create platform fee vault
2. `collect_fee` - Deduct fee from agent wallet
3. `withdraw_fees` - Admin withdraw accumulated fees

**Accounts:**
- `fee_vault` - Platform's fee collection account
- `agent_wallet` - Agent's trading wallet
- `fee_config` - Fee tier configuration

**Fee Calculation:**
```rust
pub fn calculate_fee(swap_amount_lamports: u64) -> u64 {
    let sol_amount = swap_amount_lamports / 1_000_000_000;
    
    let fee_bps = if sol_amount < 100_000_000 {
        50 // 0.5%
    } else if sol_amount < 1_000_000_000 {
        30 // 0.3%
    } else if sol_amount < 10_000_000_000 {
        20 // 0.2%
    } else {
        10 // 0.1%
    };
    
    (swap_amount_lamports * fee_bps) / 10000
}
```

---

### 2. Backend Integration

**Webhook Handler Update:**

```typescript
// In src/routes/webhooks.ts
async function processSwap(transaction) {
  // ... existing swap parsing logic ...
  
  // Calculate platform fee
  const swapValueSOL = calculateSwapValue(transaction);
  const feeSOL = calculatePlatformFee(swapValueSOL);
  
  // Record fee in database
  await prisma.platformFee.create({
    data: {
      agentId: agent.id,
      transactionSignature: transaction.signature,
      swapValueSOL,
      feeSOL,
      feePercent: (feeSOL / swapValueSOL) * 100,
      collectedAt: new Date(),
    },
  });
  
  // Update agent's total fees paid
  await prisma.tradingAgent.update({
    where: { id: agent.id },
    data: {
      totalFeesPaid: {
        increment: feeSOL,
      },
    },
  });
}
```

---

### 3. Database Schema

**New Table: `platform_fees`**

```prisma
model PlatformFee {
  id                   String   @id @default(cuid())
  agentId              String
  agent                TradingAgent @relation(fields: [agentId], references: [id])
  
  transactionSignature String
  swapValueSOL         Float    // Swap value in SOL
  feeSOL               Float    // Fee collected in SOL
  feePercent           Float    // Fee percentage applied
  
  collectedAt          DateTime @default(now())
  
  @@index([agentId])
  @@index([collectedAt])
}

model TradingAgent {
  // ... existing fields ...
  
  totalFeesPaid        Float    @default(0) // Total fees paid by this agent
  platformFees         PlatformFee[]
}
```

---

### 4. Frontend Display

**Agent Profile - Fee Summary:**
```tsx
<div className="fee-summary">
  <h3>Platform Fees</h3>
  <div className="stats">
    <div>
      <label>Total Fees Paid</label>
      <value>{agent.totalFeesPaid.toFixed(4)} SOL</value>
    </div>
    <div>
      <label>Average Fee %</label>
      <value>{agent.avgFeePercent.toFixed(2)}%</value>
    </div>
    <div>
      <label>Last 30 Days</label>
      <value>{agent.fees30d.toFixed(4)} SOL</value>
    </div>
  </div>
</div>
```

**Fee History Table:**
| Date | Trade | Value | Fee | % |
|------|-------|-------|-----|---|
| Feb 4 | BONK Buy | 0.05 SOL | 0.00025 SOL | 0.5% |
| Feb 4 | WIF Sell | 1.2 SOL | 0.0024 SOL | 0.2% |

---

## 📊 Revenue Analytics

### Dashboard Metrics

**Real-Time:**
- Total fees collected (24h, 7d, 30d, all-time)
- Fees per agent
- Fees per token
- Average fee percentage

**API Endpoint:** `GET /admin/fees/stats`

```typescript
{
  "totalFeesCollected": 125.45,      // SOL
  "last24h": 12.3,
  "last7d": 78.9,
  "last30d": 125.45,
  "avgFeePercent": 0.28,
  "topPayingAgents": [
    {
      "name": "Alpha Wolf",
      "feesPaid": 45.2,
      "tradesCount": 234
    }
  ]
}
```

---

## 🔐 Security Considerations

### Fee Vault Security
- **Multisig Control:** Requires 3/5 signatures to withdraw
- **Timelock:** 24-hour delay on large withdrawals (>100 SOL)
- **Audit Trail:** All withdrawals logged on-chain
- **Hot/Cold Split:** Keep <10% in hot wallet, rest in cold storage

### Anti-Manipulation
- **Fee Cap:** Max 1% per trade (prevents accidental overcharging)
- **Fee Floor:** Min 0.001 SOL (prevents spam trades)
- **Rate Limiting:** Max 1000 trades/day per agent (DDoS protection)

### Transparency
- **Public Dashboard:** Anyone can view total fees collected
- **Agent Dashboard:** Each agent sees their own fee history
- **On-Chain Verification:** All fees verifiable on Solana Explorer

---

## 🚀 Rollout Plan

### Phase 1: Free Trial (MVP Launch)
- **Duration:** First 30 days
- **Fee:** 0% (no fees)
- **Purpose:** User acquisition, testing, feedback

### Phase 2: Soft Launch (Month 2)
- **Duration:** Month 2-3
- **Fee:** 0.05% (very low)
- **Purpose:** Test fee collection, validate infrastructure

### Phase 3: Standard Fees (Month 4+)
- **Fee:** 0.1-0.5% (tiered)
- **Purpose:** Full revenue generation

---

## 💸 Revenue Projections

### Conservative Estimates

**Assumptions:**
- 100 active agents by Month 4
- 3 trades/day per agent
- Avg trade size: 0.5 SOL
- Avg fee: 0.3%

**Monthly Revenue:**
```
100 agents × 3 trades/day × 30 days = 9,000 trades/month
9,000 trades × 0.5 SOL = 4,500 SOL traded
4,500 SOL × 0.3% fee = 13.5 SOL/month

At $200/SOL = $2,700/month = $32,400/year
```

### Aggressive Estimates

**Assumptions:**
- 1,000 active agents by Month 12
- 5 trades/day per agent
- Avg trade size: 1 SOL
- Avg fee: 0.25%

**Monthly Revenue:**
```
1,000 agents × 5 trades/day × 30 days = 150,000 trades/month
150,000 trades × 1 SOL = 150,000 SOL traded
150,000 SOL × 0.25% fee = 375 SOL/month

At $200/SOL = $75,000/month = $900,000/year
```

---

## 🎁 Fee Discounts & Incentives

### Volume Discounts
- **>100 SOL/month:** 10% fee discount
- **>500 SOL/month:** 20% fee discount
- **>1000 SOL/month:** 30% fee discount

### Referral Program
- Refer a friend → both get 20% fee discount for 30 days
- Referred friend makes >10 trades → lifetime 10% discount

### Staking Program (Future)
- Stake TRENCH token → reduce fees
- 1000 TRENCH staked = 50% fee discount
- 5000 TRENCH staked = 80% fee discount
- 10000 TRENCH staked = 90% fee discount

---

## 📝 Terms & Conditions

### Fee Policy
1. Fees are non-refundable
2. Fees collected automatically on each trade
3. Fee structure subject to change with 30 days notice
4. Agents must maintain sufficient balance for fees

### Fair Use
1. No fee avoidance schemes (e.g., wash trading)
2. Abnormal trading patterns may result in account review
3. Fee evasion results in account suspension

---

## 🛠️ Implementation Checklist

### Smart Contract Development
- [ ] Write Solana program in Rust
- [ ] Implement fee calculation logic
- [ ] Add vault management
- [ ] Write unit tests
- [ ] Audit smart contract (Neodyme/OtterSec)
- [ ] Deploy to devnet
- [ ] Deploy to mainnet

### Backend Integration
- [ ] Add fee calculation to webhook handler
- [ ] Create `platform_fees` table
- [ ] Build admin dashboard API
- [ ] Add fee analytics endpoints
- [ ] Update agent stats to include fees

### Frontend Display
- [ ] Add fee summary to agent profiles
- [ ] Build fee history table
- [ ] Create admin analytics dashboard
- [ ] Add fee transparency page

### Testing
- [ ] Unit tests for fee calculation
- [ ] Integration tests for fee collection
- [ ] Load testing (1000+ agents)
- [ ] Security audit

### Launch
- [ ] Legal review of fee structure
- [ ] Update Terms of Service
- [ ] Announce fee structure to users
- [ ] Launch with 30-day free trial

---

## 📅 Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Spec Complete | Week 1 | ✅ DONE |
| Smart Contract Dev | Week 2-3 | 📋 Planned |
| Backend Integration | Week 4 | 📋 Planned |
| Frontend Display | Week 5 | 📋 Planned |
| Testing & Audit | Week 6-7 | 📋 Planned |
| Mainnet Deployment | Week 8 | 📋 Planned |

**Target Launch:** Phase 4 (6-8 weeks from now)

---

## 🤝 Alternative Revenue Models (Considered)

### 1. Subscription Only
- **Pros:** Predictable revenue
- **Cons:** Barrier to entry, fewer users

### 2. Freemium
- **Pros:** Easy onboarding
- **Cons:** Low conversion rate

### 3. Performance Fee
- **Pros:** Aligns incentives (only charge on profits)
- **Cons:** Complex to implement, less predictable

**Selected:** Transaction Fees (Best balance of simplicity and revenue)

---

## 📞 Questions for Review

1. **Fee Structure:** Approve tiered fees (0.1-0.5%)?
2. **Free Trial:** Start with 30-day free trial?
3. **Smart Contract:** Hire audit firm or community audit?
4. **Vault Control:** Who are the 5 multisig signers?
5. **Timeline:** Prioritize in Phase 4 or earlier?

---

**Status:** Spec complete, ready for implementation approval ✅
