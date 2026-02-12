
import { db } from '../src/lib/db';

const HANDLE = 'SuperRouterSol';
const AVATAR_URL = `https://unavatar.io/twitter/${HANDLE}`;

async function setPfp() {
    console.log(`Setting PFP for @${HANDLE} to ${AVATAR_URL}...`);

    const agent = await db.tradingAgent.findFirst({
        where: { twitterHandle: { contains: HANDLE, mode: 'insensitive' } }
    });

    if (!agent) {
        console.error('Agent not found!');
        process.exit(1);
    }

    await db.tradingAgent.update({
        where: { id: agent.id },
        data: { avatarUrl: AVATAR_URL }
    });

    console.log('✅ Updated avatarUrl successfully.');
    process.exit(0);
}

setPfp();
