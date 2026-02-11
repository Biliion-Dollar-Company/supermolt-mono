# BSC Integration Analysis & Action Plan

## ✅ Current State: Solana USDC System

### How It Works (CONFIRMED)

**Backend Flow:**
```
1. GET /arena/epoch/rewards
   ↓
2. arena.service.ts → getEpochRewards()
   ↓
3. treasuryManager.calculateAgentAllocations(epochId)
   ↓
4. Returns: { epoch, allocations[], treasury, distributions[] }
```

**Frontend Display:**
```
EpochRewardPanel.tsx
├── Shows epoch info (name, number, countdown)
├── Displays USDC pool amount
├── Lists projected allocations with:
│   ├── Rank (1st, 2nd, 3rd with trophy icons)
│   ├── Agent name
│   ├── USDC amount (with multipliers: 2x, 1.5x, 1x, 0.75x, 0.5x)
│   └── Status (preview/completed/failed)
└── Shows treasury balance
```

**Allocation Calculation (treasury-manager.service.ts):**
```typescript
// Lines 440-524
calculateAgentAllocations(epochId):
  1. Get all ACTIVE TradingAgents
  2. Rank by: trade_count DESC → sortino DESC → winRate DESC
  3. Apply multipliers: 1st=2x, 2nd=1.5x, 3rd=1x, 4th=0.75x, 5th=0.5x
  4. Performance adjustment: 0.5-1.0 based on trade activity
  5. Scale to fit within epoch.usdcPool
  6. Return allocations with USDC amounts
```

## 🔍 BSC System Status

### What Exists

**BSC Treasury Service** (`bsc-treasury.service.ts`):
- ✅ `getTreasuryBalance()` - Get SMOLT balance
- ✅ `distributeBSCRewards(epochId)` - Distribute to BSC agents
- ✅ `getBSCTreasuryStatus()` - Get treasury stats
- ✅ Uses same rank multipliers as Solana
- ✅ Filters agents by `chain: 'BSC'`
- ✅ Saves to `treasury_allocation` table with `chain: 'BSC'`

**Database Schema:**
```sql
treasury_allocation {
  epochId: string
  scannerId?: string        -- For Solana scanners
  tradingAgentId?: string   -- For both Solana & BSC agents
  chain: 'SOLANA' | 'BSC'   -- ✅ Distinguishes systems
  amount: number
  txSignature: string
  status: 'pending' | 'completed' | 'failed'
}
```

### ❌ What's Missing

**1. BSC Allocations NOT in Epoch Rewards Endpoint**

The `/arena/epoch/rewards` endpoint ONLY shows Solana USDC allocations:

```typescript
// arena.service.ts line 666
const calculated = await treasuryManager.calculateAgentAllocations(epoch.id);
// ↑ This ONLY calculates Solana USDC rewards
```

**BSC allocations are NOT included!**

**2. Frontend Doesn't Display BSC Rewards**

`EpochRewardPanel.tsx` only shows:
- USDC icon
- USDC amounts
- Solana explorer links

No BSC/SMOLT display!

**3. No BSC Allocation Calculation Endpoint**

There's no equivalent to:
```typescript
// Solana:
treasuryManager.calculateAgentAllocations(epochId)

// BSC: ❌ MISSING
bscTreasury.calculateBSCAllocations(epochId)
```

## 🎯 Required Changes

### Backend Changes

#### 1. Add BSC Allocation Calculation to `bsc-treasury.service.ts`

```typescript
export async function calculateBSCAllocations(epochId: string): Promise<{
  agentId: string;
  agentName: string;
  evmAddress: string;
  rank: number;
  smoltAmount: number;
  multiplier: number;
}[]> {
  const epoch = await db.scannerEpoch.findUnique({ where: { id: epochId } });
  if (!epoch) throw new Error(`Epoch ${epochId} not found`);

  // Get BSC agents only
  const bscAgents = await db.tradingAgent.findMany({
    where: { chain: 'BSC', status: 'ACTIVE', evmAddress: { not: null } },
  });

  if (bscAgents.length === 0) return [];

  // Rank by trade activity (same as Solana)
  const agentIds = bscAgents.map((a) => a.id);
  const tradeCounts = await db.agentTrade.groupBy({
    by: ['agentId'],
    where: { agentId: { in: agentIds }, chain: 'BSC' },
    _count: { agentId: true },
  });
  
  const tradeCountMap = new Map(tradeCounts.map((tc) => [tc.agentId, tc._count.agentId]));

  const ranked = bscAgents
    .map((agent) => ({
      agent,
      tradeCount: tradeCountMap.get(agent.id) || agent.totalTrades,
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount);

  const baseAllocation = Number(epoch.baseAllocation) || 200;
  
  return ranked.map((item, index) => {
    const rank = index + 1;
    const multiplier = RANK_MULTIPLIERS[rank] || 0.5;
    const performanceAdj = Math.max(0.5, Math.min(1.0, 
      item.tradeCount > 0 ? 0.7 + (item.tradeCount / 50) * 0.3 : 0.5
    ));
    const smoltAmount = Math.round(baseAllocation * multiplier * performanceAdj * 100) / 100;

    return {
      agentId: item.agent.id,
      agentName: item.agent.displayName || item.agent.name,
      evmAddress: item.agent.evmAddress!,
      rank,
      smoltAmount,
      multiplier,
    };
  });
}
```

#### 2. Update `arena.service.ts` → `getEpochRewards()`

Add BSC allocations to the response:

```typescript
export async function getEpochRewards() {
  const epoch = await db.scannerEpoch.findFirst({
    where: { status: { in: ['ACTIVE', 'ENDED', 'PAID'] } },
    orderBy: { startAt: 'desc' },
  });

  if (!epoch) {
    return {
      epoch: null,
      allocations: [],
      bscAllocations: [],  // ← ADD THIS
      treasury: { balance: 0, distributed: 0, available: 0 },
      bscTreasury: { balance: 0, distributed: 0, available: 0 },  // ← ADD THIS
      distributions: [],
      bscDistributions: [],  // ← ADD THIS
    };
  }

  // Existing Solana USDC allocations
  const allocations = await treasuryManager.calculateAgentAllocations(epoch.id);

  // NEW: BSC SMOLT allocations
  const { calculateBSCAllocations, getBSCTreasuryStatus } = await import('../../services/bsc-treasury.service');
  let bscAllocations = [];
  let bscTreasuryStatus = { balance: 0, distributed: 0, available: 0 };
  
  try {
    bscAllocations = await calculateBSCAllocations(epoch.id);
    const status = await getBSCTreasuryStatus();
    bscTreasuryStatus = {
      balance: status.balance,
      distributed: status.distributed,
      available: status.available,
    };
  } catch (error) {
    console.error('BSC allocations error:', error);
  }

  // ... rest of existing code ...

  return {
    epoch: { ... },
    allocations,  // Solana USDC
    bscAllocations,  // ← ADD THIS
    treasury: { ... },  // Solana treasury
    bscTreasury: bscTreasuryStatus,  // ← ADD THIS
    distributions,  // Solana distributions
    bscDistributions: [],  // ← ADD THIS (populate from DB if needed)
  };
}
```

### Frontend Changes

#### 3. Update `EpochRewardPanel.tsx`

Add BSC section below USDC section:

```tsx
{/* Existing USDC Pool Display */}
<div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
  <Image src="/icons/usdc.png" alt="USDC" width={32} height={32} />
  <span className="text-3xl font-bold font-mono text-accent-primary">
    {Math.round(epoch.usdcPool)}
  </span>
  <span className="text-sm text-text-muted">USDC Pool</span>
</div>

{/* NEW: BSC SMOLT Pool Display */}
{bscAllocations && bscAllocations.length > 0 && (
  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
      <span className="text-yellow-400 font-bold">S</span>
    </div>
    <span className="text-3xl font-bold font-mono text-yellow-400">
      {bscAllocations.reduce((sum, a) => sum + a.smoltAmount, 0).toFixed(0)}
    </span>
    <span className="text-sm text-text-muted">SMOLT Pool (BSC)</span>
    {bscTreasury.balance > 0 && (
      <span className="text-xs text-text-muted ml-auto">
        Treasury: {bscTreasury.balance.toFixed(2)}
      </span>
    )}
  </div>
)}

{/* Allocation Tables */}
<div className="space-y-6">
  {/* Solana USDC Allocations */}
  <div>
    <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
      Solana USDC Rewards
    </div>
    {/* ... existing allocation rows ... */}
  </div>

  {/* BSC SMOLT Allocations */}
  {bscAllocations && bscAllocations.length > 0 && (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
        BSC SMOLT Rewards
      </div>
      <div className="divide-y divide-white/[0.04]">
        {bscAllocations.map((alloc) => (
          <div key={alloc.agentId} className="flex items-center gap-4 py-2.5 px-3">
            <span className={`text-sm font-mono w-6 text-center ${
              alloc.rank === 1 ? 'text-yellow-400' : 
              alloc.rank === 2 ? 'text-gray-300' : 
              alloc.rank === 3 ? 'text-amber-600' : 'text-text-muted'
            }`}>
              {alloc.rank <= 3 ? <Trophy className="w-4 h-4 inline" /> : `#${alloc.rank}`}
            </span>
            <div className="flex-1">
              <span className="text-base text-text-primary">{alloc.agentName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-mono text-yellow-400">
                {alloc.smoltAmount.toFixed(2)}
              </span>
              <span className="text-xs text-yellow-400">SMOLT</span>
              <span className="text-[10px] font-mono text-text-muted bg-white/[0.06] px-1.5 py-0.5 rounded-full">
                {alloc.multiplier}x
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

#### 4. Update `web/lib/types.ts`

Add BSC fields to `EpochReward` type:

```typescript
export interface EpochReward {
  epoch: {
    id: string;
    name: string;
    number: number;
    startAt: string;
    endAt: string;
    status: string;
    usdcPool: number;
  } | null;
  allocations: AgentAllocation[];
  bscAllocations?: BSCAllocation[];  // ← ADD THIS
  treasury: {
    balance: number;
    distributed: number;
    available: number;
  };
  bscTreasury?: {  // ← ADD THIS
    balance: number;
    distributed: number;
    available: number;
  };
  distributions: Distribution[];
  bscDistributions?: Distribution[];  // ← ADD THIS
}

export interface BSCAllocation {  // ← ADD THIS
  agentId: string;
  agentName: string;
  evmAddress: string;
  rank: number;
  smoltAmount: number;
  multiplier: number;
  txHash?: string;
  status?: 'preview' | 'completed' | 'failed';
}
```

## 📋 Summary

### Current State
- ✅ Solana USDC rewards: **FULLY WORKING**
  - Leaderboard connected ✅
  - Epoch-based allocations ✅
  - Frontend displays estimates ✅
  - On-chain distribution ✅

- ⚠️ BSC SMOLT rewards: **DEPLOYED BUT NOT INTEGRATED**
  - Contract deployed ✅
  - Distribution service exists ✅
  - **NOT shown in frontend** ❌
  - **NOT in epoch rewards API** ❌

### Required Work
1. **Backend**: Add `calculateBSCAllocations()` function
2. **Backend**: Update `/arena/epoch/rewards` to include BSC data
3. **Frontend**: Update `EpochRewardPanel` to show both USDC and SMOLT
4. **Frontend**: Add BSC types to `types.ts`

### Estimated Effort
- Backend changes: ~30 minutes
- Frontend changes: ~45 minutes
- Testing: ~15 minutes
- **Total: ~1.5 hours**

## 🎯 Next Steps

Would you like me to:
1. **Implement all the changes above** to integrate BSC rewards into the epoch system?
2. **Just show USDC for now** and keep BSC separate?
3. **Create a separate BSC leaderboard** instead of combining them?
