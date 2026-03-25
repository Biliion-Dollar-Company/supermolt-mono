/**
 * Seed RWA Demo Data
 *
 * Populates the database with RWA tokens and sample portfolio allocations
 * for existing trading agents. Safe to run multiple times (upserts).
 *
 * Usage: bun run src/scripts/seed-rwa.ts
 */

import { PrismaClient } from '@prisma/client';
import { RWA_TOKENS, USDC_MINT } from '../services/rwa/rwa-tokens.registry';

const prisma = new PrismaClient();

// Map registry asset classes to Prisma enum values (they match 1:1)
type PrismaAssetClass =
  | 'CRYPTO'
  | 'TREASURY_BILLS'
  | 'EQUITIES'
  | 'GOLD'
  | 'REAL_ESTATE'
  | 'FIXED_INCOME'
  | 'GOVERNMENT_BONDS';

async function seedRwaTokens() {
  console.log('Seeding RWA tokens...');

  for (const token of RWA_TOKENS) {
    await prisma.rwaToken.upsert({
      where: { symbol: token.symbol },
      update: {
        name: token.name,
        mint: token.mint,
        assetClass: token.assetClass as PrismaAssetClass,
        issuer: token.issuer,
        currentYield: token.estimatedYield,
        isActive: true,
      },
      create: {
        symbol: token.symbol,
        name: token.name,
        mint: token.mint,
        assetClass: token.assetClass as PrismaAssetClass,
        issuer: token.issuer,
        currentYield: token.estimatedYield,
        isActive: true,
      },
    });
    console.log(`  ✓ ${token.symbol} (${token.assetClass})`);
  }

  // Also seed USDC as a CRYPTO asset
  await prisma.rwaToken.upsert({
    where: { symbol: 'USDC' },
    update: {
      name: 'USD Coin',
      mint: USDC_MINT,
      assetClass: 'CRYPTO',
      issuer: 'Circle',
      currentYield: 0,
      isActive: true,
    },
    create: {
      symbol: 'USDC',
      name: 'USD Coin',
      mint: USDC_MINT,
      assetClass: 'CRYPTO',
      issuer: 'Circle',
      currentYield: 0,
      isActive: true,
    },
  });
  console.log('  ✓ USDC (CRYPTO)');
}

// Strategy templates: allocation weights by asset class
const STRATEGY_ALLOCATIONS: Record<string, { symbol: string; weight: number; entryPrice: number; quantity: number }[]> = {
  conservative: [
    { symbol: 'USDC', weight: 0.20, entryPrice: 1.0, quantity: 20000 },
    { symbol: 'USDY', weight: 0.40, entryPrice: 1.12, quantity: 17857 },
    { symbol: 'CETES', weight: 0.15, entryPrice: 1.05, quantity: 14286 },
    { symbol: 'syrupUSDC', weight: 0.15, entryPrice: 1.03, quantity: 14563 },
    { symbol: 'XAU', weight: 0.10, entryPrice: 2340.50, quantity: 4.27 },
  ],
  balanced: [
    { symbol: 'USDC', weight: 0.10, entryPrice: 1.0, quantity: 10000 },
    { symbol: 'USDY', weight: 0.25, entryPrice: 1.12, quantity: 22321 },
    { symbol: 'SPYx', weight: 0.20, entryPrice: 528.30, quantity: 37.85 },
    { symbol: 'XAU', weight: 0.15, entryPrice: 2340.50, quantity: 6.41 },
    { symbol: 'PRCL', weight: 0.15, entryPrice: 0.38, quantity: 39474 },
    { symbol: 'CETES', weight: 0.15, entryPrice: 1.05, quantity: 14286 },
  ],
  aggressive: [
    { symbol: 'USDC', weight: 0.05, entryPrice: 1.0, quantity: 5000 },
    { symbol: 'SPYx', weight: 0.35, entryPrice: 528.30, quantity: 66.25 },
    { symbol: 'PRCL', weight: 0.25, entryPrice: 0.38, quantity: 65789 },
    { symbol: 'XAU', weight: 0.15, entryPrice: 2340.50, quantity: 6.41 },
    { symbol: 'USDY', weight: 0.10, entryPrice: 1.12, quantity: 8929 },
    { symbol: 'syrupUSDC', weight: 0.10, entryPrice: 1.03, quantity: 9709 },
  ],
};

// Map agent archetypes to RWA strategies
const ARCHETYPE_STRATEGY: Record<string, string> = {
  liquidity_sniper: 'aggressive',
  narrative_researcher: 'balanced',
  degen_hunter: 'aggressive',
  risk_manager: 'conservative',
  whale_tracker: 'balanced',
  contrarian_strategist: 'balanced',
  sentiment_analyst: 'balanced',
  algo_quant: 'aggressive',
  default: 'balanced',
};

async function seedPortfolioAllocations() {
  console.log('\nSeeding portfolio allocations...');

  // Get all active trading agents
  const agents = await prisma.tradingAgent.findMany({
    where: { status: 'ACTIVE' },
    take: 18,
  });

  if (agents.length === 0) {
    console.log('  ⚠ No active agents found. Skipping portfolio allocations.');
    console.log('    (Run the backend first to create agents, then re-run this script)');
    return;
  }

  // Get RWA tokens for mint lookup
  const rwaTokens = await prisma.rwaToken.findMany();
  const mintBySymbol = Object.fromEntries(rwaTokens.map(t => [t.symbol, t.mint]));

  for (const agent of agents) {
    const strategyName = ARCHETYPE_STRATEGY[agent.archetypeId] ?? ARCHETYPE_STRATEGY.default;
    const allocations = STRATEGY_ALLOCATIONS[strategyName];

    // Delete existing allocations for this agent (clean re-seed)
    await prisma.portfolioAllocation.deleteMany({ where: { agentId: agent.id } });

    for (const alloc of allocations) {
      const mint = mintBySymbol[alloc.symbol];
      if (!mint) continue;

      const rwaToken = rwaTokens.find(t => t.symbol === alloc.symbol);
      const assetClass = rwaToken?.assetClass ?? 'CRYPTO';

      await prisma.portfolioAllocation.create({
        data: {
          agentId: agent.id,
          tokenMint: mint,
          assetClass: assetClass as PrismaAssetClass,
          symbol: alloc.symbol,
          quantity: alloc.quantity,
          entryPrice: alloc.entryPrice,
          currentPrice: alloc.entryPrice * (1 + (Math.random() * 0.1 - 0.03)), // slight variance
          weight: alloc.weight,
        },
      });
    }

    console.log(`  ✓ ${agent.name} (${strategyName}): ${allocations.length} positions`);
  }
}

async function seedSampleRebalanceEvents() {
  console.log('\nSeeding sample rebalance events...');

  const agents = await prisma.tradingAgent.findMany({
    where: { status: 'ACTIVE' },
    take: 3,
  });

  if (agents.length === 0) return;

  const events = [
    { fromToken: 'USDC', toToken: 'USDY', fromAmount: 5000, toAmount: 4464, status: 'COMPLETED', reason: 'Rebalance: increase T-bill exposure' },
    { fromToken: 'USDC', toToken: 'SPYx', fromAmount: 10000, toAmount: 18.93, status: 'COMPLETED', reason: 'Rebalance: add equity position' },
    { fromToken: 'PRCL', toToken: 'USDC', fromAmount: 10000, toAmount: 3800, status: 'COMPLETED', reason: 'Rebalance: reduce real estate weight' },
  ];

  for (let i = 0; i < Math.min(agents.length, events.length); i++) {
    await prisma.rebalanceEvent.create({
      data: {
        agentId: agents[i].id,
        ...events[i],
        txSignature: `mock_sig_${Date.now()}_${i}`,
      },
    });
    console.log(`  ✓ ${agents[i].name}: ${events[i].fromToken} → ${events[i].toToken}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  TreasuryOS — RWA Demo Data Seeder');
  console.log('═══════════════════════════════════════\n');

  try {
    await seedRwaTokens();
    await seedPortfolioAllocations();
    await seedSampleRebalanceEvents();
    console.log('\n✅ Seed complete!');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
