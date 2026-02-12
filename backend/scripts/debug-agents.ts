
import { db } from '../src/lib/db';

async function debugAgents() {
    console.log('🔍 Dumping all agents...');

    const agents = await db.tradingAgent.findMany({
        select: {
            id: true,
            name: true,
            userId: true,
            twitterHandle: true,
            avatarUrl: true
        }
    });

    console.log(`Found ${agents.length} agents.`);

    if (agents.length === 0) {
        console.log('No agents found!');
        return;
    }

    // Print table
    console.log('ID | Name | Wallet | Twitter | Avatar');
    agents.forEach(a => {
        console.log(`${a.id} | ${a.name} | ${a.userId.slice(-6)} | ${a.twitterHandle} | ${a.avatarUrl ? 'YES' : 'NO'}`);
    });

    // Check for specific suffix
    const suffix = 'vmTn';
    const match = agents.find(a => a.userId.endsWith(suffix));
    if (match) {
        console.log(`\n✅ Found match for *${suffix}:`);
        console.log(JSON.stringify(match, null, 2));
    } else {
        console.log(`\n❌ No agent found ending with ${suffix}`);
    }
}

debugAgents();
