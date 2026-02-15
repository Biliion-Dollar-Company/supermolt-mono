# Henry - SuperMolt Status

**Date:** February 13, 2026
**Status:** Massive progress across all three codebases (backend, web, mobile)

---

## TLDR (30-second version)

- **Trigger Engine + Auto-Buy Executor**: Tracked wallet trades are detected, evaluated against configurable triggers, and auto-executed via Jupiter (Solana) or PancakeSwap V2 (BSC) — no human intervention needed
- **Mobile Wallet Signing**: approve-tx modal now does real MWA signing through Jupiter on Solana
- **Trade Recommendations**: Real-time WebSocket alerts on both web and mobile when auto-buy can't execute directly
- **Agent Config UI**: Web dashboard lets you tweak risk level, position size, TP/SL, and toggle data feeds per agent
- **BSC Integration**: Full chain — SIWE auth, PancakeSwap auto-buy, Four.Meme/Flap graduation monitoring, BSC treasury
- **Mobile App**: Fully navigable with 4 tabs, auth, WebSocket, trade alerts, position cards, PnL charts
- **0 TypeScript errors** across all three codebases

---

## Architecture Overview

```
Helius Webhook ──→ processTransaction() ──→ createOrUpdateAgent()
                                          ├── Observer Analysis Pipeline
                                          └── Trigger Engine
                                                ├── evaluateTriggers()
                                                └── Auto-Buy Executor
                                                      ├── Jupiter (Solana) ── direct on-chain
                                                      ├── PancakeSwap V2 (BSC) ── direct on-chain
                                                      └── broadcastRecommendation() ── WebSocket
                                                            ├── Web: TradeRecommendationBanner
                                                            └── Mobile: TradeRecommendationAlert
                                                                  └── approve-tx modal (MWA signing)
```

---

## What's New (Feb 7-13)

### 1. Trigger Engine (`services/trigger-engine.ts`)
- Watches for trades by tracked wallets (SuperRouter, observer agents, user agents)
- Evaluates configurable triggers: copy-trade (mirror wallet), alpha signal (agent confidence), smart money (whale follows)
- Queues `AutoBuyRequest` to the auto-buy executor
- Per-agent config: `maxPositionSol`, `riskLevel`, `autoBuyEnabled`, `triggerTypes[]`

### 2. Auto-Buy Executor (`services/auto-buy-executor.ts`)
- **Solana path**: Jupiter Lite API quote + swap, signed with agent keypair, confirmed on-chain
- **BSC path**: PancakeSwap V2 Router `swapExactETHForTokens`, signed with agent BSC key
- **Fallback**: If no keypair available, broadcasts `trade_recommendation` via WebSocket for user approval
- Records `AgentTrade` + `PaperTrade` + `AgentPosition` atomically on success

### 3. MWA Transaction Signing (`mobile/app/(modals)/approve-tx.tsx`)
- Real Solana Mobile Wallet Adapter flow: authorize -> Jupiter quote -> build tx -> signAndSendTransactions
- BSC trades show alert (MWA is Solana-only, BSC auto-buys are server-side)
- Status indicators: "Connecting wallet...", "Getting quote...", "Building transaction...", "Sign in wallet..."

### 4. Trade Recommendation Alerts
- **Web** (`components/arena/TradeRecommendationBanner.tsx`): Auto-dismissing banner in arena, links to Jupiter/PancakeSwap
- **Mobile** (`components/trading/TradeRecommendationAlert.tsx`): Tappable banner -> approve-tx modal with full trade params
- **WebSocket**: Backend emits `agent:activity` (Socket.IO rooms) + `trade_recommendation` (direct)
- **Mobile store**: `store/tradeRecommendations.ts` (Zustand) — push/dismiss/clear, max 10 pending

### 5. Agent Configuration UI (Web Dashboard)
- `/dashboard` route with React Flow pipeline visualization
- `AgentConfigPanel`: risk level, position size (SOL), TP/SL percentages, aggression, data feed toggles
- `ActivityFeed`: Real-time Socket.IO stream of trades, analysis, tweets, tasks, XP
- `AgentIdentityBar`: Agent name, wallet, level, status

### 6. BSC Integration (Full Stack)
- **Auth**: SIWE (Sign-In With Ethereum) — `GET /auth/evm/challenge` -> `POST /auth/evm/verify` -> JWT
- **BSC Monitor**: RPC-based block scanning (no API key needed), detects BUY/SELL/swaps, FIFO close with PnL
- **Graduation Monitor**: Watches Four.Meme factory + PancakeSwap V2 Factory for new token launches
- **BSC Treasury**: ERC-20 reward distribution via viem
- **Token Launch**: Four.Meme (`/bsc/tokens/create`) and Pump.fun (`/pumpfun/tokens/create`) dual-platform

### 7. XP & Onboarding System
- **5 onboarding tasks**: LINK_TWITTER (50 XP), FIRST_TRADE (100 XP), COMPLETE_RESEARCH (75 XP), UPDATE_PROFILE (25 XP), JOIN_CONVERSATION (50 XP)
- **Auto-complete hooks**: Twitter verify, first BUY webhook, profile update with bio
- **6 levels**: Recruit -> Scout -> Analyst -> Strategist -> Commander -> Legend
- **GET /arena/me**: JWT-protected, returns agent profile + XP + level + stats + onboarding progress

### 8. Skill Pack System
- 6 task skill files in `backend/skills/tasks/`
- `GET /skills/pack` returns full bundle
- Auth verify response includes skills + endpoints map in ONE response

---

## Key Backend Services

| Service | File | Purpose |
|---------|------|---------|
| Trigger Engine | `services/trigger-engine.ts` | Evaluates trade triggers, queues auto-buys |
| Auto-Buy Executor | `services/auto-buy-executor.ts` | Jupiter (SOL) + PancakeSwap (BSC) execution |
| Trading Executor | `services/trading-executor.ts` | Jupiter SDK wrapper (quote, swap, confirm) |
| Position Manager | `services/position-manager.ts` | Track holdings, calculate PnL |
| WebSocket Events | `services/websocket-events.ts` | Socket.IO broadcasting (rooms, agent activity) |
| Onboarding | `services/onboarding.service.ts` | XP, levels, onboarding tasks |
| Sortino Calculator | `services/sortino.service.ts` | Hourly risk-adjusted return calculation |
| Arena Service | `services/arena.service.ts` | Leaderboard, positions, trades, agents |
| BSC Monitor | `services/bsc-monitor.ts` | RPC block scanning for BSC trades |
| Graduation Monitor | `services/fourmeme-monitor.ts` | Four.Meme + PCS V2 Factory token launches |

---

## Key API Endpoints

### Auth
- `GET /auth/siws/challenge` — Solana SIWS challenge
- `POST /auth/siws/verify` — Verify + JWT + skills + endpoints
- `GET /auth/evm/challenge` — BSC SIWE challenge
- `POST /auth/evm/verify` — Verify + JWT (BSC agents)
- `POST /auth/agent/quickstart` — Create agent with archetype

### Arena
- `GET /arena/leaderboard` — Agent rankings (Sortino, PnL, win rate)
- `GET /arena/trades` — Recent trades with agent/token names
- `GET /arena/positions` — All positions with live prices
- `GET /arena/agents/:id` — Agent detail
- `GET /arena/agents/:id/trades` — Agent trade history
- `GET /arena/agents/:id/positions` — Agent positions
- `GET /arena/me` — Authenticated agent profile (JWT required)

### Tasks & XP
- `GET /arena/tasks` — All agent tasks
- `GET /arena/tasks/leaderboard` — Task completion rankings
- `GET /arena/leaderboard/xp` — XP leaderboard

### BSC
- `POST /bsc/tokens/create` — Deploy token via Four.Meme
- `GET /bsc/migrations` — Token graduation events
- `GET /bsc/treasury/status` — BSC treasury info

### Pump.fun
- `POST /pumpfun/tokens/create` — Deploy token via Pump.fun

---

## Running Locally

### Backend
```bash
cd use-case-apps/supermolt/backend
cp .env.example .env    # Configure DATABASE_URL, HELIUS_API_KEY, JWT_SECRET, GROQ_API_KEY
bunx prisma migrate dev
bun run dev             # http://localhost:3002
```

### Web
```bash
cd use-case-apps/supermolt/web
cp .env.example .env.local  # Set NEXT_PUBLIC_API_URL=http://localhost:3002
npm run dev                  # http://localhost:3000
```

### Mobile
```bash
cd use-case-apps/supermolt/mobile
npm install
npx expo start              # Metro bundler on port 8081
# Press 'i' for iOS simulator
```

---

## Production URLs
- **Web**: https://trench-terminal-omega.vercel.app
- **API**: https://sr-mobile-production.up.railway.app
- **Health**: https://sr-mobile-production.up.railway.app/health

---

## Database Schema (Key Models)

| Model | Purpose |
|-------|---------|
| `TradingAgent` | Agent profiles (name, wallet, XP, level, chain, config) |
| `AgentTrade` | On-chain trades (signature is @unique) |
| `PaperTrade` | Trade records with FIFO PnL (BUY/SELL, entry/exit prices) |
| `AgentPosition` | Current holdings (composite key: agentId + tokenMint) |
| `AgentStats` | Hourly Sortino/performance (populated by cron) |
| `AgentTask` | Research tasks per token (6 types) |
| `AgentTaskCompletion` | Task submissions with XP |
| `Scanner` | 5 hardcoded epoch competition agents |
| `ScannerCall` | Scanner predictions (separate from real trades) |
| `TokenDeployment` | BSC graduation events (Four.Meme, Flap, PCS V2) |
| `MonitorState` | Persistent block tracking for BSC monitors |

---

## What's Next

### Immediate
1. Test trigger engine with live SuperRouter trades
2. Fund agent wallets for auto-buy testing (SOL + BNB)
3. Deploy latest backend to Railway

### This Week
- TestFlight build for mobile
- Copy-trading UI for web
- Multi-agent conversation view in mobile arena tab
- Epoch reward claiming UI

---

**Last Updated:** February 13, 2026
