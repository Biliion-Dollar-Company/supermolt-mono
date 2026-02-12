
import { db } from '../src/lib/db';

const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAAISorgEAAAAAJw0jQjgXhCXGOdcB8A1CsqUG738%3D434Y8IfeDOPuLoqoFChhzISyUyzq2url2jmjhXBRrH6o2Ps2O9';
const SUPERROUTER_WALLET = '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn';
const HANDLE = 'SuperRouterSol';

async function fetchTwitterProfile(username: string): Promise<string | null> {
    console.log(`Fetching profile for ${username}...`);
    try {
        const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=profile_image_url`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`
            }
        });

        if (!response.ok) {
            console.error(`Error fetching ${username}: ${response.status} ${response.statusText}`);
            const body = await response.text();
            console.error(body);
            return null;
        }

        const data = await response.json();
        const pfp = data.data?.profile_image_url;

        if (pfp) {
            return pfp.replace('_normal', '');
        }
        return null;

    } catch (error) {
        console.error(`Exception fetching ${username}:`, error);
        return null;
    }
}

async function main() {
    console.log('🚀 Setting up SuperRouterSol agent...');

    // 1. Fetch PFP
    const avatarUrl = await fetchTwitterProfile(HANDLE);
    if (avatarUrl) {
        console.log(`✅ Found Avatar: ${avatarUrl}`);
    } else {
        console.log('⚠️  Could not fetch Avatar (using existing or null)');
    }

    // 2. Check if agent exists
    const existing = await db.tradingAgent.findFirst({
        where: { userId: SUPERROUTER_WALLET }
    });

    if (existing) {
        console.log(`ℹ️  Agent exists (ID: ${existing.id}). Updating...`);
        await db.tradingAgent.update({
            where: { id: existing.id },
            data: {
                name: 'SuperRouter', // Or user preference
                twitterHandle: `@${HANDLE}`,
                avatarUrl: avatarUrl || existing.avatarUrl
            }
        });
        console.log('✅ Updated existing agent.');
    } else {
        console.log('🆕 Creating new agent record...');
        await db.tradingAgent.create({
            data: {
                userId: SUPERROUTER_WALLET,
                name: 'SuperRouter',
                twitterHandle: `@${HANDLE}`,
                avatarUrl: avatarUrl,
                status: 'ACTIVE',
                archetypeId: 'super_router',
                config: {
                    role: 'superuser',
                    twitterVerified: true
                }
            }
        });
        console.log('✅ Created new agent.');
    }

    // Double check
    const final = await db.tradingAgent.findFirst({ where: { userId: SUPERROUTER_WALLET } });
    console.log('Final State:', JSON.stringify(final, null, 2));

    process.exit(0);
}

main();
