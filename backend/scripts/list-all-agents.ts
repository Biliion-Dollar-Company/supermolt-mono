import { db } from '../src/lib/db';

async function listAgents() {
  const agents = await db.tradingAgent.findMany({
    select: {
      id: true,
      userId: true,
      name: true,
      twitterHandle: true,
      avatarUrl: true,
      chain: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(JSON.stringify(agents, null, 2));
  process.exit(0);
}

listAgents();
