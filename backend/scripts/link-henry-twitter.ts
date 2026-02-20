import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkTwitter() {
  const WALLET = '31ySFhvatv8T5PeKLeAzngVYWY1ngucUDmL9BVvUaFta';
  const TWITTER_HANDLE = 'henrylatham';
  const AVATAR_URL = `https://unavatar.io/twitter/${TWITTER_HANDLE}`;

  console.log(`Linking @${TWITTER_HANDLE} to wallet ${WALLET}...`);

  const agent = await prisma.tradingAgent.findFirst({
    where: { walletAddress: WALLET }
  });

  if (!agent) {
    console.error('❌ Agent not found! Did you sign in with Privy yet?');
    process.exit(1);
  }

  await prisma.tradingAgent.update({
    where: { id: agent.id },
    data: {
      twitterHandle: TWITTER_HANDLE,
      avatarUrl: AVATAR_URL,
      agentName: `@${TWITTER_HANDLE}`,
    }
  });

  console.log('✅ Updated successfully!');
  console.log(`   Name: @${TWITTER_HANDLE}`);
  console.log(`   Avatar: ${AVATAR_URL}`);
  process.exit(0);
}

linkTwitter();
