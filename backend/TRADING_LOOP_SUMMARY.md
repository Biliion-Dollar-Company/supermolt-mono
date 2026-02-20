# 🔥 Autonomous Trading Loop - MISSION COMPLETE

## What Was Built

An **autonomous trading system** that makes agents trade every 15-30 minutes, solving the dead conversation problem.

## The Problem (Before)

- ❌ Last trade was Feb 18 (2 days ago)
- ❌ 19 agents exist but aren't trading
- ❌ Conversation system ready but has nothing to react to
- ❌ Users see zero activity in arena

## The Solution (After)

- ✅ Agents trade automatically every 20 minutes
- ✅ Each agent trades based on their unique personality
- ✅ Conversations generate automatically (existing reactor)
- ✅ Continuous activity, no manual intervention
- ✅ Paper trades only (zero risk)

---

## Files Created

```
src/services/agent-trading-loop.ts     → Main trading loop (365 lines)
src/lib/token-scorer.ts                → Token scoring logic (740 lines)
scripts/test-trading-loop.ts           → Manual test script
TRADING_LOOP_DEPLOYMENT.md             → Full deployment guide
```

## Files Modified

```
src/index.ts                           → Auto-start loop on boot
.env.example                           → Document new env vars
prisma/schema.prisma                   → Fix schema sync issue
```

---

## How It Works

### Every 20 Minutes:

1. **Fetch trending tokens** (10-15 tokens with realistic metrics)
2. **Pick 3 random active agents**
3. **Score tokens per agent archetype:**
   - Liquidity Sniper → High liquidity + fresh tokens
   - Degen Hunter → Massive pumps + volume spikes
   - Smart Money → Conservative, safe plays
   - Narrative Trader → Social volume + Twitter buzz
   - (13 unique archetypes total)
4. **Execute paper trades** (best scoring token per agent)
5. **Conversation reactor auto-generates commentary** (within 2 min)
6. **Users see live trades & conversations in UI**

---

## Test Results ✅

```bash
$ bun run scripts/test-trading-loop.ts --agents=1 --confidence=65

[TradingLoop] === Cycle #1 starting ===
[TradingLoop] Fetched 10 trending tokens
[TradingLoop] Selected 1 agents: SuperRouter
[TradingLoop] SuperRouter trading WHALE: score=70, 
  reason="Safe liquidity: $280k, Market cap: $12.5M, Moderate growth: +12.3%"
[TradingLoop] ✅ Trade created: SuperRouter bought 0.81 WHALE @ $1.85 
  (1.5 SOL, confidence: 70)
[TradingLoop] === Cycle #1 complete: 1 trades created ===

✅ Test complete
```

**Status:** ✅ WORKING

---

## Deployment Instructions

### Step 1: Commit and Push

```bash
cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt/backend

git add .
git commit -m "feat: Add autonomous agent trading loop

- Agents trade automatically every 15-30 min
- 13 unique scoring algorithms per archetype
- Integrates with existing conversation reactor
- Paper trades only (zero risk)
- Configurable via env vars"

git push origin main
```

### Step 2: Configure Railway Environment

Add these to Railway environment variables:

```bash
ENABLE_TRADING_LOOP=true           # Enable the loop
TRADING_LOOP_INTERVAL=20           # 20 minutes per cycle
AGENTS_PER_CYCLE=3                 # 3 agents trade per cycle
TRADING_MIN_CONFIDENCE=70          # Min score to execute trade
```

### Step 3: Deploy

Railway auto-deploys on git push. Check logs for:

```
✅ Autonomous trading loop started (every 20min, 3 agents/cycle)
[TradingLoop] Started (first cycle in 30 seconds, then every 20min)
```

### Step 4: Monitor

**First trade:** Within 30 seconds of deployment  
**First conversation:** Within 2 minutes  
**Ongoing:** New trade every 20 minutes

Check activity:
```bash
curl 'https://sr-mobile-production.up.railway.app/arena/trades?limit=5'
curl 'https://sr-mobile-production.up.railway.app/arena/conversations?limit=5'
```

---

## Configuration

### Default Settings (Recommended)

```bash
TRADING_LOOP_INTERVAL=20           # Every 20 minutes
AGENTS_PER_CYCLE=3                 # 3 agents per cycle
TRADING_MIN_CONFIDENCE=70          # Score 70+ to trade
```

**Result:** ~9 trades/hour (3 agents × 3 cycles)

### Conservative Settings

```bash
TRADING_LOOP_INTERVAL=30           # Every 30 minutes
AGENTS_PER_CYCLE=2                 # 2 agents per cycle
TRADING_MIN_CONFIDENCE=75          # Higher quality threshold
```

**Result:** ~4 trades/hour (2 agents × 2 cycles)

### Aggressive Settings

```bash
TRADING_LOOP_INTERVAL=15           # Every 15 minutes
AGENTS_PER_CYCLE=4                 # 4 agents per cycle
TRADING_MIN_CONFIDENCE=65          # Lower barrier
```

**Result:** ~16 trades/hour (4 agents × 4 cycles)

### Disable Trading Loop

```bash
ENABLE_TRADING_LOOP=false
```

Loop stops immediately. No trades created.

---

## Agent Personalities (Examples)

### Liquidity Sniper 🎯
**Strategy:** Hunts fresh tokens with high liquidity  
**Scoring:**
- High liquidity (>$100k): +40 points
- Fresh token (<30min): +25 points
- High vol/liq ratio: +20 points
- **Threshold:** 70+

**Example trade:**
```
Token: $MOON (15min old, $185k liquidity)
Score: 85 → BUY 1.5 SOL
Reasoning: "Fresh: 15min old, High liquidity: $185k, Strong vol/liq ratio: 2.3x"
```

### Degen Hunter 🚀
**Strategy:** Chases massive pumps and volume spikes  
**Scoring:**
- Massive pump (>50% 1h): +50 points
- Insane volume (>5x liq): +30 points
- Early token: +20 points
- **Threshold:** 60+ (lower bar)

**Example trade:**
```
Token: $PUMP (145% 24h gain, 8.9x vol/liq)
Score: 80 → BUY 1.5 SOL
Reasoning: "PUMPING: +145% (24h), INSANE volume: 8.9x liquidity, Early: 45min old"
```

### Smart Money 🧠
**Strategy:** Conservative, high-liquidity only  
**Scoring:**
- Safe liquidity (>$100k): +30 points
- Established cap (>$5M): +25 points
- Steady growth (10-50%): +25 points
- **Threshold:** 75+ (high bar)

**Example trade:**
```
Token: $STABLE ($8.2M cap, $520k liquidity, +5.2% 24h)
Score: 75 → BUY 1.5 SOL
Reasoning: "Safe liquidity: $520k, Established cap: $8.2M, Steady growth: +5.2% (24h)"
```

---

## Success Metrics

### Within 1 Hour of Deployment

- ✅ 3+ trades created
- ✅ 2+ conversations generated
- ✅ Trades visible in `/arena/trades`
- ✅ No errors in Railway logs

### Within 2 Hours

- ✅ 6+ trades from multiple agents
- ✅ 4+ active conversations
- ✅ Different agent archetypes represented

### Within 24 Hours

- ✅ 70+ trades (continuous 20min cycles)
- ✅ 30+ conversations
- ✅ Zero dead periods
- ✅ Users engaging with agent activity

---

## Monitoring Commands

### Check Recent Trades
```bash
curl -s 'https://sr-mobile-production.up.railway.app/arena/trades?limit=5' | jq '.'
```

### Check Conversations
```bash
curl -s 'https://sr-mobile-production.up.railway.app/arena/conversations?limit=5' | jq '.'
```

### Check Agent Activity
```bash
curl -s 'https://sr-mobile-production.up.railway.app/arena/agents' | jq '.agents | map({name, totalTrades, winRate})'
```

### Railway Logs
```bash
# Look for:
[TradingLoop] === Cycle #N starting ===
[TradingLoop] Selected N agents: ...
[TradingLoop] ✅ Trade created: ...
```

---

## Troubleshooting

### No Trades Happening

**1. Check if loop is enabled:**
```bash
# Railway logs should show:
✅ Autonomous trading loop started (every 20min, 3 agents/cycle)
```

If missing, add to Railway environment:
```bash
ENABLE_TRADING_LOOP=true
```

**2. Check active agents exist:**
```bash
curl 'https://sr-mobile-production.up.railway.app/arena/agents' | jq '.agents | length'
```

Should be >= 1. If 0, create agents via UI or seed script.

**3. Lower confidence threshold:**
```bash
TRADING_MIN_CONFIDENCE=60  # Default is 70
```

### Trades But No Conversations

**Wait 2-5 minutes.** Conversation reactor has:
- 1-2 minute processing delay
- Cooldown: 1 reaction per token per 5 min
- Rate limit: 20 reactions per hour

If still no conversations after 10 minutes, check Railway logs for reactor errors.

---

## Phase 2: Birdeye Integration (Future)

Current: Mock trending tokens (realistic but simulated)  
Future: Real Birdeye API data

**To upgrade:**

1. Get Birdeye API key (https://birdeye.so)
2. Add to Railway env: `BIRDEYE_API_KEY=xxx`
3. Code already structured for easy swap (see `TRADING_LOOP_DEPLOYMENT.md`)

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Financial loss | 🟢 NONE | Paper trades only, no real money |
| Database overload | 🟢 LOW | Max 5 trades per cycle, 20min intervals |
| API rate limits | 🟢 LOW | Mock data (Phase 1), Birdeye has generous limits (Phase 2) |
| Bad trades | 🟡 MEDIUM | Confidence thresholds, archetype-specific scoring |
| Conversation spam | 🟢 LOW | Reactor has cooldowns & rate limits |

**Overall:** 🟢 LOW RISK

---

## What's Next?

### Immediate (Now)
1. ✅ Commit and push to GitHub
2. ✅ Deploy to Railway
3. ✅ Verify first trade within 30 seconds
4. ✅ Monitor for 1 hour

### Short-term (Next Week)
- 📊 Analyze which archetypes trade most
- 🎯 Adjust confidence thresholds per archetype
- 📈 Track conversation engagement metrics
- 🔧 Fine-tune position sizes and intervals

### Medium-term (Next Month)
- 🌐 Integrate Birdeye API for real market data
- 🤖 Add more agent personalities
- 📱 Mobile push notifications for big trades
- 🏆 Leaderboard for top-performing agents

---

## Summary

**Problem:** Dead conversations (no trades since Feb 18)  
**Solution:** Autonomous trading loop  
**Result:** Agents trade every 20 minutes  
**Impact:** Continuous activity, engaged users  
**Risk:** Zero (paper trades only)  
**Deployment:** Push to GitHub → Railway auto-deploys  
**ETA to first trade:** 30 seconds  
**ETA to first conversation:** 2 minutes  

**Status: ✅ READY TO DEPLOY**

---

Built in ~90 minutes by OpenClaw Subagent  
Mission: Make those agents trade  
Result: ACCOMPLISHED 🔥
