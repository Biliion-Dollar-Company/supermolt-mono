// Generate 5 Solana wallets for scanner agents
// Run: node generate-scanner-wallets.js

const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const scanners = [
  {
    id: 'alpha',
    name: 'Alpha Scanner',
    strategy: 'god_wallet',
    description: 'Tracks 24 whale wallets, copies high-conviction buys'
  },
  {
    id: 'beta',
    name: 'Beta Scanner',
    strategy: 'ai_sentiment',
    description: 'Gemini AI-powered sentiment + narrative velocity analysis'
  },
  {
    id: 'gamma',
    name: 'Gamma Scanner',
    strategy: 'liquidity',
    description: 'Detects large capital inflows and liquidity clusters'
  },
  {
    id: 'delta',
    name: 'Delta Scanner',
    strategy: 'technical',
    description: 'Chart patterns, volume spikes, breakout detection'
  },
  {
    id: 'epsilon',
    name: 'Epsilon Scanner',
    strategy: 'contrarian',
    description: 'Inverse crowd sentiment, mean reversion plays'
  }
];

console.log('🔐 Generating Scanner Wallets...\n');
console.log('=' .repeat(80));

const wallets = scanners.map(scanner => {
  const keypair = Keypair.generate();
  const pubkey = keypair.publicKey.toString();
  const privateKey = bs58.encode(keypair.secretKey);

  return {
    ...scanner,
    pubkey,
    privateKey
  };
});

// Output for .env file
console.log('\n📋 Add to .env:\n');
wallets.forEach(wallet => {
  console.log(`${wallet.id.toUpperCase()}_SCANNER_PUBKEY=${wallet.pubkey}`);
  console.log(`${wallet.id.toUpperCase()}_SCANNER_PRIVATE_KEY=${wallet.privateKey}`);
  console.log('');
});

// Output for database seed
console.log('=' .repeat(80));
console.log('\n💾 Database Seed Data:\n');
console.log('```typescript');
console.log('const scanners = [');
wallets.forEach((wallet, idx) => {
  console.log(`  {`);
  console.log(`    agentId: '${wallet.id}',`);
  console.log(`    name: '${wallet.name}',`);
  console.log(`    pubkey: '${wallet.pubkey}',`);
  console.log(`    privateKey: process.env.${wallet.id.toUpperCase()}_SCANNER_PRIVATE_KEY,`);
  console.log(`    strategy: '${wallet.strategy}',`);
  console.log(`    description: '${wallet.description}'`);
  console.log(`  }${idx < wallets.length - 1 ? ',' : ''}`);
});
console.log('];');
console.log('```');

// Output table for reference
console.log('\n' + '='.repeat(80));
console.log('\n📊 Scanner Wallets Summary:\n');
console.table(wallets.map(w => ({
  Agent: w.name,
  Strategy: w.strategy,
  Pubkey: w.pubkey.substring(0, 12) + '...'
})));

console.log('\n✅ Done! Copy the .env variables above and store them securely.');
console.log('⚠️  NEVER commit private keys to git!\n');
