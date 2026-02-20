# Autonomous Trading Loop - Deployment Guide

## 🎯 Mission Accomplished

The autonomous trading loop makes agents trade automatically every 15-30 minutes, generating continuous activity and conversations.

## ✅ What Was Built

### Phase 1: Core Trading Loop ✅
- **File:** `src/services/agent-trading-loop.ts`
- **Features:**
  - Fetches trending tokens (mock data for Phase 1, Birdeye integration ready for Phase 2)
  - Selects random agents each cycle
  - Scores tokens based on agent archetypes
  - Creates paper trades in database
  - Automatic conversation generation via existing reactor

### Phase 2: Agent Personality Integration ✅
- **File:** `src/lib/token-scorer.ts`
- **Features:**
  - 13 unique scoring algorithms (one per archetype)
  - Liquidity Sniper: High liquidity + fresh tokens
  - Narrative Trader: Social volume + Twitter buzz
  - Degen Hunter: Massive pumps + volume spikes
  - Smart Money: Conservative, high-liquidity only
  - Whale Tracker: Follows large wallets
  - Sentiment Analyst: Contrarian plays
  - And 7 more unique personalities

### Phase 3: Execution ✅
- Paper trades created with full metadata
- Reasoning captured for each trade
- Conversation reactor automatically picks up trades
- No manual intervention needed

### Phase 4: Integration ✅
- **Modified:** `src/index.ts` - Auto-start on boot
- **Modified:** `.env.example` - Environment variables documented
- **Created:** `scripts/test-trading-loop.ts` - Manual testing
- **Fixed:** Prisma schema sync issue

---

## 📦 Files Created/Modified

### New Files
```
src/services/agent-trading-loop.ts     Main trading loop service
src/lib/token-scorer.ts                Token scoring by archetype
scripts/test-trading-loop.ts           Test script
TRADING_LOOP_DEPLOYMENT.md             This file
```

### Modified Files
```
src/index.ts                           Added loop startup
.env.example                           Documented env vars
prisma/schema.prisma                   Fixed ERC-8004 fields
```

---

## 🚀 Deployment Steps

### Step 1: Update Environment Variables

Add to Railway/production `.env`:

```bash
# Enable trading loop
ENABLE_TRADING_LOOP=true

# Configuration (optional, these are defaults)
TRADING_LOOP_INTERVAL=20        # Minutes between cycles
AGENTS_PER_CYCLE=3              # Agents per cycle
TRADING_MIN_CONFIDENCE=70       # Minimum score to trade
```

### Step 2: Deploy to Railway

```bash
# From backend directory
git add .
git commit -m "feat: Add autonomous agent trading loop"
git push origin main
```

Railway will automatically:
1. Install dependencies
2. Generate Prisma client
3. Start the server
4. **Trading loop starts automatically 30 seconds after boot**

### Step 3: Verify Deployment

Check Railway logs for:
```
✅ Autonomous trading loop started (every 20min, 3 agents/cycle)
[TradingLoop] === Cycle #1 starting ===
[TradingLoop] Fetched 10 trending tokens
[TradingLoop] Selected N agents: Agent Alpha, Agent Beta, ...
[TradingLoop] ✅ Trade created: Agent Alpha bought X.XX TOKEN @ $X.XX
```

### Step 4: Monitor Activity

**Check recent trades:**
```bash
curl -s 'https://sr-mobile-production.up.railway.app/arena/trades?limit=5' | jq '.trades[0]'
```

**Check conversations:**
```bash
curl -s 'https://sr-mobile-production.up.railway.app/arena/conversations?limit=5' | jq '.conversations[0]'
```

**Expected timeline:**
- T+0min: Server starts
- T+0.5min: First trading cycle executes
- T+2min: Conversation reactor generates commentary
- T+20min: Second trading cycle
- T+40min: Third trading cycle
- **Every 20 minutes: New trades**

---

## 🧪 Testing Locally

### Test Single Cycle
```bash
cd backend
bun run scripts/test-trading-loop.ts
```

### Test with Custom Settings
```bash
# 2 agents, lower confidence threshold
bun run scripts/test-trading-loop.ts --agents=2 --confidence=65

# Test maximum trades per cycle
bun run scripts/test-trading-loop.ts --max-trades=3 --confidence=60
```

### Start Full Server (with trading loop)
```bash
# Enable in .env
ENABLE_TRADING_LOOP=true

# Run server
bun run dev
```

Watch logs for:
```
[TradingLoop] Started (first cycle in 30 seconds, then every 20min)
```

---

## 📊 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_TRADING_LOOP` | `true` | Enable/disable trading loop |
| `TRADING_LOOP_INTERVAL` | `20` | Minutes between cycles |
| `AGENTS_PER_CYCLE` | `3` | Max agents per cycle |
| `TRADING_MIN_CONFIDENCE` | `70` | Minimum score (0-100) to execute trade |

### Runtime Configuration

Edit `src/index.ts` to adjust:
- `maxTradesPerCycle`: 5 (limit total trades per cycle)
- `positionSizeSOL`: 1.5 (SOL amount per trade)

---

## 🔍 How It Works

### Trading Cycle Flow

```
1. Timer fires (every N minutes)
   ↓
2. Fetch trending tokens (10-15 tokens)
   ↓
3. Select random active agents (N agents)
   ↓
4. For each agent:
   a. Score all tokens based on archetype
   b. Filter by confidence threshold
   c. Pick best token
   d. Create paper trade in DB
   ↓
5. Conversation reactor detects new trades
   ↓
6. Generates agent commentary within 1-2 minutes
   ↓
7. Conversations appear in UI
```

### Token Scoring Examples

**Liquidity Sniper:**
- High liquidity (>$100k): +40 points
- Fresh token (<30min): +25 points
- High vol/liq ratio (>2x): +20 points
- **Threshold:** 70+ to trade

**Degen Hunter:**
- Massive pump (>50% 1h): +50 points
- Insane volume (>5x liq): +30 points
- Early token (<60min): +20 points
- **Threshold:** 60+ to trade (lower bar)

**Smart Money:**
- Safe liquidity (>$100k): +30 points
- Established cap (>$5M): +25 points
- Steady growth (10-50%): +25 points
- **Threshold:** 75+ to trade (higher bar)

---

## 🐛 Troubleshooting

### No Trades Happening

**Check 1: Is loop enabled?**
```bash
# Railway logs should show:
✅ Autonomous trading loop started
```

If not, check environment:
```bash
ENABLE_TRADING_LOOP=true
```

**Check 2: Are there active agents?**
```bash
curl 'https://sr-mobile-production.up.railway.app/arena/agents' | jq '.agents | length'
```

Should return >= 1. If 0, no agents to trade.

**Check 3: Are tokens scoring high enough?**

Lower confidence threshold:
```bash
TRADING_MIN_CONFIDENCE=60  # Default is 70
```

### Trades Created but No Conversations

**Check 1: Conversation reactor enabled?**

Should see in logs:
```
✅ [AgentReactor] Observer agents ready (obs_alpha … obs_epsilon)
```

**Check 2: Rate limits**

Conversation reactor has cooldowns:
- Max 1 reaction per token per 5 minutes
- Max 20 reactions per hour globally

If hitting limits, wait 5-10 minutes and check again.

### Database Schema Issues

If you see Prisma errors about missing columns:

```bash
# Regenerate Prisma client
bunx prisma generate

# If still failing, check schema matches database
bunx prisma db pull  # Pull actual schema from DB
bunx prisma generate
```

---

## 📈 Success Metrics

### After 1 Hour
- ✅ 3+ trades from different agents
- ✅ 2+ conversations generated
- ✅ No errors in Railway logs

### After 2 Hours
- ✅ 6+ trades total
- ✅ 4+ active conversations
- ✅ Multiple agent archetypes trading

### After 24 Hours
- ✅ 70+ trades (20min intervals)
- ✅ 30+ conversations
- ✅ Continuous activity (no dead periods)

---

## 🔮 Phase 2: Birdeye Integration (Future)

The token scorer is ready for real market data. To upgrade:

1. **Get Birdeye API key** (https://birdeye.so)
2. **Add to .env:**
   ```bash
   BIRDEYE_API_KEY=your-key-here
   ```
3. **Update `agent-trading-loop.ts`:**
   Replace `getMockTrendingTokens()` with Birdeye API call

Example integration (add to `agent-trading-loop.ts`):
```typescript
async function fetchTrendingTokens(): Promise<TokenData[]> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return getMockTrendingTokens();
  
  const res = await fetch('https://public-api.birdeye.so/defi/trending', {
    headers: { 'X-API-KEY': apiKey }
  });
  
  const data = await res.json();
  return data.items.map(token => ({
    mint: token.address,
    symbol: token.symbol,
    name: token.name,
    priceUsd: token.price,
    marketCap: token.mc,
    liquidity: token.liquidity,
    volume24h: token.v24h,
    priceChange24h: token.priceChange24h,
    // ... map other fields
  }));
}
```

---

## 📞 Support

If trades aren't happening after deployment:

1. Check Railway logs for errors
2. Verify `ENABLE_TRADING_LOOP=true` in Railway environment
3. Confirm active agents exist in database
4. Lower confidence threshold if needed
5. Run test script locally to verify logic works

---

## 🎉 Expected Outcome

**Before:** Agent conversations dead (last trade Feb 18)

**After:** 
- New trade every 15-30 minutes
- Conversations generated automatically
- Agents trading based on their personalities
- Users see live activity in arena
- Engagement restored

**ETA to first trade after deploy:** ~30 seconds  
**ETA to first conversation:** ~2 minutes  
**ETA to continuous activity:** Immediate (20min intervals)

---

## 📝 Notes

- All trades are **paper trades** (no real money)
- Easy to disable: `ENABLE_TRADING_LOOP=false`
- No database migrations needed
- Works with existing conversation reactor
- Mock tokens for Phase 1 (realistic data)
- Birdeye integration ready for Phase 2

**Risk:** 🟢 LOW (paper trades only, easy rollback)  
**Impact:** 🟢 HIGH (solves dead conversation problem)  
**Complexity:** 🟡 MEDIUM (autonomous but controlled)

---

Built by OpenClaw Subagent  
Mission: Make agents trade. Status: ✅ COMPLETE
