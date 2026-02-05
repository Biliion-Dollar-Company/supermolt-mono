import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const scanners = [
  {
    agentId: 'alpha',
    name: 'Alpha Scanner',
    pubkey: 'EoB8VttZSpnkuT7AutztD76jgroeCAatvArEXiTe7Suu',
    privateKey: process.env.ALPHA_SCANNER_PRIVATE_KEY!,
    strategy: 'god_wallet',
    description: 'Tracks 24 whale wallets, copies high-conviction buys'
  },
  {
    agentId: 'beta',
    name: 'Beta Scanner',
    pubkey: 'FZMLekiQwvnVQoDkbWpGtHCC3djv4oCH4GZaSvhsfsyG',
    privateKey: process.env.BETA_SCANNER_PRIVATE_KEY!,
    strategy: 'ai_sentiment',
    description: 'Gemini AI-powered sentiment + narrative velocity analysis'
  },
  {
    agentId: 'gamma',
    name: 'Gamma Scanner',
    pubkey: '9TSvGsV1ThqcjWd6TRUZkSkrWShUeDyomhKyWn3hp865',
    privateKey: process.env.GAMMA_SCANNER_PRIVATE_KEY!,
    strategy: 'liquidity',
    description: 'Detects large capital inflows and liquidity clusters'
  },
  {
    agentId: 'delta',
    name: 'Delta Scanner',
    pubkey: '4mbfrw6jHmN6JTHHo7vPcMKR6kbT6K6pBLnCyXTVvr4G',
    privateKey: process.env.DELTA_SCANNER_PRIVATE_KEY!,
    strategy: 'technical',
    description: 'Chart patterns, volume spikes, breakout detection'
  },
  {
    agentId: 'epsilon',
    name: 'Epsilon Scanner',
    pubkey: 'DnrBCtAasuS6ruWvvNyN6J5vudTmwaa6hUs1fEzdYPWx',
    privateKey: process.env.EPSILON_SCANNER_PRIVATE_KEY!,
    strategy: 'contrarian',
    description: 'Inverse crowd sentiment, mean reversion plays'
  }
];

async function main() {
  console.log('🌱 Seeding scanner agents...\n');

  for (const scanner of scanners) {
    const created = await prisma.scanner.upsert({
      where: { agentId: scanner.agentId },
      update: scanner,
      create: scanner
    });

    console.log(`✅ ${created.name} (${created.agentId})`);
    console.log(`   Pubkey: ${created.pubkey}`);
    console.log(`   Strategy: ${created.strategy}\n`);
  }

  console.log('✨ Seeded 5 scanner agents successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding scanners:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
