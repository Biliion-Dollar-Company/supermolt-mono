/**
 * Seed Devnet Scanner Wallets
 * 
 * Seeds the database with 5 scanner agents using devnet wallets
 * for USDC Hackathon testing
 * 
 * Run: bun run scripts/seed-devnet-scanners.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEVNET_SCANNERS = [
  {
    name: 'Alpha Scanner',
    pubkey: 'FwhhaoXG67kQiAG7P2siN6HPvbyQ49E799uxcmnez5qk',
    strategy: 'HIGH_CONVICTION',
    description: 'God Wallet - High-conviction AI sentiment analysis',
    winRate: 0.80,
    status: 'ACTIVE',
  },
  {
    name: 'Beta Scanner',
    pubkey: '2aHP2HhXxiy7fMZUTx3TYjiko6ydsFZJ1ybg4FxL6A5F',
    strategy: 'AI_SENTIMENT',
    description: 'Twitter sentiment + social signals',
    winRate: 0.60,
    status: 'ACTIVE',
  },
  {
    name: 'Gamma Scanner',
    pubkey: 'EjAqcB9RL5xfcrbjcbFT8ecewf9cqxcbjnjyR3eLjFK9',
    strategy: 'LIQUIDITY',
    description: 'Pool depth + volume analysis',
    winRate: 0.80,
    status: 'ACTIVE',
  },
  {
    name: 'Delta Scanner',
    pubkey: '5hEdpKeQWZ2bFAUdb3ibsJSzZpUqpksDF3Gw1278qKPw',
    strategy: 'TECHNICAL',
    description: 'Chart patterns + indicators',
    winRate: 0.40,
    status: 'ACTIVE',
  },
  {
    name: 'Epsilon Scanner',
    pubkey: '7hZnE7Vu7ToNjcugDwoB4w6xu1BeTP7MKNiQNpKrUo9V',
    strategy: 'CONTRARIAN',
    description: 'Fade the crowd, inverse popular trades',
    winRate: 0.20,
    status: 'ACTIVE',
  },
];

async function main() {
  console.log('🌱 Seeding devnet scanners...\n');

  // Note: This assumes Scanner table exists
  // If using TradingAgent table instead, adjust model name
  
  for (const scanner of DEVNET_SCANNERS) {
    try {
      // Try creating scanner
      // Adjust table name based on your actual schema
      const created = await prisma.$executeRaw`
        INSERT INTO scanner (name, pubkey, strategy, description, status, "createdAt", "updatedAt")
        VALUES (${scanner.name}, ${scanner.pubkey}, ${scanner.strategy}, ${scanner.description}, ${scanner.status}, NOW(), NOW())
        ON CONFLICT (pubkey) DO UPDATE 
        SET name = ${scanner.name},
            strategy = ${scanner.strategy},
            description = ${scanner.description},
            status = ${scanner.status},
            "updatedAt" = NOW()
        RETURNING id, name, pubkey
      `;
      
      console.log(`✅ ${scanner.name}: ${scanner.pubkey}`);
    } catch (error: any) {
      console.error(`❌ Failed to seed ${scanner.name}:`, error.message);
    }
  }

  console.log('\n✅ Devnet scanner seeding complete!');
  console.log('\n📍 Devnet Explorer Links:');
  DEVNET_SCANNERS.forEach(s => {
    console.log(`   ${s.name}: https://explorer.solana.com/address/${s.pubkey}?cluster=devnet`);
  });
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
