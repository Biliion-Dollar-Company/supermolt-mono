
import { db } from '../src/lib/db';

const WALLET = '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn';

async function checkScanner() {
    console.log(`Checking Scanner table for ${WALLET}...`);

    const scanner = await db.scanner.findFirst({
        where: { pubkey: WALLET }
    });

    if (scanner) {
        console.log('✅ Found within Scanner table:', JSON.stringify(scanner, null, 2));
    } else {
        console.log('❌ Not found in Scanner table.');
    }

    // Check TradingAgent again (I just created it though)
    const agent = await db.tradingAgent.findFirst({
        where: { userId: WALLET }
    });

    if (agent) {
        console.log('✅ Found within TradingAgent table:', JSON.stringify(agent, null, 2));
    } else {
        console.log('❌ Not found in TradingAgent table.');
    }

    process.exit(0);
}

checkScanner();
