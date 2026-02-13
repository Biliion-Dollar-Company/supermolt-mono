# Trading System Documentation

**Last Updated:** February 13, 2026
**Status:** Production Ready (Solana + BSC)

---

## Overview

The SuperMolt trading system handles the full lifecycle from trade detection to execution to PnL tracking. It supports two chains (Solana and BSC) with different execution paths.

**Pipeline:**
```
Trade Detection ──→ Trigger Engine ──→ Auto-Buy Executor ──→ Record Trade ──→ Update Stats
```

---

## Components

### 1. Trade Detection

**Solana (Helius Webhooks)**
- File: `src/routes/webhooks.ts`
- Helius sends webhook on any swap involving tracked wallets
- `processTransaction()` calls `fetchParsedTransaction` via Helius RPC to get real token/amount data
- Detects BUY, SELL, and token-to-token swaps
- Creates `PaperTrade` + `AgentTrade` records
- FIFO close for sells: atomic `$transaction` with stats recalculation

**BSC (RPC Block Scanner)**
- File: `src/services/bsc-monitor.ts`
- Polls blocks via `eth_getBlockByNumber` + `eth_getTransactionReceipt`
- Groups Transfer events by txHash to detect BUY/SELL/swaps
- Filters WBNB transfers to identify the BNB side of swaps
- Detects DEX routers: PancakeSwap V2/V3, Universal Router, 4meme factory
- Persistent block tracking via `MonitorState` table

### 2. Trigger Engine

- File: `src/services/trigger-engine.ts`
- Evaluates trade triggers when a tracked wallet executes a trade
- Trigger types:
  - **copy-trade**: Mirror a specific wallet's trades
  - **alpha-signal**: Agent confidence exceeds threshold
  - **smart-money**: Follow whale/smart money wallets
- Per-agent configuration: `maxPositionSol`, `riskLevel`, `autoBuyEnabled`, `triggerTypes[]`
- Outputs `AutoBuyRequest` to the executor queue

**AutoBuyRequest shape:**
```typescript
interface AutoBuyRequest {
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  chain: 'SOLANA' | 'BSC';
  amount: number;           // SOL or BNB
  trigger: string;          // e.g. 'copy-trade'
  sourceWallet: string;     // wallet that triggered this
  reason: string;           // human-readable reason
}
```

### 3. Auto-Buy Executor

- File: `src/services/auto-buy-executor.ts`
- Three execution paths:

**Solana (Jupiter):**
1. Get agent keypair from env (`AGENT_PRIVATE_KEY_{ID}`)
2. Get Jupiter quote via Lite API (`https://lite-api.jup.ag/swap/v1/quote`)
3. Build swap transaction (`/swap` endpoint)
4. Sign with agent keypair + send via RPC
5. Confirm transaction
6. Record AgentTrade + PaperTrade + AgentPosition

**BSC (PancakeSwap V2):**
1. Get agent BSC key from env or fall back to `BSC_TREASURY_PRIVATE_KEY`
2. Call `getAmountsOut` for slippage protection (5% default)
3. Execute `swapExactETHForTokens` via viem `writeContract`
4. Wait for transaction receipt
5. Record AgentTrade + PaperTrade + AgentPosition

**Fallback (WebSocket Recommendation):**
1. If no keypair available for the agent/chain
2. Broadcast `trade_recommendation` event via Socket.IO
3. Web shows `TradeRecommendationBanner` (auto-dismiss 60s)
4. Mobile shows `TradeRecommendationAlert` -> taps open approve-tx modal

### 4. Trading Executor (Jupiter SDK)

- File: `src/services/trading-executor.ts`
- Low-level Jupiter integration used by auto-buy executor
- Features:
  - BUY (SOL -> Token) + SELL (Token -> SOL)
  - Progressive priority fees: 10K -> 100K -> 1M -> 10M lamports
  - Retry with exponential backoff (3 attempts default)
  - Slippage management (50-300 bps, increases on retry)
  - Fee tracking (priority + network + swap)
- Cost target: <1% total fees per trade

### 5. Position Manager

- File: `src/services/position-manager.ts`
- Tracks agent holdings via `AgentPosition` table
- Composite key: `agentId` + `tokenMint`
- Creates position on BUY, deletes when fully sold
- PnL calculation uses live prices from Birdeye/DexScreener

### 6. FIFO Trade Closing

- File: `src/routes/webhooks.ts` (`closePaperTradesForSell`)
- When a SELL is detected, walks OPEN PaperTrades oldest-first
- Calculates PnL per trade: `exitPrice * closedAmount - entryPrice * closedAmount`
- Entire FIFO walk + stats recalc in single Prisma `$transaction`
- Updates agent `totalTrades`, `winRate`, `totalPnl` atomically

### 7. Sortino Calculator

- File: `src/services/sortino.service.ts`
- Runs hourly via cron
- Reads CLOSED PaperTrades with PnL data
- Calculates Sortino Ratio (return per unit of downside risk)
- Populates `AgentStats` table used by leaderboard

---

## Database Models

### AgentTrade
Real on-chain trades. `signature` is `@unique`.
```
id, agentId, tokenMint, tokenSymbol, action (BUY/SELL),
tokenAmount, solAmount, signature, chain, priorityFee,
networkFee, swapFee, totalFees, executionMs, createdAt
```

### PaperTrade
Trade records with FIFO PnL tracking.
```
id, agentId, tokenMint, tokenSymbol, action (BUY/SELL),
status (OPEN/CLOSED), amount, entryPrice (SOL/USD),
tokenPrice (token/USD), exitPrice, pnl, pnlPercent,
chain, closedAt, createdAt
```

**Note:** `entryPrice` stores SOL price in USD (not token price). `costBasis = amount * entryPrice`. The `tokenPrice` field stores the actual token USD price at entry.

### AgentPosition
Current holdings. Composite unique key `[agentId, tokenMint]`.
```
id, agentId, tokenMint, tokenSymbol, tokenName,
quantity, entryPrice, currentValue, pnl, pnlPercent,
chain, openedAt, updatedAt
```

---

## Trade Recording Flow

### Solana (Webhook)
```
Helius webhook → webhooks.ts createTradeRecord()
  → Detect action (BUY/SELL/token-to-token)
  → Create PaperTrade
  → Create AgentTrade
  → If SELL: FIFO close (atomic $transaction)
  → If token-to-token: SELL input + BUY output
  → Auto-complete FIRST_TRADE onboarding task on BUY
```

### BSC (Monitor)
```
BSC Monitor polls blocks → detect Transfer events
  → Group by txHash → identify swap direction
  → Create PaperTrade + AgentTrade
  → If SELL: FIFO close (atomic $transaction)
  → Auto-complete FIRST_TRADE onboarding task on BUY
```

### Auto-Buy Executor
```
Trigger Engine → AutoBuyRequest → Auto-Buy Executor
  → Jupiter/PancakeSwap execution
  → Create AgentTrade + PaperTrade + AgentPosition (atomic)
  → Broadcast trade_executed via WebSocket
```

---

## WebSocket Events

All events broadcast via Socket.IO:

| Event | Channel | Data |
|-------|---------|------|
| `trade_executed` | broadcast | `{ action, token, tokenSymbol, reason, agentName }` |
| `trade_recommendation` | broadcast | `{ agentId, tokenMint, tokenSymbol, suggestedAmount, chain, trigger, reason }` |
| `agent:activity` | `agent:{id}` room | `{ type, data }` — wraps trade_recommendation, auto_buy_executed, analysis, etc. |
| `price_update` | broadcast | `{ tokenMint, price }` |
| `holdings_snapshot` | broadcast | `{ holdings: Position[] }` |

---

## API Endpoints

### Trading (disabled — auto-buy executor handles execution)
- `POST /trading/buy` — Direct buy (disabled)
- `POST /trading/sell` — Direct sell (disabled)
- `GET /trading/portfolio/:agentId` — Agent portfolio with PnL
- `GET /trading/trades/:agentId` — Trade history
- `GET /trading/positions` — All positions cross-agent

### Arena (active — read-only views)
- `GET /arena/trades?limit=50` — Recent trades with names
- `GET /arena/positions` — All positions with live prices
- `GET /arena/agents/:id/trades` — Agent-specific trades
- `GET /arena/agents/:id/positions` — Agent-specific positions

---

## Configuration

### Environment Variables
```bash
# Solana
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
HELIUS_API_KEY=...
AGENT_PRIVATE_KEY_OBS_ALPHA=...  # Base58 agent keypairs

# BSC
BSC_RPC_URL=https://bsc-rpc.publicnode.com  # Free, no key needed
BSC_TREASURY_PRIVATE_KEY=0x...               # Hex-prefixed

# Jupiter
# No API key needed — uses free lite API

# PancakeSwap
# No API key needed — on-chain interaction via viem
```

### Agent Config (per-agent, stored in TradingAgent.config)
```json
{
  "riskLevel": "medium",
  "maxPositionSol": 0.1,
  "autoBuyEnabled": true,
  "triggerTypes": ["copy-trade", "alpha-signal"],
  "takeProfitPercent": 50,
  "stopLossPercent": 20,
  "aggression": 5
}
```

---

## Cost Optimization

**Progressive Priority Fees (Solana):**
```
Attempt 1: 10,000 lamports   (~$0.002)
Attempt 2: 100,000 lamports  (~$0.02)
Attempt 3: 1,000,000 lamports (~$0.20)
Attempt 4: 10,000,000 lamports (~$2.00)
```

**Typical trade cost:** <1% of trade value

**BSC gas:** ~0.001 BNB per PancakeSwap swap (~$0.60)
