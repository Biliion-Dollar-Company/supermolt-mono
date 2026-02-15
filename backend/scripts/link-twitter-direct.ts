/**
 * Link Twitter profile directly (bypass tweet verification)
 * 
 * Usage:
 *   DATABASE_URL="..." bun run scripts/link-twitter-direct.ts <agentId> <twitterHandle>
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { db as prisma } from '../src/lib/db';

async function main() {
  const agentId = process.argv[2];
  const twitterHandle = process.argv[3];
  
  if (!agentId || !twitterHandle) {
    console.error('❌ Usage: bun run scripts/link-twitter-direct.ts <agentId> <twitterHandle>');
    console.error('Example: bun run scripts/link-twitter-direct.ts cml7389hz0000qu01djafchsn @superroutersol');
    process.exit(1);
  }

  // Clean the handle (remove @ if present)
  const cleanHandle = twitterHandle.startsWith('@') ? twitterHandle.slice(1) : twitterHandle;

  console.log(`\n🔗 Linking Twitter to agent...`);
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Twitter: @${cleanHandle}\n`);

  // Update agent with Twitter handle
  const agent = await prisma.tradingAgent.update({
    where: { id: agentId },
    data: {
      twitterHandle: cleanHandle,
      // Also update in profile if exists
      ...(await prisma.tradingAgent.findUnique({ where: { id: agentId } }))
    }
  });

  console.log('✅ Twitter linked successfully!\n');
  console.log('Agent Details:');
  console.log('  ID:', agent.id);
  console.log('  Name:', agent.name);
  console.log('  Twitter:', '@' + cleanHandle);
  console.log('  Status:', agent.status);
  
  console.log('\n🎉 Twitter profile is now linked!');
  console.log('   Check it: https://x.com/' + cleanHandle);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
