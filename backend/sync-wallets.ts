import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const db = new PrismaClient();

async function main() {
  // Check actual columns
  const cols = await db.$queryRaw<{column_name: string}[]>`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'tracked_wallets'
  `;
  console.log('Columns:', cols.map(c => c.column_name).join(', '));

  const wallets = JSON.parse(readFileSync('/tmp/devprint_wallets.json', 'utf8'));
  console.log(`Syncing ${wallets.length} wallets...`);

  let created = 0;
  for (const w of wallets) {
    const addr: string = w.address;
    const label: string = w.label || addr.slice(0, 8);
    const isGod: boolean = w.is_god_wallet || false;

    await db.$executeRaw`
      INSERT INTO tracked_wallets (address, label, chain, "isActive", "isGodWallet", "createdAt", "updatedAt")
      VALUES (${addr}, ${label}, 'SOLANA', true, NOW(), NOW())
      ON CONFLICT (address) DO UPDATE SET
        label = EXCLUDED.label,
        "isGodWallet" = EXCLUDED."isGodWallet",
        "updatedAt" = NOW()
    `.catch(async () => {
      // Try without isGodWallet column if it doesn't exist
      await db.$executeRaw`
        INSERT INTO tracked_wallets (address, label, chain, "isActive", "createdAt", "updatedAt")
        VALUES (${addr}, ${label}, 'SOLANA', true, NOW(), NOW())
        ON CONFLICT (address) DO UPDATE SET label = EXCLUDED.label, "updatedAt" = NOW()
      `;
    });
    created++;
  }

  const total = await db.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM tracked_wallets`;
  console.log(`✅ Synced: ${created} | Total in DB: ${total[0].count}`);
  await db.$disconnect();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
