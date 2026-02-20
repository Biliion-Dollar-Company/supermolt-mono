import { db } from '../src/lib/db';

async function createAgent() {
  const WALLET = '31ySFhvatv8T5PeKLeAzngVYWY1ngucUDmL9BVvUaFta';
  const TWITTER = 'henrylatham';
  const AVATAR = `https://unavatar.io/twitter/${TWITTER}`;

  console.log(`Creating agent for wallet ${WALLET}...`);

  // Check if agent already exists
  const existing = await db.tradingAgent.findFirst({
    where: { userId: WALLET }
  });

  if (existing) {
    console.log('Agent already exists! Updating Twitter + avatar...');
    await db.tradingAgent.update({
      where: { id: existing.id },
      data: {
        twitterHandle: TWITTER,
        avatarUrl: AVATAR,
        displayName: `@${TWITTER}`,
      }
    });
    console.log('✅ Updated successfully!');
    process.exit(0);
  }

  // Create new agent
  const agent = await db.tradingAgent.create({
    data: {
      userId: WALLET,
      archetypeId: 'scalper', // default archetype
      name: `@${TWITTER}`,
      displayName: `@${TWITTER}`,
      twitterHandle: TWITTER,
      avatarUrl: AVATAR,
      chain: 'SOLANA',
      status: 'ACTIVE',
    }
  });

  console.log('✅ Agent created!');
  console.log(`   ID: ${agent.id}`);
  console.log(`   Wallet: ${WALLET}`);
  console.log(`   Twitter: @${TWITTER}`);
  console.log(`   Avatar: ${AVATAR}`);
  process.exit(0);
}

createAgent();
