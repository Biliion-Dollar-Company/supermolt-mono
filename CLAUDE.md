# SR-Mobile — AI Trading Agent Trainer

Mobile-first AI trading agent platform on Solana. Users pick an agent archetype, watch paper trades powered by DevPrint engine, provide feedback to train their agent. Gamified via Ponzinomics SDK (points, quests, leaderboard). Built for the Pump.fun "Build in Public" Hackathon.

## Monorepo Structure

```text
backend/src/            → Hono + Bun API (agents, trades, feedback)
backend/prisma/         → Prisma schema (PostgreSQL on Railway)
mobile/app/             → Expo Router screens (React Native)
mobile/src/             → Components, hooks, stores, lib
shared/types/           → Shared TypeScript types
docs/architecture/      → Architecture decision records
```

## Three-System Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Mobile App  │────▶│  SR-Mobile API   │◀────│   DevPrint   │
│  (Expo/RN)   │     │  (Hono + Bun)    │     │ (Rust/Tokio) │
└──────┬───────┘     └──────────────────┘     └──────────────┘
       │                                             │
       │              ┌──────────────────┐           │
       └─────────────▶│   Ponzinomics    │           │
                      │  (NestJS Gateway)│           │
                      └──────────────────┘           │
                                                     │
SR-Mobile API owns:  agents, trades, feedback        │
Ponzinomics owns:    auth, points, quests, leaderboard
DevPrint owns:       signals, execution engine ──────┘
```

| System | Owns | Tech | URL |
| ------ | ---- | ---- | --- |
| SR-Mobile API | Agents, paper trades, feedback, archetypes | Hono + Bun + Prisma | Railway (TBD) |
| Ponzinomics | Auth (Privy), points, quests, achievements, leaderboard | NestJS gateway + @sypher/sdk | `ponzinomics-production.up.railway.app` |
| DevPrint | Trading signals, execution, god wallet tracking | Rust + Tokio + Supabase | `devprint-v2-production.up.railway.app` |

---

## Key Source Files

All paths relative to `backend/`.

### Core

| File | Purpose |
| ---- | ------- |
| `src/index.ts` | Hono app setup, route mounting, error handler |
| `src/lib/env.ts` | Zod environment validation |
| `src/lib/db.ts` | Prisma client singleton + health check |
| `src/lib/jwt.ts` | JWT generation/verification (jose, HS256) |
| `src/lib/privy.ts` | Privy token verification, wallet/email extraction |
| `src/lib/redis.ts` | Redis client with in-memory fallback |
| `src/lib/archetypes.ts` | **Agent archetype definitions (code constants)** |
| `prisma/schema.prisma` | **Database schema — 3 models, 4 enums** |

### Routes

| File | Auth | Endpoints |
| ---- | ---- | --------- |
| `src/routes/health.ts` | None | `GET /health`, `GET /health/ready` |
| `src/routes/archetypes.ts` | None | `GET /archetypes`, `GET /archetypes/:id` |
| `src/routes/auth.ts` | Mixed | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| `src/routes/agent.ts` | JWT | CRUD on `/agents` |
| `src/routes/trades.ts` | JWT | Trades + feedback on `/trades` |
| `src/routes/internal.ts` | API Key | DevPrint creates/closes trades on `/internal` |

### Services

| File | Purpose |
| ---- | ------- |
| `src/services/auth.service.ts` | Privy verification → JWT issuance (no local User model) |
| `src/services/agent.service.ts` | Agent CRUD with ownership checks |
| `src/services/trade.service.ts` | Trade queries + internal create/close (transaction for stats) |
| `src/services/feedback.service.ts` | Feedback upsert + aggregation stats |

### Middleware

| File | Purpose |
| ---- | ------- |
| `src/middleware/auth.ts` | JWT Bearer token verification, sets `userId` in context |
| `src/middleware/internal.ts` | `x-api-key` header verification for DevPrint calls |

---

## Database Schema

Three models in PostgreSQL (Railway). No local User model — `userId` is a string reference to Ponzinomics.

### trading_agents

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | cuid | PK |
| userId | string | From Ponzinomics JWT `sub` claim |
| archetypeId | string | `degen_hunter` or `smart_money` |
| name | string | User-chosen name |
| status | AgentStatus | `TRAINING` → `ACTIVE` → `PAUSED` |
| paperBalance | Decimal(18,6) | Starts at 10.0 SOL |
| totalTrades | int | Auto-calculated on trade close |
| winRate | Decimal(5,2) | Auto-calculated on trade close |
| totalPnl | Decimal(18,6) | Auto-calculated on trade close |
| config | JSON | Initialized from archetype tradingParams |

### paper_trades

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | cuid | PK |
| agentId | FK → trading_agents | Cascade delete |
| tokenMint | string | Solana mint address |
| tokenSymbol | string | e.g. `BONK` |
| tokenName | string | e.g. `Bonk` |
| action | TradeAction | `BUY` or `SELL` |
| entryPrice | Decimal(24,12) | USD per token |
| exitPrice | Decimal(24,12)? | Set on close |
| amount | Decimal(18,6) | SOL amount |
| pnl / pnlPercent | Decimal? | Set on close |
| status | TradeStatus | `OPEN` → `CLOSED` or `CANCELLED` |
| signalSource | string | e.g. `migration`, `god_wallet` |
| confidence | int | 0-100 |

### trade_feedbacks

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | cuid | PK |
| tradeId | FK → paper_trades | Cascade delete |
| agentId | FK → trading_agents | Cascade delete |
| userId | string | One feedback per user per trade (`@@unique`) |
| rating | FeedbackRating | `GOOD`, `BAD`, or `SKIP` |
| tags | string[] | e.g. `["good_entry", "bad_timing"]` |
| note | string? | Free-text up to 500 chars |

### Enums

```
AgentStatus:    TRAINING | ACTIVE | PAUSED
TradeAction:    BUY | SELL
TradeStatus:    OPEN | CLOSED | CANCELLED
FeedbackRating: GOOD | BAD | SKIP
```

---

## Agent Archetypes (Option C — Code Constants)

Defined in `src/lib/archetypes.ts`. Not stored in DB or Ponzinomics Unit model.

### degen_hunter

| Stat | Value | Trading Param | Value |
| ---- | ----- | ------------- | ----- |
| aggression | 85 | minMarketCap | $10K |
| riskTolerance | 90 | maxMarketCap | $1M |
| speed | 95 | signalTypes | migration, god_wallet |
| patience | 20 | holdDuration | 5m-2h |
| selectivity | 30 | takeProfitTargets | 2x, 5x, 10x |
| | | stopLossPercent | 50% |
| | | maxPositionSize | 0.5 SOL |

### smart_money

| Stat | Value | Trading Param | Value |
| ---- | ----- | ------------- | ----- |
| aggression | 40 | minMarketCap | $1M |
| riskTolerance | 45 | maxMarketCap | $50M |
| speed | 60 | signalTypes | god_wallet, ai_signal |
| patience | 80 | holdDuration | 1h-24h |
| selectivity | 85 | takeProfitTargets | 1.5x, 3x, 5x |
| | | stopLossPercent | 30% |
| | | maxPositionSize | 1.0 SOL |

---

## API Reference

### Public

```
GET  /                        → API info
GET  /health                  → Liveness probe
GET  /health/ready            → Readiness probe (DB + Redis)
GET  /archetypes              → List all archetypes
GET  /archetypes/:id          → Single archetype details
```

### Auth (POST = public, GET = JWT)

```
POST /auth/login              → { privyToken } → { userId, tokens }
POST /auth/refresh            → { refreshToken } → { tokens }
GET  /auth/me                 → { userId, privyId, wallet }
```

### Agents (JWT required)

```
GET    /agents                → List user's agents
POST   /agents                → { archetypeId, name } → Create agent
GET    /agents/:id            → Agent details + trade/feedback counts
PATCH  /agents/:id/status     → { status } → Update status
DELETE /agents/:id            → Delete agent (cascades trades + feedback)
```

### Trades (JWT required)

```
GET  /trades/:agentId                       → List trades (query: status, limit, offset)
GET  /trades/:agentId/:tradeId              → Single trade + user's feedback
POST /trades/:agentId/:tradeId/feedback     → { rating, tags?, note? } → Submit feedback
GET  /trades/:agentId/feedback/stats        → { total, good, bad, skip, pendingFeedback }
```

### Internal (x-api-key required — DevPrint → SR-Mobile)

```
POST /internal/trades         → Create paper trade (DevPrint signal)
POST /internal/trades/close   → Close paper trade (recalculates agent stats in transaction)
```

---

## Auth Flow

```
Mobile App                    Ponzinomics                SR-Mobile API
    │                              │                          │
    │── sypher.auth.login() ──────▶│                          │
    │◀── Privy JWT ───────────────│                          │
    │                              │                          │
    │── POST /auth/login { privyToken } ─────────────────────▶│
    │                              │         verify Privy     │
    │                              │         issue SR JWT     │
    │◀── { userId, tokens } ─────────────────────────────────│
    │                              │                          │
    │── GET /agents (Bearer JWT) ────────────────────────────▶│
    │◀── agent list ─────────────────────────────────────────│
```

**Key decisions:**
- No local User model. `userId` = Privy ID from JWT `sub` claim.
- SR-Mobile issues its own JWTs (jose, HS256) after verifying Privy token.
- Ponzinomics SDK used client-side for auth + gamification. Not called server-side.

---

## Trade Flow (DevPrint → SR-Mobile)

```
DevPrint (Rust)                           SR-Mobile API
    │                                          │
    │── detect signal (migration/god_wallet) ──│
    │── POST /internal/trades { agentId, ... } ▶│
    │                                          │── create PaperTrade (OPEN)
    │◀── { trade } ──────────────────────────│
    │                                          │
    │   ... price moves ...                    │
    │                                          │
    │── POST /internal/trades/close            ▶│
    │   { tradeId, exitPrice, pnl, pnlPercent }│
    │                                          │── close trade
    │                                          │── recalc agent stats (transaction)
    │◀── { closedTrade } ───────────────────│
```

**Agent stats recalculation** happens atomically in a Prisma `$transaction`:
- Count total closed trades
- Count winning trades (pnl > 0)
- Sum total PnL
- Update `winRate`, `totalTrades`, `totalPnl`, `paperBalance`

---

## Critical Invariants

### No Local User Model
SR-Mobile does NOT store users. The `userId` string on every model is the Privy ID extracted from the JWT. User profile data (email, wallet, avatar) lives in Ponzinomics.

### One Archetype Per User
`agent.service.ts` enforces: a user cannot create two agents with the same `archetypeId`. Returns 409 Conflict.

### Ownership Checks
Every service method that takes `agentId` also takes `userId` and verifies `agent.userId === userId` before returning data. This prevents cross-user data access.

### Trade Close Is Atomic
`closePaperTrade()` uses `prisma.$transaction()` to update the trade AND recalculate agent stats in one atomic operation. No partial state.

### Cascade Deletes
Deleting a TradingAgent cascades to all its PaperTrades and TradeFeedbacks (`onDelete: Cascade`).

### Feedback Uniqueness
One feedback per user per trade (`@@unique([tradeId, userId])`). Submitting again upserts.

---

## Environment Variables

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| PORT | No | 3001 | Server port |
| NODE_ENV | No | development | Environment |
| PRIVY_APP_ID | Yes | — | Privy authentication |
| PRIVY_APP_SECRET | Yes | — | Privy server verification |
| JWT_SECRET | Yes | — | JWT signing (min 32 chars) |
| JWT_EXPIRES_IN | No | 15m | Access token TTL |
| JWT_REFRESH_EXPIRES_IN | No | 7d | Refresh token TTL |
| DATABASE_URL | Yes | — | PostgreSQL connection (Railway) |
| REDIS_URL | No | — | Redis (uses in-memory fallback if unset) |
| DEVPRINT_URL | No | — | DevPrint REST base URL |
| DEVPRINT_WS_URL | No | — | DevPrint WebSocket URL |
| INTERNAL_API_KEY | No | — | Shared key for DevPrint → SR-Mobile calls |

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Runtime | Bun |
| Framework | Hono v4 |
| Database | PostgreSQL (Railway) via Prisma |
| Cache | Redis (Upstash) with in-memory fallback |
| Auth | Privy + jose JWT |
| Validation | Zod |
| Language | TypeScript 5.5 (strict) |
| Mobile | Expo SDK 52 + React Native 0.76 |
| Mobile UI | NativeWind (Tailwind for RN) |
| Navigation | Expo Router (file-based) |
| State | Zustand + AsyncStorage |
| Gamification | @sypher/sdk (Ponzinomics) |

---

## Development

```bash
# Install
cd backend && bun install

# Generate Prisma client
bun run db:generate

# Push schema to DB (no migration history)
bun run db:push

# Create migration (for production)
bun run db:migrate

# Open Prisma Studio
bun run db:studio

# Dev server (hot reload)
bun run dev

# Type check
bun run typecheck
```

---

## Common Gotchas

1. **No `postgres` package** — Removed in v0.2.0. All DB access goes through Prisma. Don't import `postgres`.

2. **userId is NOT a UUID** — It's the Privy ID string (e.g., `did:privy:abc123`). Don't validate as UUID.

3. **Archetypes are code constants** — Not in the database. Changing an archetype means changing `src/lib/archetypes.ts` and redeploying. Agent `config` JSON is a snapshot of archetype params at creation time.

4. **Internal API needs INTERNAL_API_KEY** — If not set in env, all `/internal/*` endpoints return 500. DevPrint must send `x-api-key` header.

5. **Trade close recalculates stats** — Don't manually update `totalTrades`, `winRate`, `totalPnl`, or `paperBalance` on TradingAgent. The `closePaperTrade` transaction handles it.

6. **Feedback is upsert** — `POST /trades/:agentId/:tradeId/feedback` creates or updates. No separate PUT endpoint needed.

7. **No user route** — `src/routes/user.ts` is a stub. User data lives in Ponzinomics, accessed via SDK client-side.

8. **Shared types are stale** — `shared/types/index.ts` contains old v1 types. Backend types are in `backend/src/types/index.ts` and Prisma-generated types.
