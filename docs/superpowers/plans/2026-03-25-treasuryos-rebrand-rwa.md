# Trench Terminal Rebrand + RWA Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand Trench Terminal to Trench Terminal and add RWA (Real World Asset) portfolio management capabilities — AI agents trade tokenized T-bills, gold, equities, and real estate alongside crypto.

**Architecture:** Extend the existing Hono+Bun backend with new RWA services (Jupiter Swap API for trading, Pyth Network for price feeds, portfolio allocation engine). Rebrand the Next.js frontend from gold-themed meme-coin arena to blue-themed institutional portfolio platform. All new backend services follow the mock-mode pattern from `circle-gateway.service.ts`.

**Tech Stack:** Bun + Hono (backend), Next.js 16 (frontend), Prisma 6 + PostgreSQL, Jupiter Swap API v2, Pyth Hermes API, `@pythnetwork/hermes-client`, `@jup-ag/api`

**Spec:** `docs/superpowers/specs/2026-03-25-trench-terminal-rebrand-rwa-design.md`

---

## File Map

### New Files (Backend)
| File | Responsibility |
|------|---------------|
| `backend/src/services/rwa/rwa-tokens.registry.ts` | RWA token mint addresses, metadata, Pyth feed IDs — single source of truth |
| `backend/src/services/rwa/pyth-oracle.service.ts` | Pyth Hermes API client: getPrice, getPrices, streamPrices |
| `backend/src/services/rwa/jupiter-rwa.service.ts` | Jupiter Swap API v2: getQuote, executeSwap for RWA tokens |
| `backend/src/services/rwa/rwa-data.service.ts` | Aggregates RWA token data: prices, yields, asset class breakdown |
| `backend/src/services/rwa/portfolio-manager.service.ts` | Portfolio allocation, rebalancing, performance metrics |
| `backend/src/routes/rwa.routes.ts` | REST endpoints for /rwa/* |
| `backend/src/tests/rwa-services.test.ts` | Tests for all RWA services |

### New Files (Frontend)
| File | Responsibility |
|------|---------------|
| `web/app/assets/page.tsx` | RWA asset catalog page with live Pyth prices |
| `web/components/rwa/AssetCard.tsx` | Individual RWA asset display card |
| `web/components/rwa/PortfolioAllocationChart.tsx` | Pie chart for portfolio asset class breakdown |
| `web/components/rwa/YieldTable.tsx` | Table of current yields across RWA assets |

### Modified Files (Backend)
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add AssetClass enum, RwaToken, PortfolioAllocation, RebalanceEvent models |
| `backend/src/index.ts` | Register RWA routes at `/rwa` |

### Modified Files (Frontend — Branding)
| File | Change |
|------|--------|
| `web/tailwind.config.js` | Change accent colors from gold (#E8B45E) to blue (#2563EB) |
| `web/app/globals.css` | Update hardcoded gold hex values, gradient references |
| `web/app/navbar.tsx` | "Trench Terminal" → "Trench Terminal", update tagline, nav labels |
| `web/app/page.tsx` | Rebrand hero section, partner logos, copy |
| `web/app/layout.tsx` | Update metadata title/description |
| `web/components/reactbits/GradientText.tsx` | Update default gradient colors |
| 50+ files with `#E8B45E` | Find-and-replace accent color references |
| 25+ files with `Trench Terminal` | Find-and-replace brand name |

---

## Task 1: Database Schema — RWA Models

**Files:**
- Modify: `backend/prisma/schema.prisma` (append after existing ComplianceAuditLog model)

- [ ] **Step 1: Add AssetClass enum and RWA models to schema.prisma**

Append at the end of the file:

```prisma
// ─── RWA Portfolio Models ─────────────────────────────────

enum AssetClass {
  CRYPTO
  TREASURY_BILLS
  EQUITIES
  GOLD
  REAL_ESTATE
  FIXED_INCOME
  GOVERNMENT_BONDS
}

model RwaToken {
  id           String     @id @default(cuid())
  symbol       String     @unique
  name         String
  mint         String     @unique
  assetClass   AssetClass
  issuer       String
  currentYield Float?
  marketCap    Float?
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model PortfolioAllocation {
  id           String     @id @default(cuid())
  agentId      String
  tokenMint    String
  assetClass   AssetClass
  symbol       String
  quantity     Float
  entryPrice   Float
  currentPrice Float?
  weight       Float
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([agentId])
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
  reason      String?
  createdAt   DateTime @default(now())

  @@index([agentId])
}
```

- [ ] **Step 2: Run migration**

Run: `cd backend && npx prisma migrate dev --name add-rwa-models`
Expected: Migration applies successfully, Prisma client regenerates.

- [ ] **Step 3: Verify by checking generated types**

Run: `cd backend && npx prisma generate`
Expected: No errors. `RwaToken`, `PortfolioAllocation`, `RebalanceEvent`, `AssetClass` types available.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add RWA portfolio models (RwaToken, PortfolioAllocation, RebalanceEvent)"
```

---

## Task 2: RWA Token Registry

**Files:**
- Create: `backend/src/services/rwa/rwa-tokens.registry.ts`
- Test: `backend/src/tests/rwa-services.test.ts` (start file)

- [ ] **Step 1: Write the test**

Create `backend/src/tests/rwa-services.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { RWA_TOKENS, getRwaToken, getRwaTokensByClass } from '../services/rwa/rwa-tokens.registry';

describe('RWA Token Registry', () => {
  it('should have at least 5 RWA tokens registered', () => {
    expect(RWA_TOKENS.length).toBeGreaterThanOrEqual(5);
  });

  it('should find USDY by symbol', () => {
    const token = getRwaToken('USDY');
    expect(token).toBeDefined();
    expect(token!.mint).toBe('A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6');
    expect(token!.assetClass).toBe('TREASURY_BILLS');
  });

  it('should return undefined for unknown symbol', () => {
    expect(getRwaToken('NONEXISTENT')).toBeUndefined();
  });

  it('should filter tokens by asset class', () => {
    const treasuries = getRwaTokensByClass('TREASURY_BILLS');
    expect(treasuries.length).toBeGreaterThanOrEqual(1);
    treasuries.forEach(t => expect(t.assetClass).toBe('TREASURY_BILLS'));
  });

  it('should have valid Solana mint addresses (base58, 32-44 chars)', () => {
    for (const token of RWA_TOKENS) {
      expect(token.mint.length).toBeGreaterThanOrEqual(32);
      expect(token.mint.length).toBeLessThanOrEqual(44);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

Create `backend/src/services/rwa/rwa-tokens.registry.ts`:

```typescript
/**
 * RWA Token Registry — single source of truth for all supported RWA tokens.
 *
 * Mint addresses are for Solana mainnet. Pyth feed IDs from https://pyth.network/developers/price-feed-ids
 */

export type AssetClassType =
  | 'CRYPTO'
  | 'TREASURY_BILLS'
  | 'EQUITIES'
  | 'GOLD'
  | 'REAL_ESTATE'
  | 'FIXED_INCOME'
  | 'GOVERNMENT_BONDS';

export interface RwaTokenInfo {
  symbol: string;
  name: string;
  mint: string;
  assetClass: AssetClassType;
  issuer: string;
  estimatedYield: number | null;
  pythFeedId: string | null;
  decimals: number;
  description: string;
}

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export const RWA_TOKENS: RwaTokenInfo[] = [
  {
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
    assetClass: 'TREASURY_BILLS',
    issuer: 'Ondo Finance',
    estimatedYield: 4.0,
    pythFeedId: null, // Use on-chain price
    decimals: 6,
    description: 'Yield-bearing token backed by short-term US Treasuries (~4% APY)',
  },
  {
    symbol: 'PRCL',
    name: 'Parcl',
    mint: '4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs',
    assetClass: 'REAL_ESTATE',
    issuer: 'Parcl',
    estimatedYield: null,
    pythFeedId: null,
    decimals: 6,
    description: 'Synthetic perpetual futures on city-specific real estate price indices',
  },
  {
    symbol: 'CETES',
    name: 'Etherfuse CETES',
    mint: 'CETES7CKqqKQizuSN6iWQwmTeFRjbJR6Vw2XRKfEDR8f',
    assetClass: 'GOVERNMENT_BONDS',
    issuer: 'Etherfuse',
    estimatedYield: 10.5,
    pythFeedId: null,
    decimals: 6,
    description: 'Tokenized Mexican government bonds (CETES)',
  },
  {
    symbol: 'XAU',
    name: 'Gold (Pyth Feed)',
    mint: 'GOLD_PLACEHOLDER_MINT_ADDRESS_TBD_ON_MAINNET',
    assetClass: 'GOLD',
    issuer: 'Matrixdock (XAUm)',
    estimatedYield: null,
    // Pyth XAU/USD feed
    pythFeedId: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    decimals: 6,
    description: 'Tokenized LBMA gold (1 token = 1 troy oz)',
  },
  {
    symbol: 'syrupUSDC',
    name: 'Maple syrupUSDC',
    mint: 'SYRUP_USDC_PLACEHOLDER_MINT_TBD_ON_MAINNET',
    assetClass: 'FIXED_INCOME',
    issuer: 'Maple Finance',
    estimatedYield: 6.75,
    pythFeedId: null,
    decimals: 6,
    description: 'Institutional overcollateralized lending (~6.5-7% APY)',
  },
  {
    symbol: 'SPYx',
    name: 'Backed SPY ETF',
    mint: 'SPY_BACKED_PLACEHOLDER_MINT_TBD_ON_MAINNET',
    assetClass: 'EQUITIES',
    issuer: 'Backed Finance',
    estimatedYield: null,
    // Pyth SPY/USD feed
    pythFeedId: '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    decimals: 6,
    description: 'Tokenized S&P 500 ETF (1:1 backed by real shares)',
  },
];

export function getRwaToken(symbol: string): RwaTokenInfo | undefined {
  return RWA_TOKENS.find(t => t.symbol === symbol);
}

export function getRwaTokensByClass(assetClass: AssetClassType): RwaTokenInfo[] {
  return RWA_TOKENS.filter(t => t.assetClass === assetClass);
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/rwa/rwa-tokens.registry.ts backend/src/tests/rwa-services.test.ts
git commit -m "feat: add RWA token registry with 6 tokens and test suite"
```

---

## Task 3: Pyth Oracle Service

**Files:**
- Create: `backend/src/services/rwa/pyth-oracle.service.ts`
- Modify: `backend/src/tests/rwa-services.test.ts` (append tests)

- [ ] **Step 1: Write the test**

Append to `backend/src/tests/rwa-services.test.ts`:

```typescript
import { PythOracleService } from '../services/rwa/pyth-oracle.service';

describe('PythOracleService', () => {
  const pyth = new PythOracleService(true); // mock mode

  it('should return a mock price for XAU/USD', async () => {
    const price = await pyth.getPrice('0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2');
    expect(price).toBeDefined();
    expect(price.price).toBeGreaterThan(0);
    expect(price.confidence).toBeGreaterThan(0);
    expect(price.feedId).toBeDefined();
  });

  it('should return multiple prices in batch', async () => {
    const prices = await pyth.getPrices([
      '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
      '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    ]);
    expect(prices.length).toBe(2);
    prices.forEach(p => expect(p.price).toBeGreaterThan(0));
  });

  it('should return prices for all RWA tokens with Pyth feeds', async () => {
    const allPrices = await pyth.getAllRwaPrices();
    expect(Object.keys(allPrices).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: FAIL — PythOracleService not found.

- [ ] **Step 3: Implement PythOracleService**

Create `backend/src/services/rwa/pyth-oracle.service.ts`:

```typescript
/**
 * Pyth Oracle Service
 *
 * Fetches real-time price feeds from Pyth Network's Hermes API.
 * Covers metals (XAU, XAG), equities (SPY, QQQ), rates, FX, and crypto.
 *
 * Mock mode: returns realistic static prices for offline/CI use.
 * Real mode: calls https://hermes.pyth.network/v2/
 *
 * Docs: https://docs.pyth.network/price-feeds
 */

import { RWA_TOKENS } from './rwa-tokens.registry';

export interface PythPrice {
  feedId: string;
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

const HERMES_BASE = 'https://hermes.pyth.network/v2';

const MOCK_PRICES: Record<string, { price: number; confidence: number }> = {
  // XAU/USD (Gold)
  '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2': { price: 2340.50, confidence: 1.20 },
  // SPY/USD
  '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5': { price: 528.30, confidence: 0.15 },
  // SOL/USD
  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d': { price: 187.45, confidence: 0.42 },
};

export class PythOracleService {
  private mockMode: boolean;

  constructor(mockMode?: boolean) {
    this.mockMode = mockMode ?? (process.env.PYTH_MOCK !== 'false');
  }

  async getPrice(feedId: string): Promise<PythPrice> {
    if (this.mockMode) {
      return this.mockPrice(feedId);
    }

    const res = await fetch(`${HERMES_BASE}/updates/price/latest?ids[]=${feedId}`);
    if (!res.ok) throw new Error(`Pyth API error: ${res.status}`);
    const data = await res.json();
    const parsed = data.parsed?.[0];
    if (!parsed) throw new Error(`No price data for feed ${feedId}`);

    const expo = parsed.price.expo;
    return {
      feedId,
      price: Number(parsed.price.price) * Math.pow(10, expo),
      confidence: Number(parsed.price.conf) * Math.pow(10, expo),
      expo,
      publishTime: parsed.price.publish_time,
    };
  }

  async getPrices(feedIds: string[]): Promise<PythPrice[]> {
    if (this.mockMode) {
      return feedIds.map(id => this.mockPrice(id));
    }

    const params = feedIds.map(id => `ids[]=${id}`).join('&');
    const res = await fetch(`${HERMES_BASE}/updates/price/latest?${params}`);
    if (!res.ok) throw new Error(`Pyth API error: ${res.status}`);
    const data = await res.json();

    return (data.parsed || []).map((p: any) => {
      const expo = p.price.expo;
      return {
        feedId: `0x${p.id}`,
        price: Number(p.price.price) * Math.pow(10, expo),
        confidence: Number(p.price.conf) * Math.pow(10, expo),
        expo,
        publishTime: p.price.publish_time,
      };
    });
  }

  async getAllRwaPrices(): Promise<Record<string, PythPrice>> {
    const feedIds = RWA_TOKENS
      .filter(t => t.pythFeedId)
      .map(t => t.pythFeedId!);

    if (feedIds.length === 0) return {};

    const prices = await this.getPrices(feedIds);
    const result: Record<string, PythPrice> = {};
    for (const p of prices) {
      const token = RWA_TOKENS.find(t => t.pythFeedId === p.feedId);
      if (token) result[token.symbol] = p;
    }
    return result;
  }

  private mockPrice(feedId: string): PythPrice {
    const mock = MOCK_PRICES[feedId] || { price: 100 + Math.random() * 50, confidence: 0.5 };
    return {
      feedId,
      price: mock.price,
      confidence: mock.confidence,
      expo: -8,
      publishTime: Math.floor(Date.now() / 1000),
    };
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: All 8 tests pass (5 registry + 3 pyth).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/rwa/pyth-oracle.service.ts backend/src/tests/rwa-services.test.ts
git commit -m "feat: add Pyth oracle service with mock mode for RWA price feeds"
```

---

## Task 4: Jupiter RWA Swap Service

**Files:**
- Create: `backend/src/services/rwa/jupiter-rwa.service.ts`
- Modify: `backend/src/tests/rwa-services.test.ts` (append tests)

- [ ] **Step 1: Write the test**

Append to `backend/src/tests/rwa-services.test.ts`:

```typescript
import { JupiterRwaService } from '../services/rwa/jupiter-rwa.service';

describe('JupiterRwaService', () => {
  const jupiter = new JupiterRwaService(true); // mock mode

  it('should return a quote for USDC → USDY', async () => {
    const quote = await jupiter.getQuote('USDC', 'USDY', 1000);
    expect(quote).toBeDefined();
    expect(quote.inputAmount).toBe(1000);
    expect(quote.outputAmount).toBeGreaterThan(0);
    expect(quote.priceImpact).toBeDefined();
  });

  it('should return a quote for USDY → USDC', async () => {
    const quote = await jupiter.getQuote('USDY', 'USDC', 500);
    expect(quote.outputAmount).toBeGreaterThan(0);
  });

  it('should throw for unknown token symbol', async () => {
    expect(jupiter.getQuote('USDC', 'FAKE_TOKEN', 100)).rejects.toThrow();
  });

  it('should simulate a swap execution in mock mode', async () => {
    const result = await jupiter.executeSwap('USDC', 'USDY', 1000, 'mock-wallet');
    expect(result.status).toBe('completed');
    expect(result.txSignature).toBeDefined();
    expect(result.inputAmount).toBe(1000);
    expect(result.outputAmount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: FAIL — JupiterRwaService not found.

- [ ] **Step 3: Implement JupiterRwaService**

Create `backend/src/services/rwa/jupiter-rwa.service.ts`:

```typescript
/**
 * Jupiter RWA Swap Service
 *
 * Executes USDC ↔ RWA token swaps via Jupiter Swap API v2.
 * All RWA tokens on Solana are tradeable on Jupiter secondary markets.
 *
 * Mock mode: returns realistic swap simulations for offline/CI use.
 * Real mode: calls https://api.jup.ag/swap/v2 (requires API key from portal.jup.ag)
 *
 * Docs: https://dev.jup.ag/docs/swap
 */

import { RWA_TOKENS, USDC_MINT, getRwaToken } from './rwa-tokens.registry';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fee: number;
  route: string;
}

export interface SwapResult {
  txSignature: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  status: 'completed' | 'failed';
}

const JUP_API = 'https://api.jup.ag';

export class JupiterRwaService {
  private mockMode: boolean;
  private apiKey: string | undefined;

  constructor(mockMode?: boolean) {
    this.mockMode = mockMode ?? (process.env.JUPITER_MOCK !== 'false');
    this.apiKey = process.env.JUPITER_API_KEY;
  }

  private resolveMint(symbol: string): string {
    if (symbol === 'USDC') return USDC_MINT;
    const token = getRwaToken(symbol);
    if (!token) throw new Error(`Unknown RWA token: ${symbol}`);
    return token.mint;
  }

  async getQuote(inputSymbol: string, outputSymbol: string, amount: number): Promise<SwapQuote> {
    const inputMint = this.resolveMint(inputSymbol);
    const outputMint = this.resolveMint(outputSymbol);

    if (this.mockMode) {
      return this.mockQuote(inputMint, outputMint, inputSymbol, outputSymbol, amount);
    }

    const amountLamports = Math.floor(amount * 1_000_000); // 6 decimals
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountLamports.toString(),
      slippageBps: '50', // 0.5%
    });

    const res = await fetch(`${JUP_API}/swap/v2/quote?${params}`, {
      headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
    });
    if (!res.ok) throw new Error(`Jupiter quote error: ${res.status}`);
    const data = await res.json();

    return {
      inputMint,
      outputMint,
      inputAmount: amount,
      outputAmount: Number(data.outAmount) / 1_000_000,
      priceImpact: Number(data.priceImpactPct || 0),
      fee: amount * 0.001, // ~0.1% platform fee
      route: data.routePlan?.[0]?.swapInfo?.label || 'Jupiter',
    };
  }

  async executeSwap(
    inputSymbol: string,
    outputSymbol: string,
    amount: number,
    walletAddress: string,
  ): Promise<SwapResult> {
    const inputMint = this.resolveMint(inputSymbol);
    const outputMint = this.resolveMint(outputSymbol);

    if (this.mockMode) {
      const quote = await this.mockQuote(inputMint, outputMint, inputSymbol, outputSymbol, amount);
      return {
        txSignature: `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        inputMint,
        outputMint,
        inputAmount: amount,
        outputAmount: quote.outputAmount,
        fee: quote.fee,
        status: 'completed',
      };
    }

    // Real mode: get quote then execute swap
    const quote = await this.getQuote(inputSymbol, outputSymbol, amount);
    // NOTE: Real execution requires signing with wallet keypair.
    // This is a placeholder for the swap transaction construction.
    // Full implementation would use @solana/web3.js to sign + send.
    throw new Error('Real swap execution requires wallet signing — use mock mode for demo');
  }

  private mockQuote(
    inputMint: string,
    outputMint: string,
    inputSymbol: string,
    outputSymbol: string,
    amount: number,
  ): SwapQuote {
    // Simulate realistic pricing
    const mockRates: Record<string, number> = {
      'USDC_USDY': 0.893, // USDY trades at ~$1.12, so 1 USDC = ~0.893 USDY
      'USDY_USDC': 1.12,
      'USDC_PRCL': 2.5,   // ~$0.40 per PRCL
      'PRCL_USDC': 0.4,
      'USDC_CETES': 0.95,
      'CETES_USDC': 1.05,
      'USDC_SPYx': 0.00189, // ~$528/share
      'SPYx_USDC': 528.30,
      'USDC_XAU': 0.000427, // ~$2340/oz
      'XAU_USDC': 2340.50,
      'USDC_syrupUSDC': 1.0,
      'syrupUSDC_USDC': 1.0,
    };

    const key = `${inputSymbol}_${outputSymbol}`;
    const rate = mockRates[key] || 1.0;
    const outputAmount = amount * rate;
    const slippage = outputAmount * 0.002; // 0.2% simulated slippage

    return {
      inputMint,
      outputMint,
      inputAmount: amount,
      outputAmount: outputAmount - slippage,
      priceImpact: 0.2,
      fee: amount * 0.001,
      route: 'Jupiter (mock)',
    };
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: All 12 tests pass (5 registry + 3 pyth + 4 jupiter).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/rwa/jupiter-rwa.service.ts backend/src/tests/rwa-services.test.ts
git commit -m "feat: add Jupiter RWA swap service with mock mode for USDC ↔ RWA trading"
```

---

## Task 5: RWA Data Service

**Files:**
- Create: `backend/src/services/rwa/rwa-data.service.ts`
- Modify: `backend/src/tests/rwa-services.test.ts` (append tests)

- [ ] **Step 1: Write the test**

Append to `backend/src/tests/rwa-services.test.ts`:

```typescript
import { RwaDataService } from '../services/rwa/rwa-data.service';

describe('RwaDataService', () => {
  const rwaData = new RwaDataService(true); // mock mode

  it('should return all RWA tokens with enriched data', async () => {
    const tokens = await rwaData.getTokens();
    expect(tokens.length).toBeGreaterThanOrEqual(5);
    tokens.forEach(t => {
      expect(t.symbol).toBeDefined();
      expect(t.currentPrice).toBeGreaterThan(0);
      expect(t.assetClass).toBeDefined();
    });
  });

  it('should return yield rates for yield-bearing tokens', async () => {
    const yields = await rwaData.getYieldRates();
    expect(yields.length).toBeGreaterThanOrEqual(1);
    yields.forEach(y => {
      expect(y.symbol).toBeDefined();
      expect(y.apy).toBeGreaterThan(0);
    });
  });

  it('should group tokens by asset class', async () => {
    const breakdown = await rwaData.getAssetClassBreakdown();
    expect(Object.keys(breakdown).length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: FAIL — RwaDataService not found.

- [ ] **Step 3: Implement RwaDataService**

Create `backend/src/services/rwa/rwa-data.service.ts`:

```typescript
/**
 * RWA Data Service
 *
 * Aggregates RWA token data: prices from Pyth, yields from registry,
 * and asset class breakdown for portfolio views.
 */

import { RWA_TOKENS, type RwaTokenInfo, type AssetClassType } from './rwa-tokens.registry';
import { PythOracleService } from './pyth-oracle.service';

export interface EnrichedRwaToken extends RwaTokenInfo {
  currentPrice: number;
  priceChange24h: number;
}

export interface YieldRate {
  symbol: string;
  name: string;
  apy: number;
  issuer: string;
  assetClass: AssetClassType;
}

export class RwaDataService {
  private pyth: PythOracleService;

  constructor(mockMode?: boolean) {
    this.pyth = new PythOracleService(mockMode);
  }

  async getTokens(): Promise<EnrichedRwaToken[]> {
    const pythPrices = await this.pyth.getAllRwaPrices();

    return RWA_TOKENS.map(token => {
      const pythPrice = pythPrices[token.symbol];
      let currentPrice: number;

      if (pythPrice) {
        currentPrice = pythPrice.price;
      } else {
        // Fallback prices for tokens without Pyth feeds
        const fallback: Record<string, number> = {
          USDY: 1.12,
          PRCL: 0.40,
          CETES: 1.05,
          syrupUSDC: 1.00,
        };
        currentPrice = fallback[token.symbol] || 1.0;
      }

      return {
        ...token,
        currentPrice,
        priceChange24h: (Math.random() - 0.5) * 4, // mock: ±2%
      };
    });
  }

  async getYieldRates(): Promise<YieldRate[]> {
    return RWA_TOKENS
      .filter(t => t.estimatedYield !== null && t.estimatedYield > 0)
      .map(t => ({
        symbol: t.symbol,
        name: t.name,
        apy: t.estimatedYield!,
        issuer: t.issuer,
        assetClass: t.assetClass,
      }));
  }

  async getAssetClassBreakdown(): Promise<Record<AssetClassType, RwaTokenInfo[]>> {
    const breakdown: Record<string, RwaTokenInfo[]> = {};
    for (const token of RWA_TOKENS) {
      if (!breakdown[token.assetClass]) breakdown[token.assetClass] = [];
      breakdown[token.assetClass].push(token);
    }
    return breakdown as Record<AssetClassType, RwaTokenInfo[]>;
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: All 15 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/rwa/rwa-data.service.ts backend/src/tests/rwa-services.test.ts
git commit -m "feat: add RWA data service aggregating prices, yields, and asset class breakdown"
```

---

## Task 6: Portfolio Manager Service

**Files:**
- Create: `backend/src/services/rwa/portfolio-manager.service.ts`
- Modify: `backend/src/tests/rwa-services.test.ts` (append tests)

- [ ] **Step 1: Write the test**

Append to `backend/src/tests/rwa-services.test.ts`:

```typescript
import { PortfolioManagerService } from '../services/rwa/portfolio-manager.service';

describe('PortfolioManagerService', () => {
  const pm = new PortfolioManagerService(true); // mock mode

  it('should generate a conservative allocation', () => {
    const alloc = pm.generateTargetAllocation('conservative');
    expect(alloc.length).toBeGreaterThanOrEqual(3);
    const totalWeight = alloc.reduce((sum, a) => sum + a.weight, 0);
    expect(totalWeight).toBeCloseTo(100, 0);
    // Conservative should favor T-bills
    const tbills = alloc.find(a => a.assetClass === 'TREASURY_BILLS');
    expect(tbills).toBeDefined();
    expect(tbills!.weight).toBeGreaterThanOrEqual(30);
  });

  it('should generate an aggressive allocation', () => {
    const alloc = pm.generateTargetAllocation('aggressive');
    const totalWeight = alloc.reduce((sum, a) => sum + a.weight, 0);
    expect(totalWeight).toBeCloseTo(100, 0);
    // Aggressive should have more equities/crypto
    const equities = alloc.find(a => a.assetClass === 'EQUITIES');
    const crypto = alloc.find(a => a.assetClass === 'CRYPTO');
    expect((equities?.weight || 0) + (crypto?.weight || 0)).toBeGreaterThanOrEqual(40);
  });

  it('should calculate rebalance trades', () => {
    const current = [
      { symbol: 'USDC', assetClass: 'CRYPTO' as const, weight: 100 },
    ];
    const target = [
      { symbol: 'USDY', assetClass: 'TREASURY_BILLS' as const, weight: 40 },
      { symbol: 'SPYx', assetClass: 'EQUITIES' as const, weight: 30 },
      { symbol: 'USDC', assetClass: 'CRYPTO' as const, weight: 30 },
    ];
    const trades = pm.calculateRebalanceTrades(current, target, 10000);
    expect(trades.length).toBe(2); // Buy USDY and SPYx
    expect(trades.find(t => t.toSymbol === 'USDY')?.amount).toBeCloseTo(4000, -1);
    expect(trades.find(t => t.toSymbol === 'SPYx')?.amount).toBeCloseTo(3000, -1);
  });

  it('should compute portfolio performance metrics', () => {
    const metrics = pm.computeMetrics({
      totalValue: 10500,
      initialValue: 10000,
      dailyReturns: [0.001, -0.002, 0.003, 0.001, -0.001, 0.002, 0.001],
    });
    expect(metrics.totalReturn).toBeCloseTo(5.0, 0);
    expect(metrics.sortinoRatio).toBeDefined();
    expect(metrics.maxDrawdown).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: FAIL — PortfolioManagerService not found.

- [ ] **Step 3: Implement PortfolioManagerService**

Create `backend/src/services/rwa/portfolio-manager.service.ts`:

```typescript
/**
 * Portfolio Manager Service
 *
 * Handles portfolio allocation strategies, rebalancing logic,
 * and performance metric computation for AI agents managing
 * diversified portfolios across crypto + RWA assets.
 */

import type { AssetClassType } from './rwa-tokens.registry';

export type StrategyProfile = 'conservative' | 'balanced' | 'aggressive';

export interface AllocationTarget {
  symbol: string;
  assetClass: AssetClassType;
  weight: number; // percentage (0-100)
}

export interface RebalanceTrade {
  fromSymbol: string;
  toSymbol: string;
  amount: number; // in USD
  reason: string;
}

export interface PortfolioMetrics {
  totalReturn: number; // percentage
  sortinoRatio: number;
  sharpeRatio: number;
  maxDrawdown: number; // percentage
  volatility: number;
}

const STRATEGY_TEMPLATES: Record<StrategyProfile, AllocationTarget[]> = {
  conservative: [
    { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 40 },
    { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 20 },
    { symbol: 'XAU', assetClass: 'GOLD', weight: 15 },
    { symbol: 'CETES', assetClass: 'GOVERNMENT_BONDS', weight: 10 },
    { symbol: 'USDC', assetClass: 'CRYPTO', weight: 15 },
  ],
  balanced: [
    { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 25 },
    { symbol: 'SPYx', assetClass: 'EQUITIES', weight: 20 },
    { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 15 },
    { symbol: 'XAU', assetClass: 'GOLD', weight: 10 },
    { symbol: 'PRCL', assetClass: 'REAL_ESTATE', weight: 10 },
    { symbol: 'USDC', assetClass: 'CRYPTO', weight: 20 },
  ],
  aggressive: [
    { symbol: 'SPYx', assetClass: 'EQUITIES', weight: 30 },
    { symbol: 'USDC', assetClass: 'CRYPTO', weight: 25 },
    { symbol: 'PRCL', assetClass: 'REAL_ESTATE', weight: 15 },
    { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 15 },
    { symbol: 'XAU', assetClass: 'GOLD', weight: 10 },
    { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 5 },
  ],
};

export class PortfolioManagerService {
  private mockMode: boolean;

  constructor(mockMode?: boolean) {
    this.mockMode = mockMode ?? true;
  }

  generateTargetAllocation(strategy: StrategyProfile): AllocationTarget[] {
    return STRATEGY_TEMPLATES[strategy] || STRATEGY_TEMPLATES.balanced;
  }

  calculateRebalanceTrades(
    current: AllocationTarget[],
    target: AllocationTarget[],
    totalValueUsd: number,
  ): RebalanceTrade[] {
    const trades: RebalanceTrade[] = [];
    const currentMap = new Map(current.map(c => [c.symbol, c.weight]));

    for (const t of target) {
      const currentWeight = currentMap.get(t.symbol) || 0;
      const diff = t.weight - currentWeight;

      if (diff > 1) {
        // Need to buy this asset
        const amount = (diff / 100) * totalValueUsd;
        trades.push({
          fromSymbol: 'USDC',
          toSymbol: t.symbol,
          amount,
          reason: `Increase ${t.symbol} from ${currentWeight.toFixed(1)}% to ${t.weight}%`,
        });
      } else if (diff < -1) {
        // Need to sell this asset
        const amount = (Math.abs(diff) / 100) * totalValueUsd;
        trades.push({
          fromSymbol: t.symbol,
          toSymbol: 'USDC',
          amount,
          reason: `Decrease ${t.symbol} from ${currentWeight.toFixed(1)}% to ${t.weight}%`,
        });
      }
    }

    return trades;
  }

  computeMetrics(data: {
    totalValue: number;
    initialValue: number;
    dailyReturns: number[];
  }): PortfolioMetrics {
    const { totalValue, initialValue, dailyReturns } = data;

    const totalReturn = ((totalValue - initialValue) / initialValue) * 100;
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252); // annualized

    // Downside deviation (for Sortino)
    const downsideReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length
      : 0.0001;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);

    const annualizedReturn = mean * 252;
    const riskFreeRate = 0.04; // 4% (T-bill rate)

    const sharpeRatio = volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;
    const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - riskFreeRate) / downsideDeviation : 0;

    // Max drawdown
    let peak = initialValue;
    let maxDrawdown = 0;
    let runningValue = initialValue;
    for (const r of dailyReturns) {
      runningValue *= (1 + r);
      if (runningValue > peak) peak = runningValue;
      const drawdown = ((peak - runningValue) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return { totalReturn, sortinoRatio, sharpeRatio, maxDrawdown, volatility };
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd backend && bun test src/tests/rwa-services.test.ts`
Expected: All 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/rwa/portfolio-manager.service.ts backend/src/tests/rwa-services.test.ts
git commit -m "feat: add portfolio manager with strategy templates, rebalancing, and performance metrics"
```

---

## Task 7: RWA API Routes

**Files:**
- Create: `backend/src/routes/rwa.routes.ts`
- Modify: `backend/src/index.ts` (register routes)

- [ ] **Step 1: Create the route file**

Create `backend/src/routes/rwa.routes.ts`:

```typescript
/**
 * RWA Routes — Real World Asset portfolio management endpoints.
 *
 * GET  /rwa/tokens          — All available RWA tokens with live prices
 * GET  /rwa/yields          — Current yield rates for yield-bearing tokens
 * GET  /rwa/prices          — Live Pyth price feeds
 * GET  /rwa/asset-classes   — Tokens grouped by asset class
 * GET  /rwa/strategies      — Available portfolio strategy templates
 * GET  /rwa/strategies/:name — Specific strategy allocation
 */

import { Hono } from 'hono';
import { RwaDataService } from '../services/rwa/rwa-data.service';
import { PythOracleService } from '../services/rwa/pyth-oracle.service';
import { PortfolioManagerService } from '../services/rwa/portfolio-manager.service';
import { RWA_TOKENS } from '../services/rwa/rwa-tokens.registry';

const rwa = new Hono();

const rwaData = new RwaDataService();
const pyth = new PythOracleService();
const portfolioManager = new PortfolioManagerService();

rwa.get('/tokens', async (c) => {
  const tokens = await rwaData.getTokens();
  return c.json({ tokens, count: tokens.length });
});

rwa.get('/yields', async (c) => {
  const yields = await rwaData.getYieldRates();
  return c.json({ yields });
});

rwa.get('/prices', async (c) => {
  const prices = await pyth.getAllRwaPrices();
  return c.json({ prices, updatedAt: new Date().toISOString() });
});

rwa.get('/asset-classes', async (c) => {
  const breakdown = await rwaData.getAssetClassBreakdown();
  return c.json({ assetClasses: breakdown });
});

rwa.get('/strategies', (c) => {
  return c.json({
    strategies: ['conservative', 'balanced', 'aggressive'],
  });
});

rwa.get('/strategies/:name', (c) => {
  const name = c.req.param('name') as 'conservative' | 'balanced' | 'aggressive';
  if (!['conservative', 'balanced', 'aggressive'].includes(name)) {
    return c.json({ error: 'Unknown strategy. Use: conservative, balanced, aggressive' }, 400);
  }
  const allocation = portfolioManager.generateTargetAllocation(name);
  return c.json({ strategy: name, allocation });
});

export { rwa as rwaRoutes };
```

- [ ] **Step 2: Register routes in index.ts**

In `backend/src/index.ts`, add after the compliance routes (line ~285):

```typescript
// RWA Portfolio Management
import { rwaRoutes } from './routes/rwa.routes';
app.route('/rwa', rwaRoutes);
```

- [ ] **Step 3: Verify the server starts**

Run: `cd backend && timeout 5 bun run src/index.ts || true`
Expected: Server starts without import errors. (It may fail connecting to DB — that's fine, we just need no import/syntax errors.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/rwa.routes.ts backend/src/index.ts
git commit -m "feat: add RWA API routes (tokens, yields, prices, strategies)"
```

---

## Task 8: Tailwind + CSS Rebrand (Gold → Blue)

**Files:**
- Modify: `web/tailwind.config.js`
- Modify: `web/app/globals.css`

This task changes the design system colors. All 53 files with hardcoded `#E8B45E` will inherit the change through the tailwind config `accent-primary` token. Files using the token (`text-accent-primary`, `bg-accent-primary/10`, etc.) update automatically. Files with hardcoded hex values need manual find-and-replace.

- [ ] **Step 1: Update tailwind.config.js accent colors**

In `web/tailwind.config.js`, replace the accent color block (lines 27-31):

Old:
```javascript
accent: {
  primary: '#E8B45E',
  soft: '#F5C978',
  dark: '#D6A04B',
},
```

New:
```javascript
accent: {
  primary: '#2563EB',
  soft: '#60A5FA',
  dark: '#1D4ED8',
},
```

Also replace `'brand-primary': '#E8B45E'` with `'brand-primary': '#2563EB'` (line 55).

Also replace the background gradient (line 152):

Old:
```javascript
'accent-gradient': 'linear-gradient(135deg, #F5C978, #E8B45E)',
```

New:
```javascript
'accent-gradient': 'linear-gradient(135deg, #60A5FA, #2563EB)',
```

Also replace glow-radial (line 153):

Old:
```javascript
'glow-radial': 'radial-gradient(circle at 50% 0%, rgba(232, 180, 94, 0.25), transparent 60%)',
```

New:
```javascript
'glow-radial': 'radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.25), transparent 60%)',
```

Also replace glow-gold shadow (line 107):

Old:
```javascript
'glow-gold': '0 20px 60px rgba(232, 180, 94, 0.3)',
```

New:
```javascript
'glow-gold': '0 20px 60px rgba(37, 99, 235, 0.3)',
```

- [ ] **Step 2: Update globals.css hardcoded gold references**

In `web/app/globals.css`, find and replace all instances of `#E8B45E` with `#2563EB`. There's at least one on line 178 (`.glow-divider`):

Old:
```css
background: linear-gradient(90deg, transparent, #E8B45E, transparent);
```

New:
```css
background: linear-gradient(90deg, transparent, #2563EB, transparent);
```

- [ ] **Step 3: Bulk replace hardcoded #E8B45E in all web/ component files**

Run the following to find all remaining hardcoded gold hex values in component files. For each file, replace `#E8B45E` with `#2563EB` and `#F5C978`/`#D6A04B` with `#60A5FA`/`#1D4ED8` respectively.

**Important:** Some components use `#E8B45E` as inline style (not tailwind class). These all need updating. Use find-and-replace across all `.tsx` files in `web/`:

- `#E8B45E` → `#2563EB` (primary accent)
- `#F5C978` → `#60A5FA` (soft accent)
- `#D6A04B` → `#1D4ED8` (dark accent)
- `#D4A04A` → `#1D4ED8` (dark accent variant)
- `rgba(232, 180, 94,` → `rgba(37, 99, 235,` (RGBA references)
- `E8B45E` in any other format → `2563EB`

The GradientText component in `web/app/navbar.tsx` line 58 has inline colors:
```tsx
colors={['#E8B45E', '#D4A04A', '#F0C97A', '#E8B45E']}
```
Change to:
```tsx
colors={['#2563EB', '#1D4ED8', '#60A5FA', '#2563EB']}
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd web && npx next build`
Expected: Build succeeds. No color-related errors.

- [ ] **Step 5: Commit**

```bash
git add web/tailwind.config.js web/app/globals.css
git add -u web/  # stage all modified web files
git commit -m "feat: rebrand color system from gold (#E8B45E) to institutional blue (#2563EB)"
```

---

## Task 9: Brand Name + Copy Rebrand

**Files:**
- Modify: `web/app/navbar.tsx`
- Modify: `web/app/page.tsx`
- Modify: `web/app/layout.tsx`
- Modify: all 25 files containing "Trench Terminal" or "Trench Terminal"

- [ ] **Step 1: Update navbar.tsx**

In `web/app/navbar.tsx`:

1. Replace the GradientText content (line 62): `Trench Terminal` → `Trench Terminal`
2. Replace the subtitle (line 64): `Agent Cooperation Arena` → `AI-Powered Portfolio Intelligence`
3. Replace the Image alt (line 52): `Trench Terminal` → `Trench Terminal`
4. Update nav labels array (lines 25-29): Change `'Arena'` label to `'Agents'`, keep the href as `/arena`
5. Change `'Predictions'` label to `'Markets'`

- [ ] **Step 2: Update layout.tsx metadata**

In `web/app/layout.tsx`, find the metadata export and update:
- `title`: `Trench Terminal` → `Trench Terminal — AI-Powered Portfolio Intelligence`
- `description`: Update to: `AI agents managing diversified portfolios across crypto and real-world assets on Solana. Fully compliance-gated.`

- [ ] **Step 3: Update home page hero**

In `web/app/page.tsx`, update the hero section text. Key changes:
- Main heading: Reference "AI-Powered Portfolio Intelligence" instead of arena/competition language
- Subtext: "AI agents manage diversified portfolios across crypto, T-bills, gold, equities, and real estate"
- CTA buttons: "Launch Portfolio" instead of "Enter Arena" or similar

- [ ] **Step 4: Bulk find-and-replace brand name across all files**

Across all 25 files containing "Trench Terminal"/"Trench Terminal":
- `Trench Terminal` → `Trench Terminal`
- `Trench Terminal` → `Trench Terminal`
- `trench-terminal` (in URLs, slugs)
- `Agent Cooperation Arena` → `AI-Powered Portfolio Intelligence`
- `@Trench TerminalSol` → keep as-is (this is the live Twitter handle, don't change external refs)

**Do NOT change:**
- Git repo name or folder paths
- package.json name (would break deploys)
- External URLs (Twitter, DexScreener)
- Backend service names or route paths

- [ ] **Step 5: Verify the frontend builds**

Run: `cd web && npx next build`
Expected: Build succeeds with new branding.

- [ ] **Step 6: Commit**

```bash
git add -u web/
git commit -m "feat: rebrand Trench Terminal → Trench Terminal across all frontend files"
```

---

## Task 10: RWA Assets Page

**Files:**
- Create: `web/app/assets/page.tsx`
- Create: `web/components/rwa/AssetCard.tsx`
- Create: `web/components/rwa/YieldTable.tsx`
- Modify: `web/app/navbar.tsx` (add Assets nav link)

- [ ] **Step 1: Create AssetCard component**

Create `web/components/rwa/AssetCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AssetCardProps {
  symbol: string;
  name: string;
  issuer: string;
  assetClass: string;
  currentPrice: number;
  priceChange24h: number;
  estimatedYield: number | null;
  description: string;
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  TREASURY_BILLS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  EQUITIES: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  GOLD: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  REAL_ESTATE: 'bg-green-500/10 text-green-400 border-green-500/20',
  FIXED_INCOME: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  GOVERNMENT_BONDS: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CRYPTO: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

function formatAssetClass(ac: string): string {
  return ac.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function AssetCard({ symbol, name, issuer, assetClass, currentPrice, priceChange24h, estimatedYield, description }: AssetCardProps) {
  const isPositive = priceChange24h >= 0;
  const classColor = ASSET_CLASS_COLORS[assetClass] || 'bg-white/5 text-white/40 border-white/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0F1629] border border-white/[0.08] rounded-xl p-5 hover:border-white/[0.15] transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-lg font-semibold text-white">{symbol}</div>
          <div className="text-xs text-white/40">{name}</div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${classColor}`}>
          {formatAssetClass(assetClass)}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-2xl font-bold text-white font-mono">
          ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {isPositive ? '+' : ''}{priceChange24h.toFixed(2)}%
        </span>
      </div>

      {estimatedYield && (
        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-green-500/5 border border-green-500/10 rounded-lg">
          <span className="text-xs text-green-400/60">Yield</span>
          <span className="text-sm font-semibold text-green-400">{estimatedYield}% APY</span>
        </div>
      )}

      <p className="text-xs text-white/30 mb-3 line-clamp-2">{description}</p>

      <div className="text-[10px] text-white/20">Issued by {issuer}</div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create YieldTable component**

Create `web/components/rwa/YieldTable.tsx`:

```tsx
'use client';

interface YieldEntry {
  symbol: string;
  name: string;
  apy: number;
  issuer: string;
  assetClass: string;
}

export function YieldTable({ yields }: { yields: YieldEntry[] }) {
  if (yields.length === 0) {
    return <div className="text-center py-8 text-white/20 text-sm">No yield data available</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-white/40 text-xs uppercase tracking-wider">Asset</th>
            <th className="text-right py-3 px-4 text-white/40 text-xs uppercase tracking-wider">APY</th>
            <th className="text-left py-3 px-4 text-white/40 text-xs uppercase tracking-wider">Issuer</th>
            <th className="text-left py-3 px-4 text-white/40 text-xs uppercase tracking-wider">Class</th>
          </tr>
        </thead>
        <tbody>
          {yields.sort((a, b) => b.apy - a.apy).map((y) => (
            <tr key={y.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="py-3 px-4">
                <div className="text-white/80 font-medium">{y.symbol}</div>
                <div className="text-[10px] text-white/30">{y.name}</div>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-green-400 font-mono font-semibold">{y.apy.toFixed(2)}%</span>
              </td>
              <td className="py-3 px-4 text-white/50">{y.issuer}</td>
              <td className="py-3 px-4 text-white/40 text-xs">{y.assetClass.replace(/_/g, ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create the Assets page**

Create `web/app/assets/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Coins, RefreshCw, TrendingUp } from 'lucide-react';
import { AssetCard } from '@/components/rwa/AssetCard';
import { YieldTable } from '@/components/rwa/YieldTable';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface RwaToken {
  symbol: string;
  name: string;
  issuer: string;
  assetClass: string;
  currentPrice: number;
  priceChange24h: number;
  estimatedYield: number | null;
  description: string;
}

interface YieldRate {
  symbol: string;
  name: string;
  apy: number;
  issuer: string;
  assetClass: string;
}

export default function AssetsPage() {
  const [tokens, setTokens] = useState<RwaToken[]>([]);
  const [yields, setYields] = useState<YieldRate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tokensRes, yieldsRes] = await Promise.allSettled([
        fetch(`${API_URL}/rwa/tokens`),
        fetch(`${API_URL}/rwa/yields`),
      ]);

      if (tokensRes.status === 'fulfilled' && tokensRes.value.ok) {
        const data = await tokensRes.value.json();
        setTokens(data.tokens || []);
      }
      if (yieldsRes.status === 'fulfilled' && yieldsRes.value.ok) {
        const data = await yieldsRes.value.json();
        setYields(data.yields || []);
      }
    } catch { /* empty state */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="mx-auto w-full max-w-[1260px] px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Coins size={24} className="text-[#2563EB]" />
              <h1 className="text-xl font-semibold text-white">RWA Assets</h1>
            </div>
            <p className="text-sm text-white/30 mt-1 ml-9">Tokenized real-world assets available for portfolio allocation</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 border border-white/10 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="space-y-6">
          {/* Asset Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <AssetCard key={token.symbol} {...token} />
            ))}
            {tokens.length === 0 && !loading && (
              <div className="col-span-3 text-center py-12 text-white/20 text-sm">
                No RWA tokens available. Start the backend to load token data.
              </div>
            )}
          </div>

          {/* Yield Comparison Table */}
          <div className="bg-[#0F1629] border border-white/[0.08] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-green-400" />
              <h3 className="text-sm text-white/40 uppercase tracking-wider">Yield Comparison</h3>
            </div>
            <YieldTable yields={yields} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add Assets link to navbar**

In `web/app/navbar.tsx`, add to the `navLinks` array (after Compliance):

```typescript
{ href: '/assets', label: 'Assets', Icon: Coins },
```

And add the import: `Coins` from `lucide-react` (add to existing import line 7).

- [ ] **Step 5: Verify the frontend builds**

Run: `cd web && npx next build`
Expected: Build succeeds with new assets page.

- [ ] **Step 6: Commit**

```bash
git add web/app/assets/page.tsx web/components/rwa/AssetCard.tsx web/components/rwa/YieldTable.tsx web/app/navbar.tsx
git commit -m "feat: add RWA assets page with token catalog, yield comparison, and asset cards"
```

---

## Task 11: Seed RWA Demo Data

**Files:**
- Create: `backend/src/scripts/seed-rwa.ts`

- [ ] **Step 1: Create seed script**

Create `backend/src/scripts/seed-rwa.ts`:

```typescript
/**
 * Seeds the database with RWA token records and sample portfolio allocations.
 * Run with: bun run src/scripts/seed-rwa.ts
 */

import { db } from '../lib/db';
import { RWA_TOKENS } from '../services/rwa/rwa-tokens.registry';

async function seed() {
  console.log('Seeding RWA tokens...');

  for (const token of RWA_TOKENS) {
    await db.rwaToken.upsert({
      where: { symbol: token.symbol },
      update: {
        name: token.name,
        mint: token.mint,
        assetClass: token.assetClass as any,
        issuer: token.issuer,
        currentYield: token.estimatedYield,
        isActive: true,
      },
      create: {
        symbol: token.symbol,
        name: token.name,
        mint: token.mint,
        assetClass: token.assetClass as any,
        issuer: token.issuer,
        currentYield: token.estimatedYield,
        isActive: true,
      },
    });
    console.log(`  ✓ ${token.symbol} (${token.issuer})`);
  }

  console.log(`\nSeeded ${RWA_TOKENS.length} RWA tokens.`);

  // Seed sample portfolio allocations for existing agents
  const agents = await db.tradingAgent.findMany({ take: 3, where: { status: 'ACTIVE' } });

  for (const agent of agents) {
    const strategies = ['conservative', 'balanced', 'aggressive'];
    const strategy = strategies[agents.indexOf(agent) % 3];

    console.log(`\nSeeding ${strategy} portfolio for agent ${agent.name}...`);

    // Clear existing allocations
    await db.portfolioAllocation.deleteMany({ where: { agentId: agent.id } });

    const allocations = strategy === 'conservative'
      ? [
          { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 40, entryPrice: 1.12, quantity: 3571 },
          { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 20, entryPrice: 1.0, quantity: 2000 },
          { symbol: 'XAU', assetClass: 'GOLD', weight: 15, entryPrice: 2340.5, quantity: 0.64 },
          { symbol: 'CETES', assetClass: 'GOVERNMENT_BONDS', weight: 10, entryPrice: 1.05, quantity: 952 },
        ]
      : strategy === 'balanced'
      ? [
          { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 25, entryPrice: 1.12, quantity: 2232 },
          { symbol: 'SPYx', assetClass: 'EQUITIES', weight: 20, entryPrice: 528.3, quantity: 3.79 },
          { symbol: 'syrupUSDC', assetClass: 'FIXED_INCOME', weight: 15, entryPrice: 1.0, quantity: 1500 },
          { symbol: 'XAU', assetClass: 'GOLD', weight: 10, entryPrice: 2340.5, quantity: 0.43 },
          { symbol: 'PRCL', assetClass: 'REAL_ESTATE', weight: 10, entryPrice: 0.4, quantity: 2500 },
        ]
      : [
          { symbol: 'SPYx', assetClass: 'EQUITIES', weight: 30, entryPrice: 528.3, quantity: 5.68 },
          { symbol: 'PRCL', assetClass: 'REAL_ESTATE', weight: 15, entryPrice: 0.4, quantity: 3750 },
          { symbol: 'USDY', assetClass: 'TREASURY_BILLS', weight: 15, entryPrice: 1.12, quantity: 1339 },
          { symbol: 'XAU', assetClass: 'GOLD', weight: 10, entryPrice: 2340.5, quantity: 0.43 },
        ];

    for (const alloc of allocations) {
      const token = RWA_TOKENS.find(t => t.symbol === alloc.symbol);
      await db.portfolioAllocation.create({
        data: {
          agentId: agent.id,
          tokenMint: token?.mint || 'unknown',
          assetClass: alloc.assetClass as any,
          symbol: alloc.symbol,
          quantity: alloc.quantity,
          entryPrice: alloc.entryPrice,
          currentPrice: alloc.entryPrice * (1 + (Math.random() - 0.4) * 0.1),
          weight: alloc.weight,
        },
      });
      console.log(`  ✓ ${alloc.symbol}: ${alloc.weight}%`);
    }
  }

  console.log('\nDone seeding RWA data.');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
```

- [ ] **Step 2: Run the seed script**

Run: `cd backend && bun run src/scripts/seed-rwa.ts`
Expected: RWA tokens seeded, sample portfolio allocations created for first 3 active agents.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seed-rwa.ts
git commit -m "feat: add RWA seed script for demo data (tokens + sample portfolios)"
```

---

## Task 12: Update Compliance Dashboard Colors

**Files:**
- Modify: `web/app/compliance/page.tsx`
- Modify: `web/components/compliance/ComplianceStats.tsx`
- Modify: `web/components/compliance/ComplianceGateVisual.tsx`

- [ ] **Step 1: Update compliance page accent colors**

In `web/app/compliance/page.tsx`, replace all `#E8B45E` references with `#2563EB`. The Shield icon color on line 112 and the search button on line 159 both reference `#E8B45E`.

- [ ] **Step 2: Update ComplianceStats accent colors**

In `web/components/compliance/ComplianceStats.tsx`, replace any `#E8B45E` references with `#2563EB`.

- [ ] **Step 3: Update ComplianceGateVisual**

In `web/components/compliance/ComplianceGateVisual.tsx`, the "Agent" step on line 7 uses `color: '#E8B45E'`. Change to `color: '#2563EB'`.

- [ ] **Step 4: Commit**

```bash
git add web/app/compliance/page.tsx web/components/compliance/ComplianceStats.tsx web/components/compliance/ComplianceGateVisual.tsx
git commit -m "fix: update compliance dashboard to use new blue accent colors"
```

---

## Parallelization Guide

These tasks can be executed in waves:

**Wave 1 (No dependencies — run all in parallel):**
- Task 1: Database Schema
- Task 2: RWA Token Registry
- Task 8: Tailwind + CSS Rebrand
- Task 9: Brand Name + Copy Rebrand

**Wave 2 (Depends on Task 2 — run in parallel):**
- Task 3: Pyth Oracle Service (needs registry)
- Task 4: Jupiter RWA Service (needs registry)
- Task 5: RWA Data Service (needs registry)
- Task 6: Portfolio Manager Service (standalone logic, but uses registry types)

**Wave 3 (Depends on Wave 2 — run in parallel):**
- Task 7: RWA API Routes (needs all services)
- Task 10: RWA Assets Page (needs routes + branding done)
- Task 12: Compliance Dashboard Colors (needs branding done)

**Wave 4 (Depends on Wave 3):**
- Task 11: Seed Demo Data (needs schema + registry)
