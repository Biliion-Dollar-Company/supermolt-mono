# DevPrint API Analysis - Trench Integration

**Date:** February 4, 2026 12:00 PM  
**Location:** `~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/devprint/apps/core`  
**Framework:** Rust + Axum web server  
**Port:** 3001 (same as Trench backend)  
**Deployment:** Railway

---

## 🎯 DISCOVERY SUMMARY

DevPrint is a **production Rust application** with:
- ✅ Axum web server (modern Rust HTTP framework)
- ✅ Jupiter integration (`trading/jupiter.rs`)
- ✅ Trade execution engine (`trading/executor.rs`)
- ✅ Existing trading API (`api/trading.rs`)
- ✅ WebSocket support (real-time updates)
- ✅ Supabase database (not PostgreSQL)
- ✅ Already deployed to Railway

---

## 📊 EXISTING TRADING API ENDPOINTS

**Base URL:** `http://localhost:3001/api/trading`

### **Already Available:**

#### **1. Configuration**
```
GET  /api/trading/config          # Get trading config + balance
POST /api/trading/config          # Update config
```

#### **2. Positions**
```
GET  /api/trading/positions       # Get all positions
  Query params:
    - status: "open" | "closed" | "partially_closed"
    - version_id: Agent version UUID
    - start_date: YYYY-MM-DD
    - end_date: YYYY-MM-DD
    - limit: Max results (default 100, max 500)
    - offset: Pagination
```

#### **3. Paper Trading (Simulation)**
```
POST /api/trading/simulate/buy    # Simulate buy (no real execution)
  Body: {
    "mint": "token_mint",
    "token_name": "Token Name",
    "ticker": "SYMBOL",
    "price": 0.000123
  }

POST /api/trading/force-close     # Force close position
  Body: { "mint": "token_mint" }
  Header: X-Trading-Token (protection)
```

#### **4. Real Trading (Password Protected)**
```
POST /api/trading/buy/real        # Execute REAL buy
  Body: {
    "mint": "token_mint",
    "amount_sol": 0.01,
    "password": "secret"
  }

POST /api/trading/sell/real       # Execute REAL sell
  Body: {
    "mint": "token_mint",
    "password": "secret"
  }
```

#### **5. Statistics**
```
GET  /api/trading/stats            # Performance stats
GET  /api/trading/stats/hourly     # Hourly breakdown
GET  /api/trading/stats/daily      # Daily breakdown
```

---

## 🔐 SECURITY ANALYSIS

### **Current Security:**

**1. Password Protection**
- Real trades require `password` in request body
- Password: `TRADING_PASSWORD` env var
- Default: Not set (blocks all real trades)

**2. Protection Token**
- Destructive ops require `X-Trading-Token` header
- Token: `3492e3af-0a6e-4409-bbd6-bf78396628ec` (hardcoded)
- Used for: Force-close, delete operations

**3. Trading Mode**
- Env var: `TRADING_LIVE_MODE=true` (enables real trading)
- Default: `false` (paper mode only)
- All endpoints check this flag

---

## 🆕 ENDPOINTS TO CREATE FOR TRENCH

**New file:** `apps/core/src/api/trench.rs`

### **Phase 1: Read-Only (SAFE)** ✅

```rust
// GET /api/trench/quote/buy
// Get Jupiter quote for buying token with SOL
// No execution, just price estimation
#[derive(Deserialize)]
pub struct TrenchQuoteRequest {
    pub token_mint: String,
    pub sol_amount: f64,
    pub slippage_bps: Option<u16>,  // Default: 50 (0.5%)
}

#[derive(Serialize)]
pub struct TrenchQuoteResponse {
    pub success: bool,
    pub quote: SwapQuote,  // Jupiter quote object
    pub estimated_tokens: f64,
    pub price_impact_pct: f64,
    pub routes: Vec<String>,  // DEXs used
}

// GET /api/trench/wallet/info
// Get wallet info (address, balance)
#[derive(Serialize)]
pub struct TrenchWalletInfo {
    pub address: String,
    pub balance_sol: f64,
    pub is_live_mode: bool,
}

// GET /api/trench/token/tradeable
// Check if token is tradeable on Jupiter
#[derive(Deserialize)]
pub struct TrenchTradeableRequest {
    pub token_mint: String,
}

#[derive(Serialize)]
pub struct TrenchTradeableResponse {
    pub tradeable: bool,
    pub reason: Option<String>,  // "No route found" etc.
}
```

---

### **Phase 2: Test Wallet (LOW RISK)** ⚠️

```rust
// POST /api/trench/trade/execute
// Execute buy/sell trade
// Requires: X-Trench-API-Key header
#[derive(Deserialize)]
pub struct TrenchTradeRequest {
    pub action: String,  // "buy" or "sell"
    pub token_mint: String,
    pub amount_sol: Option<f64>,  // For buy
    pub amount_tokens: Option<f64>,  // For sell
    pub slippage_bps: Option<u16>,
    pub confirm: bool,  // Must be true to execute
}

#[derive(Serialize)]
pub struct TrenchTradeResponse {
    pub success: bool,
    pub signature: Option<String>,
    pub input_mint: String,
    pub output_mint: String,
    pub input_amount: f64,
    pub output_amount: f64,
    pub price_impact_pct: f64,
    pub fees: TrenchFees,
    pub executed_at: String,  // ISO timestamp
}

#[derive(Serialize)]
pub struct TrenchFees {
    pub network_fee_sol: f64,
    pub priority_fee_sol: f64,
    pub swap_fee_sol: f64,
    pub total_fee_sol: f64,
}
```

---

## 🏗️ IMPLEMENTATION PLAN

### **File Structure**

```
devprint/apps/core/src/
├── api/
│   ├── mod.rs              # Register trench module
│   ├── trading.rs          # Existing (DON'T MODIFY)
│   └── trench.rs           # NEW (Trench-specific endpoints)
└── trading/
    ├── jupiter.rs          # Existing (reuse)
    ├── executor.rs         # Existing (reuse)
    └── helius_sender.rs    # Existing (reuse)
```

---

### **Step 1: Create `trench.rs`**

```rust
//! Trench Integration API
//!
//! Dedicated endpoints for Trench backend to call.
//! These are separate from main trading API to:
//! - Isolate Trench traffic
//! - Different authentication
//! - Separate rate limiting
//! - Easy to disable if needed

use axum::{
    extract::{Query, State},
    http::{StatusCode, HeaderMap},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};

use crate::trading::{
    jupiter::{JupiterClient, SOL_MINT},
    executor::{TradingExecutor, BuyResult, SellResult},
};

// ============================================
// Configuration
// ============================================

/// Trench API key (from env: TRENCH_API_KEY)
fn get_trench_api_key() -> Option<String> {
    std::env::var("TRENCH_API_KEY").ok()
}

/// Verify Trench API key from header
fn verify_api_key(headers: &HeaderMap) -> Result<(), StatusCode> {
    let expected_key = get_trench_api_key()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let provided_key = headers
        .get("X-Trench-API-Key")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    if provided_key != expected_key {
        return Err(StatusCode::UNAUTHORIZED);
    }
    
    Ok(())
}

// ============================================
// State
// ============================================

#[derive(Clone)]
pub struct TrenchState {
    pub jupiter: Arc<JupiterClient>,
    pub executor: Arc<TradingExecutor>,
}

// ============================================
// Request/Response Types
// ============================================

#[derive(Debug, Deserialize)]
pub struct QuoteRequest {
    pub token_mint: String,
    pub sol_amount: f64,
    #[serde(default = "default_slippage")]
    pub slippage_bps: u16,
}

fn default_slippage() -> u16 {
    50 // 0.5%
}

#[derive(Debug, Serialize)]
pub struct QuoteResponse {
    pub success: bool,
    pub estimated_tokens: f64,
    pub price_impact_pct: f64,
    pub routes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct WalletInfo {
    pub address: String,
    pub balance_sol: f64,
    pub is_live_mode: bool,
}

#[derive(Debug, Deserialize)]
pub struct TradeableRequest {
    pub token_mint: String,
}

#[derive(Debug, Serialize)]
pub struct TradeableResponse {
    pub tradeable: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TradeRequest {
    pub action: String,  // "buy" or "sell"
    pub token_mint: String,
    pub amount_sol: Option<f64>,
    #[serde(default = "default_slippage")]
    pub slippage_bps: u16,
    pub confirm: bool,  // Must be true
}

#[derive(Debug, Serialize)]
pub struct TradeResponse {
    pub success: bool,
    pub signature: Option<String>,
    pub input_mint: String,
    pub output_mint: String,
    pub input_amount: f64,
    pub output_amount: f64,
    pub price_impact_pct: f64,
    pub executed_at: String,
}

// ============================================
// Phase 1: Read-Only Endpoints
// ============================================

/// GET /api/trench/quote/buy
/// Get Jupiter quote for buying token with SOL
pub async fn get_buy_quote(
    State(state): State<TrenchState>,
    Query(req): Query<QuoteRequest>,
) -> Result<Json<QuoteResponse>, StatusCode> {
    // Get quote from Jupiter
    let lamports = (req.sol_amount * 1_000_000_000.0) as u64;
    
    let quote = state
        .jupiter
        .quote_buy(&req.token_mint, lamports, req.slippage_bps)
        .await
        .map_err(|e| {
            warn!("Jupiter quote failed: {}", e);
            StatusCode::BAD_REQUEST
        })?;
    
    let estimated_tokens = quote.out_amount.parse::<f64>()
        .unwrap_or(0.0) / 1_000_000_000.0;  // Assuming 9 decimals
    
    let price_impact = quote.price_impact_pct
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    
    let routes = quote.route_plan
        .iter()
        .filter_map(|r| r.swap_info.label.clone())
        .collect();
    
    Ok(Json(QuoteResponse {
        success: true,
        estimated_tokens,
        price_impact_pct: price_impact,
        routes,
    }))
}

/// GET /api/trench/wallet/info
/// Get wallet address and balance
pub async fn get_wallet_info(
    State(state): State<TrenchState>,
) -> Result<Json<WalletInfo>, StatusCode> {
    let balance = state.executor.get_sol_balance().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let address = state.executor.get_wallet_address()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let is_live = std::env::var("TRADING_LIVE_MODE")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);
    
    Ok(Json(WalletInfo {
        address,
        balance_sol: balance,
        is_live_mode: is_live,
    }))
}

/// GET /api/trench/token/tradeable
/// Check if token can be traded on Jupiter
pub async fn check_tradeable(
    State(state): State<TrenchState>,
    Query(req): Query<TradeableRequest>,
) -> Result<Json<TradeableResponse>, StatusCode> {
    let tradeable = state.jupiter.can_quote(&req.token_mint).await;
    
    Ok(Json(TradeableResponse {
        tradeable,
        reason: if !tradeable {
            Some("No route found".to_string())
        } else {
            None
        },
    }))
}

// ============================================
// Phase 2: Execution Endpoints (Protected)
// ============================================

/// POST /api/trench/trade/execute
/// Execute buy or sell trade
/// Requires: X-Trench-API-Key header
pub async fn execute_trade(
    State(state): State<TrenchState>,
    headers: HeaderMap,
    Json(req): Json<TradeRequest>,
) -> Result<Json<TradeResponse>, StatusCode> {
    // Verify API key
    verify_api_key(&headers)?;
    
    // Require confirm=true
    if !req.confirm {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Check trading mode
    let live_mode = std::env::var("TRADING_LIVE_MODE")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);
    
    if !live_mode {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    
    // Execute trade based on action
    match req.action.to_lowercase().as_str() {
        "buy" => {
            let sol_amount = req.amount_sol.ok_or(StatusCode::BAD_REQUEST)?;
            
            // Execute buy via executor
            let result = state.executor
                .buy(&req.token_mint, sol_amount, req.slippage_bps)
                .await
                .map_err(|e| {
                    warn!("Buy failed: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            
            Ok(Json(TradeResponse {
                success: true,
                signature: result.signature.map(|s| s.to_string()),
                input_mint: SOL_MINT.to_string(),
                output_mint: req.token_mint,
                input_amount: result.amount_sol,
                output_amount: result.tokens_received,
                price_impact_pct: 0.0,  // TODO: Get from result
                executed_at: chrono::Utc::now().to_rfc3339(),
            }))
        }
        "sell" => {
            // Execute sell
            let result = state.executor
                .sell(&req.token_mint, None, req.slippage_bps)
                .await
                .map_err(|e| {
                    warn!("Sell failed: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            
            Ok(Json(TradeResponse {
                success: true,
                signature: result.signature.map(|s| s.to_string()),
                input_mint: req.token_mint,
                output_mint: SOL_MINT.to_string(),
                input_amount: result.tokens_sold,
                output_amount: result.sol_received,
                price_impact_pct: 0.0,
                executed_at: chrono::Utc::now().to_rfc3339(),
            }))
        }
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

// ============================================
// Router
// ============================================

pub fn router(state: TrenchState) -> Router {
    Router::new()
        // Phase 1: Read-only
        .route("/api/trench/quote/buy", get(get_buy_quote))
        .route("/api/trench/wallet/info", get(get_wallet_info))
        .route("/api/trench/token/tradeable", get(check_tradeable))
        // Phase 2: Execution
        .route("/api/trench/trade/execute", post(execute_trade))
        .with_state(state)
}
```

---

### **Step 2: Register in `mod.rs`**

Add to `apps/core/src/api/mod.rs`:

```rust
pub mod trench;  // Add this line

// In run_server_with_config():
let trench_state = trench::TrenchState {
    jupiter: Arc::clone(&jupiter),
    executor: Arc::clone(&executor),
};

let app = Router::new()
    // ... existing routes ...
    .merge(trench::router(trench_state))  // Add this
    .layer(cors);
```

---

### **Step 3: Environment Variables**

Add to DevPrint's `.env`:

```bash
# Trench Integration
TRENCH_API_KEY=trench_secure_api_key_2026_change_me
TRENCH_ENABLED=true  # Kill switch

# Trading config (for Agent Alpha)
TRADING_LIVE_MODE=true  # Enable real trading
SOLANA_PRIVATE_KEY=<Agent_Alpha_private_key>

# Safety limits (optional overrides)
TRENCH_MAX_POSITION_SOL=0.05
TRENCH_RATE_LIMIT_SECONDS=30
```

---

## 🚀 TRENCH BACKEND INTEGRATION

**File:** `SR-Mobile/backend/src/services/agent-simulator.ts`

```typescript
/**
 * Execute swap via DevPrint API
 */
export async function executeSwap(
  connection: Connection,  // Unused (DevPrint handles it)
  keypair: Keypair,  // Unused (DevPrint has the wallet)
  inputMint: string,
  outputMint: string,
  amount: number  // lamports
): Promise<string> {
  const DEVPRINT_URL = process.env.DEVPRINT_API_URL || 'http://localhost:3001';
  const API_KEY = process.env.TRENCH_API_KEY;
  
  if (!API_KEY) {
    throw new Error('TRENCH_API_KEY not set');
  }
  
  // Convert lamports to SOL
  const solAmount = amount / 1e9;
  
  // Call DevPrint's Trench API
  const response = await fetch(`${DEVPRINT_URL}/api/trench/trade/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Trench-API-Key': API_KEY,
    },
    body: JSON.stringify({
      action: 'buy',
      token_mint: outputMint,
      amount_sol: solAmount,
      slippage_bps: 50,  // 0.5%
      confirm: true,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DevPrint trade failed: ${error}`);
  }
  
  const result = await response.json();
  
  console.log(`✅ Trade executed via DevPrint`);
  console.log(`   Signature: ${result.signature}`);
  console.log(`   Output: ${result.output_amount} tokens`);
  
  return result.signature;
}
```

---

## 🛡️ SAFETY MEASURES

### **1. Rate Limiting**

Add to `trench.rs`:

```rust
use std::sync::Mutex;
use std::collections::HashMap;
use std::time::{Instant, Duration};

lazy_static::lazy_static! {
    static ref RATE_LIMITER: Mutex<HashMap<String, Instant>> = Mutex::new(HashMap::new());
}

fn check_rate_limit(api_key: &str) -> Result<(), StatusCode> {
    let mut limiter = RATE_LIMITER.lock().unwrap();
    let now = Instant::now();
    let cooldown = Duration::from_secs(30);  // 30 seconds
    
    if let Some(last_call) = limiter.get(api_key) {
        if now.duration_since(*last_call) < cooldown {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }
    
    limiter.insert(api_key.to_string(), now);
    Ok(())
}
```

### **2. Position Limits**

```rust
fn check_position_limit(sol_amount: f64) -> Result<(), StatusCode> {
    let max_position = std::env::var("TRENCH_MAX_POSITION_SOL")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.05);
    
    if sol_amount > max_position {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    Ok(())
}
```

### **3. Kill Switch**

```rust
fn check_trench_enabled() -> Result<(), StatusCode> {
    let enabled = std::env::var("TRENCH_ENABLED")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);
    
    if !enabled {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    
    Ok(())
}
```

---

## 📊 TESTING PLAN

### **Phase 1: Read-Only (30 mins)**

```bash
# Test quote
curl http://localhost:3001/api/trench/quote/buy?token_mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&sol_amount=0.01

# Test wallet info
curl http://localhost:3001/api/trench/wallet/info

# Test tradeable
curl http://localhost:3001/api/trench/token/tradeable?token_mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

**Success:** All endpoints return data, no errors

---

### **Phase 2: Test Execution (1 hour)**

```bash
# Execute tiny test trade
curl -X POST http://localhost:3001/api/trench/trade/execute \
  -H "Content-Type: application/json" \
  -H "X-Trench-API-Key: trench_secure_api_key_2026_change_me" \
  -d '{
    "action": "buy",
    "token_mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "amount_sol": 0.01,
    "slippage_bps": 50,
    "confirm": true
  }'
```

**Success:**
- Transaction confirmed
- Signature returned
- Webhook detects trade
- Agent appears on leaderboard

---

## ✅ GO/NO-GO CHECKLIST

**Before implementing:**
- [ ] DevPrint is NOT currently trading with DR wallet
- [ ] Safe to add NEW files to DevPrint
- [ ] Henry approves API key approach
- [ ] Henry confirms Phase 1 safe to proceed

**Before Phase 2 (execution):**
- [ ] Phase 1 tested and working
- [ ] API key generated and secure
- [ ] Rate limiting tested
- [ ] Position limits verified
- [ ] Kill switch tested

---

## 🎯 TIMELINE

| Phase | Task | Duration |
|-------|------|----------|
| **1a** | Create `trench.rs` (read-only) | 15 mins |
| **1b** | Register in `mod.rs` | 5 mins |
| **1c** | Test read-only endpoints | 10 mins |
| **2a** | Add execution endpoint | 15 mins |
| **2b** | Add safety measures | 15 mins |
| **2c** | Test with tiny trade (0.01 SOL) | 15 mins |
| **3** | Integrate Trench backend | 10 mins |
| **4** | Full E2E test | 15 mins |
| **Total** | | **1.5-2 hours** |

---

## 📞 NEXT STEPS

**Henry, please confirm:**
1. ✅ Safe to create `trench.rs` in DevPrint
2. ✅ Not interfering with live trading
3. ✅ Phase 1 (read-only) approved to proceed
4. ✅ API key approach acceptable

**Then I will:**
1. Create `trench.rs` with read-only endpoints
2. Register routes in `mod.rs`
3. Test all read-only endpoints
4. Report back before proceeding to Phase 2

---

**Ready to implement when you give the GO! 🚀**
