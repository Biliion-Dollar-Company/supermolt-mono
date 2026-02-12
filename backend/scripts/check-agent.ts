
import { db } from '../src/lib/db';

async function checkAgent() {
    const agent = await db.tradingAgent.findFirst({
        where: { name: 'Based Unlock' },
    });
    console.log(JSON.stringify(agent, null, 2));
}

checkAgent();
