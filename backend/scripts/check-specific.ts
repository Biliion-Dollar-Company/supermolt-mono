
import { db } from '../src/lib/db';

async function checkSpecificAgent() {
    console.log('Searching for agent...');

    // Try finding by twitter handle
    const byHandle = await db.tradingAgent.findFirst({
        where: {
            twitterHandle: { contains: 'SuperRouterSol', mode: 'insensitive' }
        }
    });

    if (byHandle) {
        console.log('Found by handle:', JSON.stringify(byHandle, null, 2));
        return;
    }

    // Try finding by wallet (userId)
    const allAgents = await db.tradingAgent.findMany();
    const byWallet = allAgents.find(a => a.userId.endsWith('vmTn'));

    if (byWallet) {
        console.log('Found by wallet suffix:', JSON.stringify(byWallet, null, 2));
        return;
    }

    console.log('Agent not found.');
}

checkSpecificAgent();
