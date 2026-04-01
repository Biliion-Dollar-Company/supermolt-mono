# Trench Terminal — AI-Powered RWA Portfolio Management

**Date:** 2026-03-25
**Status:** Approved
**Hackathon:** Colosseum Spring 2026 (April 6 – May 11)
**Base:** Trench Terminal codebase (rebrand + extend)

---

## One-Liner

AI agents that autonomously manage diversified portfolios across crypto and real-world assets on Solana, fully compliance-gated.

## Why This Wins

1. **Confirmed whitespace** — No product combines AI decision-making + RWA exposure + portfolio management on Solana (as of March 2026)
2. **$873M RWA on Solana** — 325% growth in 2025, 12 live protocols
3. **We already have 80%** — 18 AI agents, swarm consensus, compliance pipeline, Circle Gateway, multi-chain treasury, ERC-8004 attestation
4. **Secondary market = no KYC barrier** — RWA tokens tradeable on Jupiter without KYC for the demo

## Architecture: Three Layers

### Intelligence Layer (EXISTS)
- 18 AI trading agents with distinct personalities/strategies
- Swarm consensus system: 5 specialists (quant, risk, news, weather, arbitrage)
- Autonomous trading loop (20min intervals, 3 agents/cycle)
- Sortino ratio ranking for risk-adjusted performance
- LLM-powered reasoning for trade decisions

### Execution Layer (EXTEND)
- **Existing:** Jupiter swaps (crypto), multi-chain treasury (Solana/BSC/Base), Circle Gateway (7 chains)
- **New:** Jupiter Swap API v2 for RWA tokens, Pyth oracle price feeds, portfolio allocation engine

### Compliance Layer (EXISTS)
- KYC verification service (mock mode for demo)
- AML sanctions screening (OFAC SDN)
- KYT transaction monitoring (real scoring: large_tx +30, velocity +20, structuring +40)
- Travel Rule IVMS101 messaging (>= $3,000 threshold)
- Compliance gateway orchestrator (single entry point)
- Full audit trail in PostgreSQL

## RWA Assets (via Jupiter Secondary Market)

| Token | Type | Solana Mint | Yield | KYC (Secondary) |
|-------|------|-------------|-------|-----------------|
| USDY (Ondo) | Tokenized T-bills | `A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6` | ~4% APY | None |
| syrupUSDC (Maple) | Institutional lending | TBD | ~6.5-7% APY | None |
| xStocks (Backed) | Tokenized equities (60+) | Various | Equity returns | None |
| PRCL (Parcl) | Real estate derivatives | `4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs` | Variable | None |
| CETES (Etherfuse) | Mexican govt bonds | `CETES7CKqqKQizuSN6iWQwmTeFRjbJR6Vw2XRKfEDR8f` | Variable | None |
| XAUm (Matrixdock) | Tokenized gold | TBD | Gold appreciation | None |

## Price Feeds

- **Pyth Network** (primary): metals (XAU/USD, XAG/USD), equities, rates, FX, crypto — 2,800+ feeds
- **Switchboard** (custom): real estate indices, treasury yield curves, proof-of-reserves
- **Jupiter/DEX** (secondary validation): on-chain token prices

## Branding

### Name & Identity
- **Name:** Trench Terminal
- **Tagline:** AI-Powered Portfolio Intelligence
- **Tone:** Institutional, data-driven, trustworthy

### Color Palette

| Element | Current (Trench Terminal) | New (Trench Terminal) |
|---------|-------------------|-------------------|
| Primary accent | `#E8B45E` (gold) | `#2563EB` (institutional blue) |
| Secondary accent | gold variants | `#D4A04A` (warm gold) |
| Background | `#07090F` | `#0A0E1A` (navy dark) |
| Cards/panels | `#0C1020` | `#0F1629` |
| Borders | `white/6%` | `white/8%` |
| Success/Risk/Warning | green/red/amber | Same |

### Terminology Changes

| Trench Terminal | Trench Terminal |
|-----------|-----------|
| Arena | Portfolio / Agents |
| Agent Cooperation Arena | AI-Powered Portfolio Intelligence |
| Trench Terminal | Trench Terminal |
| pfp.png (snake logo) | Text-based Trench Terminal wordmark |
| Compete / Battle | Manage / Optimize |
| Meme coins | Diversified assets |

## Frontend Changes

### Rebrand Existing Pages
- `/` — New hero copy, Trench Terminal branding, institutional tone
- `/arena` → keep URL but rebrand as "Agents" — agent performance across asset classes
- `/arena/predictions` → keep URL but rebrand as "Markets"
- `/compliance` — Update accent colors only
- `navbar.tsx` — Trench Terminal logo, blue accent, updated nav labels

### New Pages
- `/assets` — RWA asset catalog with live Pyth prices, yields, market caps, risk ratings
- `/treasury` — Portfolio allocation dashboard: asset class pie chart, total AUM, yield projections, performance metrics

### CSS Variable Swap
All color changes via CSS variables in globals.css / tailwind config. Single source of truth for the rebrand.

## Backend Changes

### New Services

#### `backend/src/services/rwa/jupiter-rwa.service.ts`
Jupiter Swap API v2 integration for RWA token trading.
- `getQuote(inputMint, outputMint, amountLamports)` — Fetch swap quote
- `executeSwap(quote, walletKeypair)` — Execute the swap transaction
- `swapUsdcToRwa(rwaToken, usdcAmount, wallet)` — Convenience: USDC → RWA
- `swapRwaToUsdc(rwaToken, rwaAmount, wallet)` — Convenience: RWA → USDC
- RWA_TOKENS registry with mint addresses, decimals, metadata

API: `https://api.jup.ag/swap/v2` (requires API key from https://portal.jup.ag)

#### `backend/src/services/rwa/pyth-oracle.service.ts`
Pyth Network price feed integration via Hermes API.
- `getPrice(feedId)` — Current price + confidence interval
- `getPrices(feedIds[])` — Batch price fetch
- `streamPrices(feedIds[], callback)` — SSE streaming via `https://hermes.pyth.network/v2/updates/price/stream`
- FEED_REGISTRY mapping asset names to Pyth feed IDs

NPM: `@pythnetwork/hermes-client`

#### `backend/src/services/rwa/portfolio-manager.service.ts`
Portfolio allocation and rebalancing engine.
- `getPortfolio(agentId)` — Current holdings breakdown by asset class
- `getTargetAllocation(agentId)` — Agent's target allocation based on strategy/personality
- `calculateRebalanceTrades(current, target)` — Diff → list of trades needed
- `executeRebalance(agentId)` — Run rebalance via Jupiter RWA service
- `getPerformanceMetrics(agentId)` — Sortino, Sharpe, max drawdown, total yield

#### `backend/src/services/rwa/rwa-data.service.ts`
RWA market data aggregation.
- `getRwaTokens()` — All available RWA tokens with prices, yields, caps
- `getAssetClassBreakdown(agentId)` — Portfolio by class (T-bills, equities, gold, real estate, crypto)
- `getYieldRates()` — Current APY for each RWA asset
- Combines Pyth prices + on-chain data + hardcoded metadata

### New Routes: `backend/src/routes/rwa.routes.ts`
- `GET /rwa/tokens` — Available RWA tokens with live data
- `GET /rwa/prices` — Current Pyth prices for all tracked feeds
- `GET /rwa/portfolio/:agentId` — Agent portfolio allocation
- `POST /rwa/rebalance/:agentId` — Trigger portfolio rebalance
- `GET /rwa/yields` — Current yield rates
- `GET /rwa/asset-classes` — Aggregate by asset class

### Modify Existing
- `backend/src/index.ts` — Register RWA routes
- Agent trading loop — Extend to include RWA allocation decisions alongside crypto trades
- Agent personalities — Add RWA strategy profiles (conservative → T-bills heavy, aggressive → equities + crypto)

## Database Changes

### New Models (add to schema.prisma)

```prisma
model RwaToken {
  id          String   @id @default(cuid())
  symbol      String   @unique
  name        String
  mint        String   @unique
  assetClass  AssetClass
  issuer      String
  currentYield Float?
  marketCap   Float?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model PortfolioAllocation {
  id          String     @id @default(cuid())
  agentId     String
  rwaTokenId  String?
  tokenMint   String
  assetClass  AssetClass
  quantity    Float
  entryPrice  Float
  currentPrice Float?
  weight      Float      // percentage of portfolio
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model RebalanceEvent {
  id          String   @id @default(cuid())
  agentId     String
  fromToken   String
  toToken     String
  fromAmount  Float
  toAmount    Float
  txSignature String?
  status      String   @default("PENDING")
  createdAt   DateTime @default(now())
}

enum AssetClass {
  CRYPTO
  TREASURY_BILLS
  EQUITIES
  GOLD
  REAL_ESTATE
  FIXED_INCOME
  GOVERNMENT_BONDS
}
```

## Build Sequence

### Wave 1 (Parallel — No Dependencies)
| Agent | Task | Files |
|-------|------|-------|
| A | Branding CSS swap + logo + text replacements | tailwind.config, globals.css, navbar, home page, all `#E8B45E` refs |
| B | Jupiter RWA service + Pyth oracle service | `services/rwa/jupiter-rwa.service.ts`, `services/rwa/pyth-oracle.service.ts` |
| C | RWA data service + API routes + DB schema | `services/rwa/rwa-data.service.ts`, `routes/rwa.routes.ts`, `schema.prisma` |
| D | Portfolio manager service | `services/rwa/portfolio-manager.service.ts` |

### Wave 2 (Parallel — Depends on Wave 1)
| Agent | Task | Depends On |
|-------|------|-----------|
| E | `/assets` page — RWA catalog with live prices | C (rwa-data service) |
| F | `/treasury` portfolio dashboard | D (portfolio manager) |
| G | Rebrand home + navbar + arena copy | A (branding done) |
| H | Agent trading loop RWA extension | B (jupiter-rwa service) |

### Wave 3 (Sequential — Integration)
| Agent | Task | Depends On |
|-------|------|-----------|
| I | Integration test + demo data seeding | All of Wave 2 |

## Hackathon Strategy

### Primary Target
**Colosseum Spring 2026** (April 6 – May 11)
- Register day 1
- RWA track likely included (was in Cypherpunk edition)
- Grand Champion: $50K + $250K pre-seed interview

### Secondary Targets
- **Circle Developer Grants** ($5K–$100K) — We use Circle Gateway, CCTP V2, USDC
- **Solana Foundation Grants** — Rolling applications

### Demo Script
1. Show Trench Terminal dashboard — portfolio across 6 asset classes
2. Show AI agents making allocation decisions (conservative agent buys T-bills, aggressive buys equities)
3. Show compliance pipeline gating a transfer (AML screen → KYT score → Travel Rule message)
4. Show cross-chain distribution via Circle Gateway
5. Show real Pyth price feeds updating live
6. Show rebalance execution through Jupiter

## Constraints & Risks

- **USDY liquidity is thin** (~$300K-$1M daily) — large rebalances need execution algorithms
- **US persons excluded** from most RWA tokens — demo from non-US perspective
- **Some mint addresses TBD** (syrupUSDC, XAUm on Solana) — need to verify on-chain
- **Jupiter API key required** — register at portal.jup.ag
- **Pyth feeds for some RWA assets may be limited** — fallback to on-chain DEX prices
