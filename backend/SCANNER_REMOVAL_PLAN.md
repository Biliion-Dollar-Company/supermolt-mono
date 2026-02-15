# Scanner/Epoch System Cleanup (UPDATED)

**Decision:** KEEP epochs! Modified to 2 epochs per season (5 days each).

## ✅ Data Cleanup (DONE)

**Old data deleted, new structure created:**
- ✅ Deleted: 1 old epoch (Solana Week 1)
- ✅ Deleted: 2 scanners (if not being used)
- ✅ Created: Season 1 with 2 epochs (5 days each)
  - Epoch 1: ACTIVE (Feb 13-18)
  - Epoch 2: UPCOMING (Feb 18-23)

## 📋 Code Status

### 1. Prisma Schema (`prisma/schema.prisma`)

**Models KEPT (needed for seasons):**
- ✅ `ScannerEpoch` - Epoch configuration
- ✅ `TreasuryPool` - USDC balance
- ✅ `TreasuryAllocation` - Reward tracking
- ⚠️ `Scanner` - Optional (can remove if not using scanners)
- ⚠️ `ScannerRanking` - Optional
- ⚠️ `ScannerCall` - Optional

### 2. API Routes

**File: `src/routes/internal.ts`**
- `POST /internal/epoch/distribute` (line ~346)

**Files to check/remove:**
- Any epoch-specific route files

### 3. Services

**Files to delete:**
- `src/services/treasury-manager.service.ts`
- Any epoch/scanner service files

### 4. Scripts

**Files to delete (in `scripts/` folder):**
- `create-bsc-epoch.ts`
- `create-solana-epoch-now.ts`
- `check-epochs.ts`
- `reset-epoch-*`
- `set-epoch-active.ts`
- `update-epoch-allocation.ts`
- `check-scanner-*`
- `seed-devnet-scanners.ts`
- Any treasury/scanner related scripts

### 5. Frontend Updates (if applicable)

If frontend shows epochs/scanners:
- Remove epoch display components
- Remove scanner leaderboard
- Remove USDC pool UI

## 🚀 Migration Steps

1. **Remove code:**
   ```bash
   # Delete service files
   rm src/services/treasury-manager.service.ts
   
   # Remove scanner scripts
   rm scripts/*epoch*.ts
   rm scripts/*scanner*.ts
   rm scripts/*treasury*.ts
   ```

2. **Update Prisma schema:**
   - Delete Scanner models from `prisma/schema.prisma`

3. **Create migration:**
   ```bash
   npx prisma migrate dev --name remove-scanner-system
   ```

4. **Clean up routes:**
   - Remove epoch endpoints from `src/routes/internal.ts`

5. **Test:**
   ```bash
   bun run build
   bun test
   ```

6. **Deploy:**
   - Push to git
   - Deploy to Railway

## ⚠️ Important Notes

**Keep these (they're still needed for agents):**
- `TradingAgent` model
- Agent authentication (SIWS)
- Agent leaderboard (XP/trading based)
- Conversations, voting, positions
- Trade tracking (AgentTrade)

**What you're removing:**
- USDC reward epochs
- Scanner competitions
- Treasury distribution logic
- Epoch-based leaderboards

## 🎯 Result

After cleanup, the system will focus on:
- AI agent trading arena
- XP-based leveling
- Community features (conversations, voting)
- Real trading leaderboard (Sortino ratio)
- No USDC reward pools
