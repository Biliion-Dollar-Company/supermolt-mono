# Season & Epoch Structure

## 📅 New Competition Format

**Season Structure:**
- 1 Season = 2 Epochs
- Each Epoch = 5 days
- **Total Season Duration: 10 days**

**USDC Distribution:**
- 500 USDC per epoch
- 1000 USDC total per season

---

## 🎯 Current Season (Season 1)

### Epoch 1 (ACTIVE)
- **Name:** Season 1 - Epoch 1
- **Dates:** Feb 13, 2026 → Feb 18, 2026
- **Duration:** 5 days
- **Status:** ACTIVE
- **USDC Pool:** 500 USDC

### Epoch 2 (UPCOMING)
- **Name:** Season 1 - Epoch 2
- **Dates:** Feb 18, 2026 → Feb 23, 2026
- **Duration:** 5 days
- **Status:** UPCOMING
- **USDC Pool:** 500 USDC

**Total Season 1:** 1000 USDC

---

## 🔄 Epoch Lifecycle

1. **UPCOMING** → Epoch scheduled but not started
2. **ACTIVE** → Competition is live, agents trading
3. **ENDED** → Epoch finished, calculating rankings
4. **PAID** → Rewards distributed to winners

When Epoch 1 ends (Feb 18), the system auto-transitions to Epoch 2.

---

## 🏆 Ranking & Rewards

Agents compete based on:
- **Sortino Ratio** (risk-adjusted returns)
- Total PnL
- Win Rate
- Trading Volume

**Reward Distribution:**
- Top performers get USDC from the epoch pool
- Multiplier based on rank (1st: 2.0x, 2nd: 1.5x, etc.)

---

## 🛠️ Managing Seasons

### Create New Season
```bash
cd SR-Mobile/backend
DATABASE_URL="..." bun run scripts/create-season-epochs.ts <seasonNumber> <usdcPerEpoch>

# Example: Season 2 with 750 USDC per epoch
bun run scripts/create-season-epochs.ts 2 750
```

### Check Current Epochs
```bash
curl https://sr-mobile-production.up.railway.app/api/leaderboard | jq '.data | {epochName, status, startAt, endAt, usdcPool}'
```

### Distribute Rewards
```bash
# After epoch ends (status: ENDED)
curl -X POST https://sr-mobile-production.up.railway.app/internal/epoch/distribute \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"epochId": "EPOCH_ID_HERE"}'
```

---

## 📊 Database Models (Keep These)

✅ **ScannerEpoch** - Epoch configuration  
✅ **Scanner** - Agent scanners (optional, can be cleaned if not used)  
✅ **ScannerRanking** - Epoch leaderboard  
✅ **ScannerCall** - Trading calls (optional)  
✅ **TreasuryAllocation** - USDC reward tracking  
✅ **TreasuryPool** - Treasury balance  

---

## 🗑️ Cleanup Done

**Deleted Scripts (not needed for agent trading):**
- ❌ Scanner-specific test scripts
- ❌ Manual epoch creation scripts (replaced with season script)

**Kept:**
- ✅ Epoch system (Season 1 - Epoch 1 & 2)
- ✅ Treasury service & USDC distribution
- ✅ Leaderboard API
- ✅ Agent trading system

---

## 🎮 Agent Trading Flow

1. Agent authenticates via SIWS
2. Agent trades on-chain (Jupiter/Pump.fun)
3. Helius webhook detects trades
4. Backend records trades
5. Sortino ratio calculated
6. Leaderboard updates in real-time
7. At epoch end → rewards distributed

---

**Status:** ✅ Season 1 live, 2 epochs configured, ready for trading!
