# Build 1: Real Trading Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real on-chain Jupiter execution through Privy wallets, expose deposit flow UI, and build portfolio view so users can fund agents and see real trades.

**Architecture:** The Privy execution path (`executeDirectBuyWithPrivy()`) is already fully built. The trading loop bypasses it by calling `createPaperTrade()` directly. We add `getOrInitExecutor()` to lazily init the Jupiter executor, modify the trading loop to route through real execution when a wallet exists, add a balance endpoint, and build two frontend panels (deposit + portfolio).

**Tech Stack:** Bun/Hono backend, Prisma, Privy wallet API, Jupiter Lite API, Next.js 15, React 19, `@solana/web3.js`, `qrcode.react`

**Spec:** `docs/superpowers/specs/2026-03-17-real-trading-foundation-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/src/services/auto-buy-executor.ts` | Export `getOrInitExecutor()` + `executeDirectBuyWithPrivy()` |
| Modify | `backend/src/services/agent-trading-loop.ts` | Add `privyWalletId` to agent select, route to real execution |
| Create | `backend/src/routes/agent-balance.routes.ts` | `GET /agent/balance` — fetch SOL balance for authenticated agent |
| Modify | `backend/src/index.ts` | Mount `/agent` routes |
| Create | `web/components/arena/DepositPanel.tsx` | Wallet address, QR, balance display |
| Create | `web/components/arena/PortfolioPanel.tsx` | Trades, positions, P&L |
| Modify | `web/app/arena/page.tsx` | Integrate DepositPanel + PortfolioPanel into sidebar |
| Modify | `web/components/arena/index.ts` | Re-export new components |

---

## Chunk 1: Backend — Executor + Trading Loop Wiring

### Task 1: Export `getOrInitExecutor()` from auto-buy-executor

**Files:**
- Modify: `backend/src/services/auto-buy-executor.ts:75-87`

- [ ] **Step 1: Add `getOrInitExecutor()` export**

In `auto-buy-executor.ts`, add this function right before `startAutoBuyExecutor()` (before line 75):

```typescript
/**
 * Lazily initialize and return the Jupiter executor.
 * Safe to call from any module — caches the instance.
 */
export function getOrInitExecutor(): TradingExecutor | null {
  if (!executor) {
    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (rpcUrl) {
      executor = createTradingExecutor(rpcUrl);
      console.log('[AutoBuyExecutor] Lazy-initialized Jupiter executor');
    }
  }
  return executor;
}
```

- [ ] **Step 2: Update `startAutoBuyExecutor()` to use it**

Replace the existing executor init block in `startAutoBuyExecutor()`:

```typescript
export function startAutoBuyExecutor() {
  getOrInitExecutor(); // lazy init, replaces inline init
  if (executor) {
    console.log('[AutoBuyExecutor] Jupiter executor ready');
  } else {
    console.log('[AutoBuyExecutor] No HELIUS_RPC_URL — recommendation-only mode');
  }

  intervalId = setInterval(processQueue, POLL_INTERVAL_MS);
  console.log(`[AutoBuyExecutor] Started (poll every ${POLL_INTERVAL_MS / 1000}s)`);
}
```

- [ ] **Step 3: Export `executeDirectBuyWithPrivy`**

Change the function declaration from `async function` to `export async function` so the trading loop can import it:

```typescript
export async function executeDirectBuyWithPrivy(request: AutoBuyRequest, privyWalletId: string) {
```

- [ ] **Step 4: Verify build compiles**

Run: `cd backend && bun run build` (or `bunx tsc --noEmit`)
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/auto-buy-executor.ts
git commit -m "feat: export getOrInitExecutor() and executeDirectBuyWithPrivy() for trading loop"
```

---

### Task 2: Wire trading loop to real execution

**Files:**
- Modify: `backend/src/services/agent-trading-loop.ts:152-254`

- [ ] **Step 1: Add `privyWalletId` and `config` to agent select**

In `selectRandomAgents()`, add `privyWalletId` and `config` to the `select` object (around line 162):

```typescript
select: {
  id: true,
  archetypeId: true,
  name: true,
  displayName: true,
  totalTrades: true,
  winRate: true,
  totalPnl: true,
  privyWalletId: true,  // ADD
  config: true,          // ADD — contains privyWalletAddress
},
```

- [ ] **Step 2: Add imports at top of file**

```typescript
import { getOrInitExecutor, executeDirectBuyWithPrivy } from './auto-buy-executor';
import type { AutoBuyRequest } from './trigger-engine';
```

- [ ] **Step 3: Add `executeAgentTrade()` function**

Add this function right before `createPaperTrade()` (before line 274):

```typescript
/**
 * Route trade to real execution (Privy wallet) or paper trade (fallback).
 */
async function executeAgentTrade(
  agent: any,
  token: TokenData,
  confidence: number,
  reasoning: string,
  config: TradingLoopConfig
): Promise<void> {
  const executor = getOrInitExecutor();
  const hasRealWallet = agent.privyWalletId && executor;

  if (hasRealWallet) {
    console.log(`[TradingLoop] REAL TRADE: ${agent.displayName || agent.name} → ${token.symbol}`);
    const request: AutoBuyRequest = {
      agentId: agent.id,
      agentName: agent.displayName || agent.name,
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      solAmount: config.positionSizeSOL,
      chain: 'SOLANA',
      triggeredBy: 'trading_loop',
      sourceWallet: '',
      reason: reasoning,
    };

    try {
      await executeDirectBuyWithPrivy(request, agent.privyWalletId);
    } catch (error) {
      console.error(`[TradingLoop] Real trade failed, falling back to paper:`, error);
      await createPaperTrade(agent, token, confidence, reasoning, config);
    }
  } else {
    console.log(`[TradingLoop] PAPER TRADE: ${agent.displayName || agent.name} → ${token.symbol}`);
    await createPaperTrade(agent, token, confidence, reasoning, config);
  }
}
```

- [ ] **Step 4: Replace `createPaperTrade()` call with `executeAgentTrade()`**

In `runTradingCycle()`, change line 254 from:

```typescript
await createPaperTrade(agent, best.token, best.score.confidence, best.score.reasoning, config);
```

To:

```typescript
await executeAgentTrade(agent, best.token, best.score.confidence, best.score.reasoning, config);
```

- [ ] **Step 5: Verify build compiles**

Run: `cd backend && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/agent-trading-loop.ts
git commit -m "feat: route trading loop through real Jupiter execution when Privy wallet exists"
```

---

### Task 3: Add `GET /agent/balance` endpoint

**Files:**
- Create: `backend/src/routes/agent-balance.routes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the balance route file**

Create `backend/src/routes/agent-balance.routes.ts`:

```typescript
/**
 * Agent Balance Routes
 * GET /agent/balance — fetch SOL balance for the authenticated agent's Privy wallet
 */

import { Hono } from 'hono';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { db } from '../lib/db';
import { verifyToken } from '../lib/jwt';
import { getTokenPrice } from '../lib/birdeye';

const agentBalanceRoutes = new Hono();

const SOL_MINT = 'So11111111111111111111111111111111111111112';

async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  try {
    const payload = await verifyToken(authHeader.substring(7));
    if (!payload.agentId) {
      return c.json({ success: false, error: 'Agent JWT required' }, 403);
    }
    c.set('agentId', payload.agentId);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
}

agentBalanceRoutes.get('/balance', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId') as string;

    const agent = await db.tradingAgent.findUnique({
      where: { id: agentId },
      select: { config: true, privyWalletId: true },
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    const config = (agent.config as Record<string, any>) || {};
    const address = config.privyWalletAddress as string | undefined;

    if (!address) {
      return c.json({
        success: true,
        data: { address: null, solBalance: 0, usdValue: 0, hasWallet: false },
      });
    }

    // Fetch SOL balance
    const rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const balance = await connection.getBalance(new PublicKey(address));
    const solBalance = balance / LAMPORTS_PER_SOL;

    // Fetch SOL price for USD conversion
    let usdValue = 0;
    try {
      const solPrice = await getTokenPrice(SOL_MINT);
      usdValue = solBalance * (solPrice?.priceUsd ?? 0);
    } catch {
      // Non-critical — return balance without USD
    }

    return c.json({
      success: true,
      data: {
        address,
        solBalance: parseFloat(solBalance.toFixed(6)),
        usdValue: parseFloat(usdValue.toFixed(2)),
        hasWallet: true,
      },
    });
  } catch (error) {
    console.error('[AgentBalance] Error:', error);
    return c.json({ success: false, error: 'Failed to fetch balance' }, 500);
  }
});

export { agentBalanceRoutes };
```

- [ ] **Step 2: Mount in index.ts**

Find the route mounting section in `backend/src/index.ts` and add:

```typescript
import { agentBalanceRoutes } from './routes/agent-balance.routes';
// ... in the route mounting section:
app.route('/agent', agentBalanceRoutes);
```

- [ ] **Step 3: Verify build compiles**

Run: `cd backend && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/agent-balance.routes.ts backend/src/index.ts
git commit -m "feat: add GET /agent/balance endpoint for Privy wallet SOL balance"
```

---

## Chunk 2: Frontend — Deposit Panel + Portfolio Panel

### Task 4: Install `qrcode.react` dependency

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install**

Run: `cd web && npm install qrcode.react`

- [ ] **Step 2: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "deps: add qrcode.react for deposit panel"
```

---

### Task 5: Add `getAgentBalance` API function

**Files:**
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Add the API function**

Add to `web/lib/api.ts` alongside the other API functions:

```typescript
export async function getMyAgentBalance(): Promise<{
  address: string | null;
  solBalance: number;
  usdValue: number;
  hasWallet: boolean;
}> {
  const res = await apiFetch('/agent/balance');
  return res.data;
}
```

Note: `apiFetch` is the existing authenticated fetch wrapper in this file. Check the exact function name used — it may be `fetchWithAuth`, `apiGet`, or a raw `fetch` with auth headers. Match the existing pattern.

- [ ] **Step 2: Commit**

```bash
git add web/lib/api.ts
git commit -m "feat: add getAgentBalance API function"
```

---

### Task 6: Create DepositPanel component

**Files:**
- Create: `web/components/arena/DepositPanel.tsx`

- [ ] **Step 1: Create the component**

Create `web/components/arena/DepositPanel.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Wallet, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getMyAgentBalance } from '@/lib/api';

const GOLD = '#E8B45E';

interface BalanceData {
  address: string | null;
  solBalance: number;
  usdValue: number;
  hasWallet: boolean;
}

export function DepositPanel() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const data = await getMyAgentBalance();
      setBalance(data);
    } catch (err) {
      console.error('[DepositPanel] Failed to fetch balance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const copyAddress = () => {
    if (!balance?.address) return;
    navigator.clipboard.writeText(balance.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBalance();
  };

  if (loading) {
    return (
      <div
        className="p-4 animate-pulse"
        style={{
          background: 'rgba(12,16,32,0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="h-4 w-24 bg-white/5 rounded mb-3" />
        <div className="h-32 w-32 bg-white/5 rounded mx-auto mb-3" />
        <div className="h-3 w-full bg-white/5 rounded" />
      </div>
    );
  }

  if (!balance?.hasWallet) {
    return (
      <div
        className="p-4"
        style={{
          background: 'rgba(12,16,32,0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={14} style={{ color: GOLD }} />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white/80">
            Agent Wallet
          </span>
        </div>
        <p className="text-xs text-white/35">
          Wallet not yet created. Sign in again to initialize.
        </p>
      </div>
    );
  }

  const truncatedAddress = balance.address
    ? `${balance.address.slice(0, 6)}...${balance.address.slice(-4)}`
    : '';

  return (
    <div
      className="p-4"
      style={{
        background: 'rgba(12,16,32,0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={14} style={{ color: GOLD }} />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white/80">
            Agent Wallet
          </span>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
          title="Refresh balance"
        >
          <RefreshCw size={12} className={`text-white/35 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <div className="text-2xl font-mono font-bold text-white/90">
          {balance.solBalance.toFixed(4)} <span className="text-sm text-white/35">SOL</span>
        </div>
        {balance.usdValue > 0 && (
          <div className="text-xs text-white/35 font-mono">
            ≈ ${balance.usdValue.toFixed(2)} USD
          </div>
        )}
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-4 p-3 bg-white rounded">
        <QRCodeSVG value={balance.address!} size={120} level="M" />
      </div>

      {/* Address + Copy */}
      <button
        onClick={copyAddress}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors rounded cursor-pointer"
      >
        <span className="text-xs font-mono text-white/55 truncate">
          {truncatedAddress}
        </span>
        {copied ? (
          <Check size={14} style={{ color: GOLD }} className="flex-shrink-0" />
        ) : (
          <Copy size={14} className="text-white/35 flex-shrink-0" />
        )}
      </button>

      {/* Instructions */}
      <p className="text-[10px] text-white/25 mt-3 leading-relaxed">
        Send SOL to this address. Your agent starts trading automatically.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/arena/DepositPanel.tsx
git commit -m "feat: create DepositPanel component with QR code and balance display"
```

---

### Task 7: Create PortfolioPanel component

**Files:**
- Create: `web/components/arena/PortfolioPanel.tsx`

- [ ] **Step 1: Create the component**

Create `web/components/arena/PortfolioPanel.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ExternalLink, BarChart2 } from 'lucide-react';
import { getMyAgent } from '@/lib/api';

const GOLD = '#E8B45E';
const YES_C = '#4ade80';
const NO_C = '#f87171';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sr-mobile-production.up.railway.app';

interface AgentTrade {
  id: string;
  tokenSymbol: string;
  tokenMint: string;
  action: 'BUY' | 'SELL';
  solAmount: number;
  tokenAmount: number;
  signature: string | null;
  chain: string;
  createdAt: string;
}

interface AgentPosition {
  tokenMint: string;
  tokenSymbol: string;
  tokenAmount: number;
  avgEntryPrice: number;
  chain: string;
}

export function PortfolioPanel() {
  const [trades, setTrades] = useState<AgentTrade[]>([]);
  const [positions, setPositions] = useState<AgentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'trades' | 'positions'>('trades');

  useEffect(() => {
    async function load() {
      try {
        const agent = await getMyAgent();
        if (!agent?.id) return;

        // Fetch trades and positions for this agent from public endpoints
        const [tradesRes, positionsRes] = await Promise.all([
          fetch(`${API_BASE}/arena/agents/${agent.id}/trades?limit=20`).then(r => r.json()),
          fetch(`${API_BASE}/arena/agents/${agent.id}/positions`).then(r => r.json()),
        ]);

        setTrades(tradesRes.trades || tradesRes.data || []);
        setPositions(positionsRes.positions || positionsRes.data || []);
      } catch (err) {
        console.error('[PortfolioPanel] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div
        className="p-4 animate-pulse"
        style={{
          background: 'rgba(12,16,32,0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="h-4 w-20 bg-white/5 rounded mb-3" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 w-full bg-white/5 rounded mb-2" />
        ))}
      </div>
    );
  }

  const solscanUrl = (sig: string) => `https://solscan.io/tx/${sig}`;

  return (
    <div
      className="p-4"
      style={{
        background: 'rgba(12,16,32,0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} style={{ color: GOLD }} />
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white/80">
          Portfolio
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3">
        {(['trades', 'positions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer font-mono"
            style={tab === t
              ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
              : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}
          >
            {t} {t === 'trades' ? `(${trades.length})` : `(${positions.length})`}
          </button>
        ))}
      </div>

      {/* Trades tab */}
      {tab === 'trades' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {trades.length === 0 ? (
            <p className="text-xs text-white/25 py-4 text-center">No trades yet</p>
          ) : (
            trades.map(trade => (
              <div
                key={trade.id}
                className="flex items-center justify-between py-1.5 px-2 bg-white/[0.02] rounded"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: trade.action === 'BUY' ? YES_C : NO_C,
                      background: trade.action === 'BUY' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                    }}
                  >
                    {trade.action}
                  </span>
                  <span className="text-xs font-mono text-white/80">{trade.tokenSymbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/55">
                    {trade.solAmount?.toFixed(3)} SOL
                  </span>
                  {trade.signature && (
                    <a
                      href={solscanUrl(trade.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white/80 transition-colors"
                    >
                      <ExternalLink size={10} className="text-white/25" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Positions tab */}
      {tab === 'positions' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {positions.length === 0 ? (
            <p className="text-xs text-white/25 py-4 text-center">No open positions</p>
          ) : (
            positions.map(pos => (
              <div
                key={pos.tokenMint}
                className="flex items-center justify-between py-1.5 px-2 bg-white/[0.02] rounded"
              >
                <span className="text-xs font-mono text-white/80">{pos.tokenSymbol}</span>
                <span className="text-xs font-mono text-white/55">
                  {pos.tokenAmount?.toFixed(2)} tokens
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/arena/PortfolioPanel.tsx
git commit -m "feat: create PortfolioPanel component with trades and positions tabs"
```

---

### Task 8: Export new components + integrate into Arena page

**Files:**
- Modify: `web/components/arena/index.ts`
- Modify: `web/app/arena/page.tsx`

- [ ] **Step 1: Add exports to arena index**

In `web/components/arena/index.ts`, add:

```typescript
export { DepositPanel } from './DepositPanel';
export { PortfolioPanel } from './PortfolioPanel';
```

- [ ] **Step 2: Import in arena page**

In `web/app/arena/page.tsx`, update the import from `@/components/arena`:

Add `DepositPanel` and `PortfolioPanel` to the existing destructured import.

- [ ] **Step 3: Add panels to sidebar**

In the arena page's right sidebar section (around line 430-432), replace the standalone `<MyAgentPanel />` with a stack that includes the new panels:

```tsx
{/* Right sidebar */}
<div className="space-y-5">
  <div className="animate-arena-reveal" style={{ animationDelay: '60ms' }}>
    <MyAgentPanel />
  </div>

  {isAuthenticated && (
    <>
      <div className="animate-arena-reveal" style={{ animationDelay: '90ms' }}>
        <DepositPanel />
      </div>
      <div className="animate-arena-reveal" style={{ animationDelay: '120ms' }}>
        <PortfolioPanel />
      </div>
    </>
  )}

  <div className="animate-arena-reveal" style={{ animationDelay: '150ms' }}>
```

Note: Keep the existing leaderboard and epoch panels below. Only add the DepositPanel and PortfolioPanel between MyAgentPanel and the leaderboard section. Wrap in `isAuthenticated` check since logged-out users shouldn't see personal wallet data.

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/components/arena/index.ts web/app/arena/page.tsx
git commit -m "feat: integrate DepositPanel and PortfolioPanel into Arena sidebar"
```

---

## Chunk 3: Verification

### Task 9: End-to-end verification

- [ ] **Step 1: Verify backend starts cleanly**

Run: `cd backend && bun run dev`
Expected: No crash. Should see either `[AutoBuyExecutor] Jupiter executor ready` (if HELIUS_RPC_URL set) or `No HELIUS_RPC_URL — recommendation-only mode`.

- [ ] **Step 2: Verify balance endpoint**

Run (while backend is running):
```bash
curl http://localhost:8080/agent/balance -H "Authorization: Bearer YOUR_JWT"
```
Expected: `{ "success": true, "data": { "address": "...", "solBalance": 0, "usdValue": 0, "hasWallet": true } }` or `hasWallet: false` if no Privy wallet.

- [ ] **Step 3: Verify frontend renders**

Run: `cd web && npm run dev`
Navigate to `/arena`. Should see:
- DepositPanel with wallet address + QR code (if authenticated)
- PortfolioPanel with trades/positions tabs
- Balance showing 0 SOL (until funded)

- [ ] **Step 4: Verify trading loop logging**

Check backend logs during a trading cycle (every 20 min). Should see:
- `[TradingLoop] PAPER TRADE: AgentName → TOKEN` for agents without Privy wallets
- `[TradingLoop] REAL TRADE: AgentName → TOKEN` for agents with Privy wallets + HELIUS_RPC_URL set

- [ ] **Step 5: Final commit — success criteria checklist**

Verify all success criteria from spec:
- [ ] Agent with `privyWalletId` + `HELIUS_RPC_URL` routes through `executeDirectBuyWithPrivy()`
- [ ] `AgentTrade` records will have real `signature` fields once funded
- [ ] User can see wallet address and copy it
- [ ] SOL balance displays correctly (0 until funded)
- [ ] Portfolio panel shows trade history with Solscan links
- [ ] Agents without wallets continue paper trading without errors
