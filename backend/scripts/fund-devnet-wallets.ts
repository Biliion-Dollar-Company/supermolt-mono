/**
 * Fund Devnet Wallets
 * 
 * Airdrops devnet SOL to treasury and 5 scanner wallets
 * 
 * Run: bun run scripts/fund-devnet-wallets.ts
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_RPC, 'confirmed');

const WALLETS = [
  { name: 'Treasury', pubkey: '4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR' },
  { name: 'Alpha Scanner', pubkey: 'FwhhaoXG67kQiAG7P2siN6HPvbyQ49E799uxcmnez5qk' },
  { name: 'Beta Scanner', pubkey: '2aHP2HhXxiy7fMZUTx3TYjiko6ydsFZJ1ybg4FxL6A5F' },
  { name: 'Gamma Scanner', pubkey: 'EjAqcB9RL5xfcrbjcbFT8ecewf9cqxcbjnjyR3eLjFK9' },
  { name: 'Delta Scanner', pubkey: '5hEdpKeQWZ2bFAUdb3ibsJSzZpUqpksDF3Gw1278qKPw' },
  { name: 'Epsilon Scanner', pubkey: '7hZnE7Vu7ToNjcugDwoB4w6xu1BeTP7MKNiQNpKrUo9V' },
];

const AIRDROP_AMOUNT = 2; // SOL per wallet

async function fundWallet(name: string, pubkeyStr: string) {
  try {
    const pubkey = new PublicKey(pubkeyStr);
    
    console.log(`\n💰 Funding ${name}...`);
    console.log(`   Address: ${pubkeyStr}`);
    
    // Request airdrop
    const signature = await connection.requestAirdrop(
      pubkey,
      AIRDROP_AMOUNT * LAMPORTS_PER_SOL
    );
    
    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...latestBlockhash,
    });
    
    // Check balance
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`   ✅ Success! Balance: ${solBalance.toFixed(4)} SOL`);
    console.log(`   🔗 https://explorer.solana.com/address/${pubkeyStr}?cluster=devnet`);
    
    return true;
  } catch (error: any) {
    console.error(`   ❌ Failed: ${error.message}`);
    if (error.message.includes('rate limit')) {
      console.log(`   ⏳ Tip: Devnet faucet has rate limits. Wait 30s between requests.`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Funding Devnet Wallets\n');
  console.log(`Network: ${DEVNET_RPC}`);
  console.log(`Amount per wallet: ${AIRDROP_AMOUNT} SOL\n`);
  console.log('─'.repeat(60));
  
  let successCount = 0;
  
  for (const wallet of WALLETS) {
    const success = await fundWallet(wallet.name, wallet.pubkey);
    if (success) successCount++;
    
    // Wait 5 seconds between airdrops to avoid rate limiting
    if (wallet !== WALLETS[WALLETS.length - 1]) {
      console.log('\n⏳ Waiting 5s to avoid rate limit...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log(`\n✅ Funded ${successCount}/${WALLETS.length} wallets`);
  
  if (successCount < WALLETS.length) {
    console.log('\n⚠️  Some wallets failed to fund. Retry or use web faucet:');
    console.log('   https://faucet.solana.com/');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Get devnet USDC from Circle faucet: https://faucet.circle.com/');
  console.log('2. Run seed script: bun run scripts/seed-devnet-scanners.ts');
  console.log('3. Update Railway env vars (see .env.example)');
  console.log('4. Test treasury distribution');
}

main()
  .catch((e) => {
    console.error('\n❌ Funding failed:', e);
    process.exit(1);
  });
