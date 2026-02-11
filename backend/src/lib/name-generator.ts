
// Degen Name Generator
// Generates random "Adjective Noun" combinations for agent names.

const ADJECTIVES = [
    'Based', 'Diamond', 'Paper', 'Moon', 'Chad', 'Degen', 'Alpha', 'Beta', 'Sigma', 'Rugged',
    'Pump', 'Dump', 'Bullish', 'Bearish', 'Liquid', 'Solana', 'Ether', 'Gas', 'Mint', 'Stake',
    'Swap', 'Yield', 'Passive', 'Giga', 'Mega', 'Tiny', 'Whale', 'Shrimp', 'Holdup', 'Wagmi',
    'Ngmi', 'Fud', 'Fomo', 'Safu', 'Renounced', 'Locked', 'Burnt', 'Ape', 'Pepe', 'Doge',
    'Shib', 'Bonk', 'Wif', 'Mog', 'Pop', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine',
    'Cursed', 'Blessed', 'Shiny', 'Dark', 'Light', 'Golden', 'Silver', 'Bronze', 'Rusty',
    'Dusty', 'Clean', 'Dirty', 'Fast', 'Slow', 'Turbo', 'Nitro', 'Hyper', 'Sonic', 'Laser',
    'Quantum', 'Cyber', 'Crypto', 'Techno', 'Retro', 'Future', 'Ancient', 'Elder', 'Young',
    'Baby', 'Boomer', 'Zoomer', 'Doomer', 'Bloomer', 'Salty', 'Spicy', 'Sweet', 'Sour', 'Bitter',
    'Umami', 'Rich', 'Poor', 'Broke', 'Wealthy', 'Funny', 'Serious', 'Crazy', 'Sane', 'Wild', 'Tame'
];

const NOUNS = [
    'Hands', 'Brain', 'Mindset', 'Holder', 'Jeet', 'Trader', 'Sniper', 'Bot', 'Whale', 'Shark',
    'Dolphin', 'Shrimp', 'Bag', 'Wallet', 'Key', 'Node', 'Block', 'Chain', 'Hash', 'Token',
    'Coin', 'Gem', 'Rug', 'Dev', 'Founder', 'VC', 'Influencer', 'Maxi', 'Pill', 'Matrix',
    'System', 'Protocol', 'Contract', 'Yield', 'Farm', 'Vault', 'Pool', 'Liquidity', 'Slippage',
    'Gas', 'Nonce', 'Sig', 'Keypair', 'Ledger', 'Graph', 'Oracle', 'Bridge', 'Router', 'Switch',
    'Server', 'Client', 'User', 'Admin', 'Mod', 'Intern', 'Ceo', 'Cto', 'Cfo', 'Coo', 'Dao',
    'Proposal', 'Vote', 'Bribe', 'Grant', 'Airdrop', 'Claim', 'Reward', 'Staking', 'Vesting',
    'Lockup', 'Unlock', 'Launch', 'Presale', 'Whitelist', 'Allocation', 'Speculator', 'Gambler',
    'Investor', 'Saver', 'Spender', 'Lender', 'Borrower', 'Liquidator', 'Miner', 'Validator',
    'Delegator', 'Nominator', 'Council', 'Member', 'Citizen', 'Plebeian', 'Patrician', 'King',
    'Queen', 'Prince', 'Princess', 'Baron', 'Duke', 'Lord', 'Lady', 'Knight', 'Wizard', 'Mage',
    'Warlock', 'Sorcerer', 'Cleric', 'Paladin', 'Warrior', 'Rogue', 'Hunter', 'Druid', 'Shaman'
];

export function generateFunnyName(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
}

/**
 * Generates a unique name by appending numbers if necessary.
 * Pass a checking function that returns true if name exists.
 */
export async function generateUniqueName(checkExists: (name: string) => Promise<boolean>): Promise<string> {
    let name = generateFunnyName();
    let attempts = 0;

    while (await checkExists(name)) {
        attempts++;
        if (attempts > 5) {
            // If we struggle to find a unique name, append a random number
            name = `${generateFunnyName()} ${Math.floor(Math.random() * 1000)}`;
        } else {
            name = generateFunnyName();
        }
    }

    return name;
}
