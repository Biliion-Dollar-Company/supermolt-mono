
import { db } from '../src/lib/db';

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

async function fetchTwitterProfile(username: string): Promise<string | null> {
    if (!BEARER_TOKEN) {
        console.error('Missing TWITTER_BEARER_TOKEN');
        return null;
    }

    try {
        const url = `https://api.twitter.com/2/users/by/username/${username}?user.fields=profile_image_url`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`
            }
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.warn(`Rate limit hit for ${username}. Waiting 60s...`);
                await new Promise(r => setTimeout(r, 60000));
                return fetchTwitterProfile(username); // Retry once
            }
            console.error(`Error fetching ${username}: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const pfp = data.data?.profile_image_url;

        if (pfp) {
            // Return high-res if possible
            return pfp.replace('_normal', '');
        }
        return null;

    } catch (error) {
        console.error(`Exception fetching ${username}:`, error);
        return null;
    }
}

async function main() {
    console.log('🚀 Checking SuperRouterSol...');
    const username = 'SuperRouterSol';
    const pfp = await fetchTwitterProfile(username);
    console.log(`PFP for @${username}:`, pfp);
}

main();
