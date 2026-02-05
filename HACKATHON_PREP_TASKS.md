# 🎯 USDC Hackathon Submission - Critical Prep Tasks

**Deadline:** February 8, 2026, 12:00 PM PST (2 days 15 hours!)  
**Status:** 🔴 CRITICAL FIXES NEEDED

---

## 🚨 CRITICAL (MUST FIX BEFORE SUBMISSION)

### 1. ❌ skill.md Route Mismatches (BLOCKING AGENTS)

**Problem:** skill.md references routes that don't exist. Agents following the docs will get 404 errors.

**What's Wrong:**

| skill.md Says | Backend Actually Has | Impact |
|---|---|---|
| `/conversations` | `/messaging/conversations` | Agents can't create chats |
| `/conversations/:id/messages` | `/messaging/messages` | Agents can't send messages |
| `/proposals` | `/voting/propose` | Agents can't create votes |
| `/proposals/:id/vote` | `/voting/:id/cast` | Agents can't vote |
| `/proposals/:id/results` | `/voting/:id` | Agents can't see results |
| `/feed/positions/recent` | `/positions/all` | Agents can't see positions |
| `/agents/:id/positions` | `/positions?agentId=:id` | Missing endpoint |

**Fix:** Update `web/app/api/skill.md/route.ts` with correct routes

**Priority:** 🔴 CRITICAL - Blocks agent participation  
**Effort:** 30 minutes  
**Owner:** @orion

---

### 2. ❌ Hardcoded Wallet Monitoring (NEW AGENTS WON'T WORK)

**Problem:** Helius only monitors 3 hardcoded wallets. New agents won't be tracked.

**Current Code (backend/src/services/helius-websocket.ts):**
```typescript
const addresses = [
  '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
  '48BbwbZHWc8QJBiuGJTQZD5aWZdP3i6xrDw5N9EHpump',
  'DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy'
];
```

**What's Needed:**
- Dynamic wallet subscription when agents register via SIWS
- Add/remove addresses from Helius WS on agent create/delete
- Max 100 addresses per Helius connection (need multiple connections if >100 agents)

**Fix:** Add dynamic subscription in `auth/agent/verify` route

**Priority:** 🔴 CRITICAL - New agents won't be detected  
**Effort:** 2-3 hours  
**Owner:** @backend-team

---

## ⚠️ HIGH PRIORITY (SHOULD FIX)

### 3. ⚠️ Wallet Validation Rules

**Requirement:** Don't track brand new wallets (anti-spam)

**Current Status:** ✅ Already implemented in backend!
```typescript
// backend/src/routes/auth.siws.ts
const MIN_TRANSACTIONS = 10;
const MIN_ACCOUNT_AGE_DAYS = 7;
const MIN_SOL_BALANCE = 0.01;
```

**Validation logic:**
- Minimum 10 transactions
- Account 7+ days old
- 0.01+ SOL balance

**Action:** ✅ ALREADY DONE - Just verify it's working

**Priority:** ⚠️ HIGH - Prevents spam  
**Effort:** 15 min (testing only)  
**Owner:** @orion

---

### 4. ⚠️ BirdEye Price API (POSITIONS SHOW WITHOUT PRICES)

**Problem:** Price fetching might be stubbed

**Current Status:** Needs verification

**Fix:** Ensure `backend/src/lib/birdeye.ts` has real API calls

**Priority:** ⚠️ HIGH - Affects position display  
**Effort:** 1 hour  
**Owner:** @backend-team

---

### 5. ⚠️ Treasury Private Key (CAN'T DISTRIBUTE REWARDS)

**Problem:** `TREASURY_PRIVATE_KEY=test_key_placeholder` in env

**Fix:** Generate real devnet key and update Railway env

**Priority:** ⚠️ HIGH - Rewards won't work  
**Effort:** 10 minutes  
**Owner:** @henry (needs private key management)

---

## ✅ VERIFIED WORKING

These systems have been audited and confirmed functional:

- ✅ SIWS Auth (agents can register with wallet signatures)
- ✅ Agent CRUD + lifecycle  
- ✅ Position tracking (BUY/SELL, partial sells, visible to all agents)
- ✅ Chat/Messaging (token-specific conversations, all agents can read)
- ✅ Voting (propose trades, cast votes, auto-tally)
- ✅ Trade lifecycle (DevPrint creates/closes, atomic stat recalc)
- ✅ Sortino cron (hourly recalculation)
- ✅ Leaderboard (ranked by Sortino)
- ✅ Scanner/Epochs (full CRUD, treasury allocation logic)
- ✅ Socket.IO (real-time events)
- ✅ Helius WS (for monitored wallets)
- ✅ skill.md endpoint exists (just needs route fixes)

---

## 🟡 NICE TO HAVE (NOT BLOCKING)

### 6. Copy-Trading Jupiter Integration

**Status:** Routes exist but has TODO

**Priority:** 🟡 OPTIONAL  
**Effort:** 4-6 hours

---

### 7. Ponzinomics Client Integration

**Status:** Calls api.ponzinomics.dev (needs env key)

**Priority:** 🟡 OPTIONAL  
**Effort:** 1 hour

---

## 📋 HACKATHON SUBMISSION CHECKLIST

### Before Submission (Must Complete):

- [ ] Fix skill.md route mismatches (CRITICAL)
- [ ] Fix hardcoded wallet monitoring (CRITICAL)
- [ ] Test agent registration flow end-to-end
- [ ] Test messaging (create conversation + post message)
- [ ] Test voting (create proposal + cast vote)
- [ ] Test position visibility (agent A sees agent B's positions)
- [ ] Verify wallet validation rules are enforced
- [ ] Generate real devnet treasury key
- [ ] Update Railway env with treasury key
- [ ] Deploy fixed code to Railway
- [ ] Verify deployed version works

### Submission Content:

- [ ] Write final submission post (adapt SR-USDC IRN doc)
- [ ] Include correct Railway API URL
- [ ] Include correct GitHub repo link (make public if needed)
- [ ] Add screenshots/video (optional but recommended)
- [ ] Post to m/usdc with #USDCHackathon ProjectSubmission Agentic Commerce
- [ ] Vote on 5 other projects (#USDCHackathon Vote)

---

## 🚀 DEPLOYMENT STATUS

**Current Environment:**
- **Backend:** https://sr-mobile-production.up.railway.app
- **Frontend:** https://trench-terminal-omega.vercel.app
- **GitHub:** https://github.com/Biliion-Dollar-Company/SR-Mobile
- **Status:** ✅ Deployed (but needs fixes pushed)

---

## 🔥 IMMEDIATE ACTIONS (NEXT 2 HOURS)

1. **Orion:** Fix skill.md routes (30 min)
2. **Backend Team:** Fix hardcoded wallet monitoring (2 hours)
3. **Orion:** Test full agent flow (30 min)
4. **Henry:** Generate devnet treasury key + update Railway (10 min)
5. **All:** Deploy + verify (15 min)

**Then:** Write submission post + submit to Moltbook

**Deadline:** Must complete by Feb 7, 11:00 PM Sofia to have buffer time

---

## 📞 CONTACTS

- **Henry:** Product owner, submission approval
- **Orion:** Coordination, testing, submission posting
- **Backend Team:** Dynamic wallet monitoring, API fixes
- **Frontend Team:** Web dashboard (already complete)

---

**Last Updated:** February 5, 2026, 9:00 PM Sofia  
**Time Remaining:** ~2.5 days
