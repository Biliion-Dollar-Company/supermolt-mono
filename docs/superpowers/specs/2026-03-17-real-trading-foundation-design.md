# Build 1 — Real Trading Foundation

**Date:** 2026-03-17
**Status:** Draft
**Scope:** Wire real on-chain Jupiter execution, expose deposit flow, build portfolio view

---

## Problem

Users sign up, create an agent, and hit a dead end. Three specific gaps prevent real money from flowing:

1. `agent-trading-loop.ts` writes `PaperTrade` records directly — never goes through the Privy execution path
2. Users have a `config.privyWalletAddress` in the DB but there is zero UI showing it
3. `HELIUS_RPC_URL` is not set in Railway — the Jupiter executor never initialises

The Privy execution path (`executeDirectBuyWithPrivy`) is fully built. The Jupiter quote → sign → on-chain flow works. It just isn't connected to the trading loop.

---

## Architecture

### Existing execution path (already working)

```
auto-buy-executor.ts
  └── processRequest()
        └── getAgentPrivyWalletId() → TradingAgent.privyWalletId
        └── executeDirectBuyWithPrivy()
              └── Jupiter quote (lite-api.jup.ag)
              └── privySignAndSendTransaction(walletId, txBase64)
              └── db.agentTrade.create() ← real on-chain record
```

### Gap: trading loop bypasses this

```
agent-trading-loop.ts
  └── runTradingCycle()
        └── createPaperTrade()  ← writes PaperTrade, skips real execution
```

### Fix: trading loop calls real execution when wallet exists

```
agent-trading-loop.ts
  └── runTradingCycle()
        └── executeAgentTrade(agent, token, config)
              ├── if agent.privyWalletId + HELIUS_RPC_URL → executeDirectBuyWithPrivy()
              └── else → createPaperTrade()  (graceful fallback)
```

---

## Components

### 1A — Real Execution in Trading Loop

**File:** `backend/src/services/agent-trading-loop.ts`

Replace `createPaperTrade()` call with `executeAgentTrade()`:

- Check if agent has `privyWalletId` AND `HELIUS_RPC_URL` is set
- If yes: construct an `AutoBuyRequest` and call `executeDirectBuyWithPrivy()` (imported from auto-buy-executor)
- If no: fall back to `createPaperTrade()` (unchanged behaviour for agents without wallets)
- Log clearly: `[TradingLoop] REAL TRADE` vs `[TradingLoop] PAPER TRADE`

**`AutoBuyRequest` construction from trading loop context:**

`executeDirectBuyWithPrivy()` expects an `AutoBuyRequest` shape. When called from the trading loop, populate fields as follows:

```typescript
const request: AutoBuyRequest = {
  agentId:     agent.id,
  agentName:   agent.displayName || agent.name,
  tokenMint:   token.mint,
  tokenSymbol: token.symbol,
  tokenName:   token.name,
  solAmount:   config.positionSizeSOL,
  chain:       'SOLANA',
  triggeredBy: 'trading_loop',      // constant for loop-originated trades
  sourceWallet: null,               // no copy-trade source
  reason:      reasoning,           // confidence reasoning string from scorer
  confidence:  confidence,
};
```

**`executor` initialisation:**

`executeDirectBuyWithPrivy()` has a hard guard: `if (!executor) return`. The `executor` is only initialised inside `startAutoBuyExecutor()`. The trading loop does NOT call `startAutoBuyExecutor()`.

Fix: export a `getOrInitExecutor()` helper from `auto-buy-executor.ts` that lazily creates and caches a `TradingExecutor` from `HELIUS_RPC_URL`. Both `startAutoBuyExecutor()` and the trading loop use this helper. This avoids duplicate executor instances and removes the dependency on `startAutoBuyExecutor()` being called first.

```typescript
// auto-buy-executor.ts (add)
export function getOrInitExecutor(): TradingExecutor | null {
  if (!executor) {
    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (rpcUrl) executor = createTradingExecutor(rpcUrl);
  }
  return executor;
}
```

This is a surgical change — no architectural rework needed.

### 1B — Deposit Flow UI

**New component:** `web/components/arena/DepositPanel.tsx`
**Integrated into:** `web/app/arena/page.tsx` (replaces or augments `MyAgentPanel`)

Shows:
- Agent's Solana wallet address (`config.privyWalletAddress`)
- QR code (use `qrcode.react` — already likely in deps, else add)
- Copy-to-clipboard button
- Live SOL balance (fetched from `/api/agent/balance` — new backend endpoint)
- Simple instruction: "Send SOL to this address. Your agent starts trading automatically."

**New backend endpoint:** `GET /agent/balance`
- Auth-protected
- Reads `config.privyWalletAddress` from the agent
- Fetches SOL balance via Helius RPC or `@solana/web3.js` `getBalance()`
- Returns `{ address, solBalance, usdValue }`

### 1C — Portfolio View

**New component:** `web/components/arena/PortfolioPanel.tsx`
**Integrated into:** `web/app/arena/page.tsx` as a tab alongside existing panels

Shows:
- Total portfolio value (SOL balance + open position values)
- P&L (from `AgentTrade` records — sum of realised + unrealised)
- Open positions list (from `AgentPosition` table — already populated by executor)
- Recent trade history (last 20 `AgentTrade` records for this agent)
- Each trade: token symbol, action (BUY/SELL), amount, timestamp, tx signature with Solscan link

**Existing data sources (no new tables needed):**
- `AgentTrade` — real on-chain trades (populated by `executeDirectBuyWithPrivy`)
- `AgentPosition` — open positions (populated by position tracker)
- `AgentStats` — aggregate P&L (populated by sortino cron)

---

## Data Flow

```
User deposits SOL
  → Privy wallet receives funds
  → TradingLoop picks agent every 20 min
  → executeAgentTrade() called
  → executeDirectBuyWithPrivy() → Jupiter → on-chain
  → AgentTrade + AgentPosition created in DB
  → WebSocket broadcasts agent:activity event
  → PortfolioPanel updates in real-time
```

---

## Error Handling

- If Jupiter quote fails: log error, skip this trade, do not crash loop
- If Privy signing fails: log error, fall back to paper trade for this cycle
- If balance fetch fails: show cached value with "last updated" timestamp
- Graceful degradation: agents without `privyWalletId` continue paper trading silently

---

## What Is NOT in Scope

- Fee extraction (Build 3)
- Sell/exit logic changes (existing auto-sell logic unchanged)
- BSC or Base chains (Solana only for this build)
- Mobile app changes

---

## Success Criteria

- [ ] Agent with `privyWalletId` + `HELIUS_RPC_URL` set executes real Jupiter swaps
- [ ] `AgentTrade` records have real `signature` fields (not null)
- [ ] User can see their wallet address and copy it
- [ ] SOL balance displays correctly
- [ ] Portfolio panel shows real trade history with Solscan links
- [ ] Agents without wallets continue paper trading without errors
