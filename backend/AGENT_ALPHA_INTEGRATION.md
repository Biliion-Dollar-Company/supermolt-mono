# Agent Alpha Integration Guide 🐺

**Status:** ✅ CODE COMPLETE - Waiting for Private Key  
**Timeline:** 30 minutes after private key provided  
**Target Wallet:** `DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy`

---

## 📋 What Was Built

### ✅ 1. Agent Configuration (`src/services/agent-config.ts`)
- **5 trading agent personalities** defined
- **Agent Alpha** configured with:
  - Wallet: `DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy`
  - Personality: Aggressive day trader, HIGH risk
  - Token watchlist: BONK, WIF, POPCAT, MEW
  - Trading params: 0.05 SOL per trade, 3 trades/day, 25% TP, 15% SL

### ✅ 2. Agent Simulator (`src/services/agent-simulator.ts`)
- **Loads existing wallet from private key** (Agent Alpha)
- **Generates new wallets** for other 4 agents
- **Jupiter integration** for executing swaps
- **Auto-creates agents** in database on first trade
- **Security:**
  - Private key loaded from env variable
  - Never logged or exposed
  - Validates wallet address matches expected

### ✅ 3. Test Script (`scripts/test-agent.ts`)
- **Executable test script** to verify integration
- Runs 1 LIVE trade with Agent Alpha
- Validates wallet, executes swap, confirms transaction
- Provides step-by-step success verification

### ✅ 4. Environment Template (`.env.example`)
- Added `AGENT_ALPHA_PRIVATE_KEY` placeholder
- Documentation on how to set it up
- Security notes included

---

## 🔐 Security Implementation

### Private Key Storage
- ✅ Stored in `.env` file (never committed to git)
- ✅ `.env` is in `.gitignore`
- ✅ Loaded only at runtime
- ✅ Only used for LIVE trades
- ✅ Wallet address validated on load

### Best Practices
- Private key in **base58 format** (standard Solana format)
- Environment variable: `AGENT_ALPHA_PRIVATE_KEY`
- Never logged, never exposed in API responses
- Only Agent Alpha uses existing wallet; others generate new ones

---

## 🚀 Integration Steps

### Step 1: Provide Private Key

**Henry, please provide the private key for wallet:**
```
DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy
```

**Required format:** Base58 string (standard Solana export format)

**How to get it:**
- From Phantom: Settings → Export Private Key
- From Solflare: Settings → Export Private Key
- From CLI wallet: `solana-keygen recover` → shows base58 key

**Where to send it:**
- Directly to this chat (I'll add it to .env)
- Or tell me how you prefer to share it securely

---

### Step 2: Add to Environment (I'll do this)

Once you provide the key, I'll add it to `.env`:

```bash
# In SR-Mobile/backend/.env
AGENT_ALPHA_PRIVATE_KEY=<your_base58_private_key_here>
```

---

### Step 3: Run Test Trade (Automated)

I'll execute the test script:

```bash
cd SR-Mobile/backend
bun scripts/test-agent.ts BONK BUY 0.01
```

This will:
1. Load Agent Alpha's wallet
2. Execute 1 LIVE swap (0.01 SOL → BONK)
3. Confirm transaction on Solana
4. Wait for webhook to detect it
5. Verify agent appears on leaderboard

**Timeline:** ~5 minutes

---

### Step 4: Verify Integration (Automated)

I'll verify:
- ✅ Transaction confirmed on Solscan
- ✅ Webhook detected the swap
- ✅ Agent Alpha created in database
- ✅ Trade recorded
- ✅ Agent appears on leaderboard
- ✅ Sortino ratio calculated
- ✅ Live Tape shows the trade

---

### Step 5: Success Confirmation

You'll receive:
- ✅ Transaction signature + Solscan link
- ✅ Agent Alpha profile on leaderboard
- ✅ Screenshot of trade in Live Tape
- ✅ Full integration report

---

## 📊 Agent Alpha Personality

```typescript
{
  id: 'alpha-wolf',
  name: 'Alpha Wolf',
  emoji: '🐺',
  description: 'Aggressive day trader. High risk, high reward.',
  
  // Risk Profile
  riskLevel: 'HIGH',
  aggression: 90,    // Very aggressive
  patience: 20,      // Low patience (acts fast)
  
  // Token Focus
  tokenWatchlist: ['BONK', 'WIF', 'POPCAT', 'MEW'],
  
  // Trading Params
  maxPositionSize: 0.05,     // 0.05 SOL per trade
  takeProfitPercent: 25,     // Take profit at +25%
  stopLossPercent: 15,       // Stop loss at -15%
  tradesPerDay: 3,           // Target 3 trades/day
  
  // Market Focus
  minMarketCap: 100_000,
  maxMarketCap: 50_000_000,
}
```

---

## 🔄 How It Works (After Integration)

### Automatic Flow

1. **Agent Alpha makes a swap** (manual or automated)
   - Uses Jupiter for best price
   - Transaction sent to Solana mainnet
   - Transaction confirmed

2. **Helius webhook detects swap** (10-30 seconds)
   - Webhook fires to backend
   - Backend parses swap instructions
   - Identifies wallet: `DRhK...`

3. **Agent auto-created in database**
   - Checks if agent exists
   - If not, creates from config
   - Name: "Alpha Wolf"
   - Personality: Aggressive trader

4. **Trade recorded**
   - Swap details saved
   - PnL calculated
   - Position updated

5. **Leaderboard updated**
   - Sortino ratio calculated
   - Win rate updated
   - Rank assigned

6. **Frontend displays**
   - Agent appears on leaderboard
   - Trade shows in Live Tape
   - Profile page accessible

---

## 🧪 Test Scenarios

### Test 1: First Trade (0.01 SOL)
```bash
bun scripts/test-agent.ts BONK BUY 0.01
```
**Expected:**
- ✅ Agent Alpha created
- ✅ First trade recorded
- ✅ Appears on leaderboard
- ✅ Sortino = 0 (needs 2+ trades)

### Test 2: Second Trade (0.005 SOL)
```bash
bun scripts/test-agent.ts WIF BUY 0.005
```
**Expected:**
- ✅ Second trade recorded
- ✅ Sortino calculated
- ✅ Win rate calculated
- ✅ Rank assigned

### Test 3: Sell Trade
```bash
bun scripts/test-agent.ts BONK SELL 0.01
```
**Expected:**
- ✅ Sell trade recorded
- ✅ Position closed or reduced
- ✅ Realized PnL calculated
- ✅ Stats updated

---

## 📁 Files Created/Modified

### New Files
1. `src/services/agent-config.ts` - Agent personalities (227 lines)
2. `src/services/agent-simulator.ts` - Simulator logic (362 lines)
3. `scripts/test-agent.ts` - Test script (142 lines)
4. `AGENT_ALPHA_INTEGRATION.md` - This guide

### Modified Files
1. `.env.example` - Added AGENT_ALPHA_PRIVATE_KEY template

### Security Files (DO NOT COMMIT)
- `.env` (contains private key after you provide it)

---

## 🎯 Success Criteria

### Code Complete ✅
- ✅ Agent config with DR wallet pubkey
- ✅ Private key loading from env
- ✅ Wallet validation logic
- ✅ Jupiter swap integration
- ✅ Auto-agent creation
- ✅ Test script ready

### Waiting for Private Key ⏳
- ⏳ Henry provides base58 private key
- ⏳ Add to `.env`
- ⏳ Run test trade
- ⏳ Verify webhook detects it
- ⏳ Confirm leaderboard shows agent
- ⏳ Success confirmation

---

## 💡 Bonus Feature (Documented)

### Payment Gateway Concept
A payment gateway where agents pay a platform fee on each trade has been documented in the project spec. See `PAYMENT_GATEWAY_SPEC.md` for:

- Fee structure: 0.1-0.5% per swap
- Automated fee collection via Solana program
- Agent wallet deduction on each trade
- Revenue tracking and analytics
- Smart contract design

**Status:** Spec created, implementation scheduled for Phase 4

---

## 🐛 Troubleshooting

### Error: "AGENT_ALPHA_PRIVATE_KEY not found"
**Solution:** Add private key to `.env` file

### Error: "Wallet mismatch"
**Solution:** Verify private key is for `DRhK...` wallet

### Error: "Insufficient balance"
**Solution:** Add SOL to wallet (test trades need 0.01-0.05 SOL)

### Error: "Token not in watchlist"
**Solution:** Use BONK, WIF, POPCAT, or MEW

### Webhook not detecting trade
**Solution:**
1. Check Helius webhook is configured
2. Verify webhook URL is correct
3. Check backend logs for webhook processing
4. Test webhook manually with curl

---

## 📞 Next Steps

**Henry, please provide:**
1. Private key for `DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy` (base58 format)

**Then I'll:**
1. Add to `.env` ✅ (1 min)
2. Run test trade ✅ (5 min)
3. Verify webhook ✅ (2 min)
4. Check leaderboard ✅ (1 min)
5. Send confirmation ✅ (1 min)

**Total time:** ~10 minutes after you provide the key

---

**Ready to integrate! 🚀**
