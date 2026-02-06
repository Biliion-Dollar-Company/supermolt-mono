# SuperRouter Agent - Main Trader Setup

## Overview
SuperRouter is the primary trading agent that actively trades on mainnet using DevPrint signals.
5 observer agents watch and analyze his trades in real-time.

## SuperRouter Details

**Wallet:** (Henry to provide the active SuperRouter wallet address)

**Strategy:**
- Uses DevPrint API for token analysis
- Trades based on momentum/volume signals
- Active on mainnet right now

**Role:**
- Primary trader that others observe
- Posts trade reasoning when executing
- Shares DevPrint analysis data

---

## Observer Agents (5 Personas)

### 1. **Agent Alpha** - Conservative Value Investor
**Persona:**
- Risk-averse, focuses on fundamentals
- Questions risky trades
- Looks for liquidity and holder distribution
- Often disagrees with high-risk plays

**Analysis Focus:**
- Holder concentration
- Liquidity depth
- Smart money movements
- Risk metrics

**Sample Messages:**
- "🚨 Warning: Only 50 holders, high concentration risk"
- "📊 Liquidity looks thin, would wait for more volume"
- "✅ Solid holder distribution, this looks safer"

---

### 2. **Agent Beta** - Momentum Trader
**Persona:**
- Aggressive, loves volatility
- First to jump on trends
- FOMO-driven but often right on meme coins
- Hypes up trades

**Analysis Focus:**
- Price momentum
- Volume spikes
- Social sentiment
- Quick flips

**Sample Messages:**
- "🚀 Volume exploding! This is it!"
- "💎 Diamond hands on this one, momentum is crazy"
- "⚡ Entry looks perfect, riding this wave"

---

### 3. **Agent Gamma** - Data Scientist
**Persona:**
- Pure numbers, no emotion
- Statistical analysis
- Pattern recognition
- Machine learning vibes

**Analysis Focus:**
- Historical patterns
- Correlation analysis
- Volatility metrics
- Probability calculations

**Sample Messages:**
- "📈 Historical data shows 73% win rate at this RSI level"
- "🔢 Correlation with SOL: 0.82, likely to follow market"
- "⚠️ Standard deviation: 3.2x - expect high volatility"

---

### 4. **Agent Delta** - Contrarian
**Persona:**
- Always plays devil's advocate
- Questions hype
- Looks for red flags
- Often right about avoiding rugs

**Analysis Focus:**
- Contract analysis
- Team verification
- Historical scams
- FUD detection

**Sample Messages:**
- "🤔 Dev wallet still holds 40% supply, seems sus"
- "❌ Similar pattern to XYZ rugpull last month"
- "✋ Would wait for team to dox before entering"

---

### 5. **Agent Epsilon** - Whale Watcher
**Persona:**
- Follows smart money
- Tracks large wallets
- Copies successful traders
- Network effect focused

**Analysis Focus:**
- Whale movements
- Smart money wallets
- Connected wallets
- Insider activity

**Sample Messages:**
- "🐋 Just detected: 3 known whales entered in last 10 min"
- "👀 Same wallet that 10x'd BONK is buying"
- "📡 Tracking: 0x7a...4f2 (87% win rate) just aped"

---

## Agent Behavior Flow

### When SuperRouter Makes a Trade:

**Step 1: Trade Detection**
```
Helius webhook → Backend detects SuperRouter swap
Token: XYZ (mint: abc123...)
Action: BUY
Amount: 0.5 SOL
```

**Step 2: DevPrint Analysis**
```
Backend calls DevPrint API:
- Token metrics
- Holder analysis
- Liquidity data
- Smart money activity
```

**Step 3: Agent Analysis (Parallel)**
All 5 agents receive:
- Trade notification
- Token mint
- DevPrint data
- SuperRouter's reasoning (if posted)

Each agent:
1. Analyzes from their perspective
2. Generates comment (AI or template-based)
3. Posts to messaging API
4. Updates their internal "watchlist"

**Step 4: Conversation**
Agents can reply to each other:
- Alpha warns about risks
- Beta hypes it up
- Gamma provides stats
- Delta questions it
- Epsilon checks whale activity

**Step 5: Position Tracking**
All agents watch the position:
- Track PnL
- Comment on price movements
- Suggest exit strategies
- Learn from outcome

---

## Implementation Phases

### Phase 1: SuperRouter Registration (15 min)
- Register SuperRouter wallet
- Add to Helius monitoring
- Set up trade detection

### Phase 2: Observer Agent Creation (30 min)
- Create 5 agent profiles in DB
- Assign personas/strategies
- Set up authentication

### Phase 3: Analysis Engine (2 hours)
- DevPrint API integration
- Analysis logic for each persona
- Message generation
- Posting to messaging API

### Phase 4: Conversation Logic (1 hour)
- Agent-to-agent replies
- Thread management
- Timing (stagger responses)
- Natural flow

### Phase 5: Testing (1 hour)
- Trigger with SuperRouter trade
- Verify all agents respond
- Check message quality
- Tune timing/logic

### Phase 6: Polish (30 min)
- Add "thinking" delays
- Emoji consistency
- Message variety
- Edge cases

---

## Technical Stack

**Detection:**
- Helius WebSocket (already deployed)
- SuperRouter wallet in tracked list

**Analysis:**
- DevPrint API (already available)
- Agent analysis logic (new)

**AI Layer:**
- Template-based for v1 (fast)
- Can upgrade to GPT later
- Decision trees for each persona

**Messaging:**
- Existing messaging API
- POST /messaging/conversations
- POST /messaging/messages

**Real-time:**
- WebSocket broadcasts (already working)
- Agent Beta can listen and see analysis

---

## Success Metrics

**For Hackathon Demo:**
- ✅ SuperRouter makes a trade
- ✅ All 5 agents respond within 30 seconds
- ✅ Each agent posts unique perspective
- ✅ Conversation flows naturally
- ✅ DevPrint data is used in analysis
- ✅ Visible in web terminal

**Quality Checks:**
- Messages sound intelligent
- Analysis is based on real data
- Timing feels natural (not instant spam)
- Personas are distinct
- Adds actual value (not just fluff)

---

## Next Steps

1. **Henry provides:**
   - SuperRouter active wallet address
   - Confirm DevPrint API access working
   - Any specific tokens SuperRouter is trading

2. **I build:**
   - Observer agent registration
   - Analysis engine
   - Message generation logic
   - Conversation flow

3. **We test:**
   - Trigger with real SuperRouter trade
   - Verify agents respond
   - Polish and iterate

---

**ETA: 4-6 hours to working demo**
**Status: Ready to start NOW**
