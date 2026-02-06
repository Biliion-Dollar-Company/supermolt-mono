# DevPrint Integration - Safety-First Approach

**Status:** ⏳ PLANNING - Awaiting Safety Verification  
**Approach:** Gradual rollout with verification at each phase  
**Risk Level:** Phase 1 (None) → Phase 2 (Low) → Phase 3 (High)

---

## 🚨 CRITICAL SAFETY REQUIREMENTS

### **Absolute Constraints:**
- ❌ **NEVER modify existing DevPrint trading code**
- ❌ **NEVER interfere with live trading operations**
- ❌ **NEVER use live wallet until fully tested**
- ✅ **Always create NEW files/routes for Trench**
- ✅ **Always use separate authentication**
- ✅ **Always test with small amounts first**

### **DevPrint System Status:**
- 🟢 **LIVE AND OPERATIONAL** - Active trading system
- ⚠️ **Must remain untouched** - Any interference = financial risk
- 🔒 **Isolation required** - Trench integration must be completely separate

---

## 📊 Three-Phase Integration Plan

### **Phase 1: Read-Only (SAFE)** ✅
**Risk:** None  
**Duration:** 30 minutes  
**Go/No-Go:** Safe to proceed after architecture review

**What we add:**
- NEW file: `apps/core/src/api/trench.rs`
- NEW routes: `/api/trench/*` (completely separate namespace)
- Read-only endpoints (quotes, balances, wallet info)

**Safety measures:**
- No state changes
- No transaction execution
- Uses existing Jupiter/RPC clients (read-only)
- No modifications to existing code

**Endpoints:**
```
GET /api/trench/wallet/balance     # Get SOL balance
GET /api/trench/wallet/address     # Get wallet pubkey (read-only)
GET /api/trench/jupiter/quote      # Get swap quote (no execution)
GET /api/trench/jupiter/can-trade  # Check if token is tradeable
```

**Implementation:**
```rust
// NEW FILE: apps/core/src/api/trench.rs
// This is a NEW module, does NOT modify existing code

use actix_web::{get, web::Json, Result as ActixResult};
use serde::Serialize;

#[derive(Serialize)]
pub struct WalletInfo {
    pub address: String,
    pub balance_sol: f64,
}

// Read-only - no risk
#[get("/api/trench/wallet/balance")]
pub async fn get_wallet_balance() -> ActixResult<Json<WalletInfo>> {
    // Uses existing RPC client (read-only)
    // NO state changes
    // NO transaction execution
    todo!("Implementation after approval")
}
```

**Verification:**
- Monitor DevPrint logs during testing
- Confirm no impact on live trading
- Verify read operations work correctly
- Check response times (should not slow down live system)

---

### **Phase 2: Test Wallet (LOW RISK)** ⚠️
**Risk:** Low (separate wallet, small amounts)  
**Duration:** 1 hour  
**Go/No-Go:** Proceed only after Phase 1 verified + Henry approval

**Prerequisites:**
1. ✅ Phase 1 working and verified (no issues)
2. ✅ Test wallet created (separate from live)
3. ✅ Test wallet funded (0.1 SOL only)
4. ✅ Trench API key generated
5. ✅ DevPrint logs show no issues from Phase 1
6. ✅ Henry's approval to proceed

**What we add:**
- Test-only execution endpoints
- Separate authentication (API key)
- Position size limits (max 0.05 SOL)
- Rate limiting (1 trade per 10 seconds)

**Endpoints:**
```
POST /api/trench/trading/buy-test   # Test wallet only
POST /api/trench/trading/sell-test  # Test wallet only
```

**Safety measures:**
- Hardcoded test wallet pubkey (NOT live wallet)
- Max position size: 0.05 SOL
- Rate limit: 1 request per 10 seconds
- Requires special header: `X-Trench-API-Key`
- Dry run by default (requires `execute=true` param)
- Separate from live trading (different wallet)

**Implementation:**
```rust
// Still in apps/core/src/api/trench.rs

#[derive(Deserialize)]
pub struct TestBuyRequest {
    pub token_mint: String,
    pub sol_amount: f64,
    #[serde(default)]
    pub execute: bool,  // Default false = dry run
}

#[post("/api/trench/trading/buy-test")]
pub async fn buy_test(
    Json(req): Json<TestBuyRequest>,
    headers: web::Header<HeaderMap>,
) -> ActixResult<Json<TradeResponse>> {
    // 1. Verify API key
    verify_trench_api_key(&headers)?;
    
    // 2. Verify using TEST wallet (not live)
    let test_wallet_pubkey = "TEST_WALLET_ADDRESS_HERE";  // Hardcoded
    
    // 3. Enforce position limit
    if req.sol_amount > 0.05 {
        return Err(actix_web::error::ErrorBadRequest(
            "Max 0.05 SOL for test trades"
        ));
    }
    
    // 4. Rate limit check
    check_rate_limit()?;
    
    // 5. Execute if requested (default = dry run)
    if !req.execute {
        // Return simulated result
        return Ok(Json(simulated_trade_result()));
    }
    
    // 6. Execute real trade with TEST wallet
    todo!("Implementation after Phase 1 verification")
}
```

**Verification:**
1. Execute 1 test trade (0.01 SOL)
2. Monitor DevPrint logs (confirm no impact on live)
3. Verify Helius webhook detects trade
4. Check Trench backend receives webhook
5. Confirm test agent appears on leaderboard
6. Verify live trading unaffected

**Rollback plan:**
- If ANY issues detected → immediately disable test endpoints
- Remove API key
- Revert code changes if needed
- Investigate logs before proceeding

---

### **Phase 3: Live Wallet (HIGH RISK)** 🚨
**Risk:** High (real wallet, real money)  
**Duration:** After Phase 2 fully verified  
**Go/No-Go:** Requires explicit approval from Henry

**Prerequisites:**
1. ✅ Phase 1 + 2 fully verified (no issues)
2. ✅ Multiple test trades successful
3. ✅ Webhook integration confirmed working
4. ✅ No performance impact observed
5. ✅ DevPrint logs clean (no errors/warnings)
6. ✅ Test wallet trades on leaderboard
7. ✅ Henry's **explicit written approval** to use live wallet
8. ✅ Kill switch tested and working

**What we add:**
- Live execution endpoints (Agent Alpha wallet)
- Additional safety checks
- Emergency kill switch
- Comprehensive logging

**Endpoints:**
```
POST /api/trench/trading/buy-live   # DR wallet - REAL MONEY
POST /api/trench/trading/sell-live  # DR wallet - REAL MONEY
```

**Additional safety measures:**
- Separate API key (different from test)
- Max position size: 0.05 SOL (configurable)
- Confirm balance before EVERY trade
- Log ALL requests (time, amount, token, result)
- Kill switch env var: `TRENCH_TRADING_ENABLED=false`
- Separate rate limit (1 per 30 seconds initially)
- Require confirmation parameter (`confirm=true`)

**Implementation:**
```rust
#[post("/api/trench/trading/buy-live")]
pub async fn buy_live(
    Json(req): Json<LiveBuyRequest>,
    headers: web::Header<HeaderMap>,
) -> ActixResult<Json<TradeResponse>> {
    // 1. Check kill switch
    if !is_trench_trading_enabled() {
        return Err(actix_web::error::ErrorServiceUnavailable(
            "Trench trading disabled"
        ));
    }
    
    // 2. Verify API key (DIFFERENT from test key)
    verify_trench_live_api_key(&headers)?;
    
    // 3. Require confirmation
    if !req.confirm {
        return Err(actix_web::error::ErrorBadRequest(
            "Must set confirm=true for live trades"
        ));
    }
    
    // 4. Enforce position limit
    if req.sol_amount > get_max_position_size() {
        return Err(actix_web::error::ErrorBadRequest(
            format!("Exceeds max position size: {}", get_max_position_size())
        ));
    }
    
    // 5. Check balance + reserve
    verify_sufficient_balance(req.sol_amount)?;
    
    // 6. Rate limit check (stricter)
    check_live_rate_limit()?;
    
    // 7. Log request (BEFORE execution)
    log_live_trade_request(&req);
    
    // 8. Execute with DR wallet
    let result = execute_live_trade(&req).await?;
    
    // 9. Log result
    log_live_trade_result(&result);
    
    Ok(Json(result))
}
```

**Verification:**
1. Execute 1 TINY trade (0.01 SOL)
2. Monitor DevPrint extensively
3. Verify webhook + leaderboard
4. Wait 1 hour, check for any issues
5. If stable: Execute 2nd trade
6. If stable: Gradually increase to 0.05 SOL max

**Rollback plan:**
- Set `TRENCH_TRADING_ENABLED=false` immediately if issues
- Revoke API key
- Disable routes in DevPrint
- Investigate before re-enabling

---

## 🔐 Authentication Strategy

### **Separate API Keys:**

```bash
# DevPrint .env

# Phase 1: Read-only key (can only GET)
TRENCH_READONLY_API_KEY=trench_readonly_xxxxxxxxxxxxx

# Phase 2: Test wallet key (can execute with test wallet)
TRENCH_TEST_API_KEY=trench_test_xxxxxxxxxxxxx

# Phase 3: Live wallet key (can execute with DR wallet)
TRENCH_LIVE_API_KEY=trench_live_xxxxxxxxxxxxx  # Most sensitive!
```

### **Header Verification:**

```rust
fn verify_trench_api_key(headers: &HeaderMap) -> Result<(), ActixError> {
    let key = headers.get("X-Trench-API-Key")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| actix_web::error::ErrorUnauthorized("Missing API key"))?;
    
    let expected = std::env::var("TRENCH_READONLY_API_KEY")
        .map_err(|_| actix_web::error::ErrorInternalServerError("API key not configured"))?;
    
    if key != expected {
        return Err(actix_web::error::ErrorUnauthorized("Invalid API key"));
    }
    
    Ok(())
}
```

---

## 📋 Pre-Implementation Requirements

### **Information Needed from Henry:**

1. **DevPrint Repository:**
   - [ ] Exact path to DevPrint repo
   - [ ] Current branch/version
   - [ ] Build/run instructions

2. **Architecture Review:**
   - [ ] Review current API structure
   - [ ] Identify safe extension points
   - [ ] Check existing authentication
   - [ ] Verify no conflicts with planned changes

3. **Live System Status:**
   - [ ] Is DevPrint currently trading?
   - [ ] What wallet is it using?
   - [ ] Is Agent Alpha wallet in use elsewhere?
   - [ ] Any upcoming DevPrint changes?

4. **Testing Resources:**
   - [ ] Can we create a test wallet?
   - [ ] How much SOL for testing? (0.1 SOL sufficient?)
   - [ ] Where to test? (devnet or mainnet with small amounts?)

5. **Approval Process:**
   - [ ] Who approves Phase 2 → Phase 3?
   - [ ] What metrics determine "safe to proceed"?
   - [ ] What's the rollback procedure if issues occur?

---

## 🛡️ Safety Checklist (Before Each Phase)

### **Phase 1 Checklist:**
- [ ] Reviewed DevPrint architecture
- [ ] Identified safe extension points
- [ ] Created NEW `trench.rs` file (no modifications to existing)
- [ ] Read-only endpoints only
- [ ] No state changes possible
- [ ] Separate namespace (`/api/trench/*`)
- [ ] Henry approved approach

### **Phase 2 Checklist:**
- [ ] Phase 1 completed with no issues
- [ ] Test wallet created and funded
- [ ] Test API key generated
- [ ] Position limits enforced (0.05 SOL max)
- [ ] Rate limiting implemented
- [ ] Dry run mode default
- [ ] Separate from live trading (different wallet)
- [ ] Rollback plan documented
- [ ] Henry approved Phase 2

### **Phase 3 Checklist:**
- [ ] Phase 1 + 2 fully verified
- [ ] Multiple successful test trades
- [ ] Webhook integration confirmed
- [ ] No DevPrint issues observed
- [ ] Kill switch tested
- [ ] Live API key generated (separate)
- [ ] Additional safety measures in place
- [ ] Comprehensive logging enabled
- [ ] Henry's **explicit written approval**
- [ ] Emergency contact plan

---

## 🚨 Emergency Procedures

### **If ANY Issues Detected:**

**Immediate Actions:**
1. Set kill switch: `TRENCH_TRADING_ENABLED=false`
2. Revoke API keys
3. Stop Trench backend
4. Check DevPrint logs for errors
5. Verify live trading unaffected

**Investigation:**
1. Review all logs (DevPrint + Trench)
2. Check Solana transactions
3. Verify wallet balances
4. Identify root cause

**Resolution:**
1. Fix issue
2. Test in isolation
3. Get Henry's approval
4. Re-enable with monitoring

**Escalation:**
- If live trading affected → Immediately notify Henry
- If wallet balance unexpected → STOP ALL TRADING
- If any financial loss → Document and escalate

---

## 📊 Success Metrics

### **Phase 1 Success:**
- ✅ Read-only endpoints respond correctly
- ✅ No errors in DevPrint logs
- ✅ No performance impact on live trading
- ✅ Response times acceptable (<500ms)

### **Phase 2 Success:**
- ✅ Test trades execute successfully
- ✅ Webhook detects trades
- ✅ Test agent appears on leaderboard
- ✅ No impact on live DevPrint operations
- ✅ Rate limiting works
- ✅ Position limits enforced

### **Phase 3 Success:**
- ✅ Live trades execute successfully
- ✅ Agent Alpha on leaderboard with real PnL
- ✅ Webhook integration stable
- ✅ No DevPrint issues
- ✅ Kill switch tested and working
- ✅ All safety measures functioning

---

## 📁 File Structure

```
devprint/
├── apps/core/src/
│   ├── api/
│   │   ├── mod.rs (register trench module)
│   │   └── trench.rs ← NEW FILE (Phase 1-3 endpoints)
│   └── trading/ ← NEVER MODIFY (existing live system)
│       ├── jupiter.rs
│       ├── real_trader.rs
│       └── jito.rs
```

**Key principle:** All Trench integration code goes in NEW files, never modify existing trading code.

---

## 🎯 Current Status

**Phase:** PRE-IMPLEMENTATION  
**Status:** ⏳ AWAITING SAFETY VERIFICATION  
**Next:** Gather information from Henry before writing ANY code

**Questions for Henry:**
1. DevPrint repo location?
2. Current live trading status?
3. Safe to add read-only endpoints?
4. Approval to create test wallet?
5. Go/no-go for Phase 1?

---

## ✅ Approval Required

**Before Phase 1:**
- [ ] Henry confirms DevPrint location
- [ ] Architecture reviewed
- [ ] Safe extension points identified
- [ ] Henry approves read-only approach

**Before Phase 2:**
- [ ] Phase 1 verified successful
- [ ] Test wallet created
- [ ] Henry approves test execution

**Before Phase 3:**
- [ ] Phase 1 + 2 verified successful
- [ ] Henry provides **explicit written approval**
- [ ] Kill switch tested
- [ ] Emergency procedures reviewed

---

**REMEMBER:** Live trading system must NEVER be compromised. When in doubt, STOP and ask Henry.
