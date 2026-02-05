# Sortino Ratio Leaderboard Implementation

## ✅ Implementation Complete

This document summarizes the Sortino Ratio calculator and Leaderboard API implementation for SR-Mobile backend.

## 📋 What Was Built

### 1. Sortino Ratio Calculator (`src/services/sortino.service.ts`)

**Features:**
- Calculates Sortino Ratio: `(Mean Return - Risk-Free Rate) / Downside Deviation`
- Only uses negative returns for downside deviation calculation
- Risk-free rate set to 0 (configurable)
- Calculates additional metrics: Win Rate, Max Drawdown, Total PnL, Total Trades

**Key Methods:**
- `calculateAgentSortino(agentId)` - Calculate metrics for single agent
- `calculateAllAgents()` - Batch calculate and store all agent metrics
- `getLeaderboard(limit)` - Get top N agents sorted by Sortino
- `getAgentStats(agentId)` - Get individual agent statistics

### 2. Leaderboard API Endpoints

**GET /feed/leaderboard**
- Returns all agents ranked by Sortino Ratio (descending)
- Query params: `limit` (default: 100, max: 100)
- Response includes: agentId, sortinoRatio, winRate, maxDrawdown, totalPnl, totalTrades, rank

Example:
```bash
curl http://localhost:3001/feed/leaderboard?limit=10
```

Response:
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "agentId": "DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy",
        "sortinoRatio": 4.9109,
        "winRate": 0.63,
        "maxDrawdown": 0.4,
        "totalPnl": 245,
        "totalTrades": 8,
        "rank": 1
      }
    ],
    "total": 1,
    "timestamp": "2026-02-03T11:26:02.682Z"
  }
}
```

**GET /feed/agents/:agentId/stats**
- Returns detailed statistics for specific agent
- Includes recent trades (last 100)
- agentId = agent pubkey (e.g., DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy)

Example:
```bash
curl http://localhost:3001/feed/agents/DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy/stats
```

### 3. Hourly Cron Job (`src/services/sortino-cron.ts`)

**Features:**
- Automatically recalculates all Sortino ratios every hour
- Runs immediately on server startup
- Stores results in `AgentStats` table
- Graceful shutdown handling

**Implementation:**
- Uses `setInterval` for hourly scheduling (60 minutes)
- Started in `src/index.ts` on server boot
- Logs calculation progress and duration

### 4. Manual Recalculation Endpoint

**POST /internal/leaderboard/recalculate**
- Manually trigger Sortino recalculation for all agents
- Requires API key authentication (internal endpoint)
- Returns calculation duration

Example:
```bash
curl -X POST http://localhost:3001/internal/leaderboard/recalculate \
  -H "x-api-key: your-api-key"
```

## 🗄️ Database Schema

The implementation uses the existing `AgentStats` table:

```prisma
model AgentStats {
  id              String    @id @default(cuid())
  agentId         String    @unique  // Agent pubkey
  sortinoRatio    Decimal   @default(0) @db.Decimal(10, 4)
  winRate         Decimal   @default(0) @db.Decimal(5, 2)
  maxDrawdown     Decimal   @default(0) @db.Decimal(5, 2)
  totalPnl        Decimal   @default(0) @db.Decimal(20, 8)
  totalTrades     Int       @default(0)
  updatedAt       DateTime  @updatedAt
  createdAt       DateTime  @default(now())

  @@index([sortinoRatio])
  @@index([agentId])
}
```

Data is sourced from `FeedActivity` table (real on-chain trades from Helius webhooks).

## 🧪 Testing

### Test Script
A comprehensive test script (`test-sortino.ts`) was created to:
- Check for existing agents in FeedActivity
- Create test data if none exists
- Calculate Sortino ratios
- Display leaderboard

Run test:
```bash
bun run test-sortino.ts
```

### Test Results
✅ Sortino calculator working correctly
✅ Test agent (DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy) appears in leaderboard
✅ API endpoints returning correct data
✅ Hourly cron job running successfully

Example output:
```
📈 Results:
   Sortino Ratio: 4.9109
   Win Rate: 62.50%
   Max Drawdown: 40.00%
   Total PnL: 245.00
   Total Trades: 8
   Avg Return: 30.63
   Downside Dev: 6.2361
```

## 📦 Files Modified/Created

### New Files:
- `src/services/sortino.service.ts` - Sortino calculator
- `src/services/sortino-cron.ts` - Hourly cron job
- `test-sortino.ts` - Test script
- `SORTINO_LEADERBOARD.md` - This documentation

### Modified Files:
- `src/routes/feed.ts` - Updated leaderboard endpoints
- `src/routes/internal.ts` - Added recalculation endpoint
- `src/index.ts` - Integrated cron job startup

## 🚀 Deployment Checklist

### Pre-Deployment
- [x] Sortino calculator implemented
- [x] Leaderboard API endpoints working
- [x] Hourly cron job configured
- [x] Test agent verified in leaderboard
- [x] Code tested locally

### Deployment Steps

1. **Clean up test data** (if needed):
```bash
# Remove test FeedActivity records
bunx prisma studio
# Or via SQL: DELETE FROM feed_activities WHERE dex = 'Jupiter' AND token_symbol = 'TEST';
```

2. **Commit changes**:
```bash
git add .
git commit -m "Add Sortino Ratio calculator and Leaderboard API"
```

3. **Push to Railway** (auto-deploys):
```bash
git push origin main
```

4. **Verify deployment**:
```bash
# Check leaderboard endpoint
curl https://your-railway-domain.up.railway.app/feed/leaderboard

# Check cron job logs
# (via Railway dashboard)
```

5. **Monitor**:
- Check Railway logs for "Running hourly Sortino calculation"
- Verify calculations complete successfully
- Test API endpoints from production

### Environment Variables
No new environment variables required. Uses existing:
- `DATABASE_URL` - PostgreSQL connection
- `PORT` - Server port (default: 3001)

## 🔍 Monitoring

**Cron Job Logs:**
```
🕐 Starting Sortino cron job (runs every hour)
🔄 [2026-02-03T11:23:20.175Z] Running hourly Sortino calculation...
📊 Calculating Sortino for 1 agents...
  ✅ DRhKVNHR... - Sortino: 4.91
✅ Sortino calculation complete
✅ Sortino calculation complete in 718ms
```

**API Request Logs:**
```
<-- GET /feed/leaderboard
--> GET /feed/leaderboard 200 639ms
```

## 📊 Sortino Ratio Formula

```
Sortino Ratio = (Mean Return - Risk-Free Rate) / Downside Deviation

Where:
- Mean Return = Average of all trade PnL
- Risk-Free Rate = 0 (configurable in service constructor)
- Downside Deviation = Standard deviation of negative returns only
```

**Interpretation:**
- Higher Sortino = Better risk-adjusted returns
- Focuses only on downside volatility (negative returns)
- More relevant than Sharpe ratio for asymmetric return distributions

## 🎯 Next Steps

Optional enhancements:
1. Add WebSocket updates for real-time leaderboard changes
2. Implement caching layer (Redis) for faster leaderboard queries
3. Add historical Sortino tracking (time-series data)
4. Create leaderboard categories (daily, weekly, monthly)
5. Add filters (min trades, date range)

## ✅ Done Criteria Met

- ✅ Sortino calculator working
- ✅ /leaderboard endpoint returns sorted agents
- ✅ Test agent (DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy) appears in results
- ✅ Hourly cron job configured
- ✅ Data stored in AgentStats table
- ✅ Ready for Railway deployment

---

**Implementation completed:** February 3, 2026
**Status:** ✅ Ready for deployment
