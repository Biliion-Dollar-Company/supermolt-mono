import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const treasuryPubkey = new PublicKey('4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR');

const balance = await connection.getBalance(treasuryPubkey);
const sol = balance / LAMPORTS_PER_SOL;

console.log('💰 Treasury SOL Balance:', sol, 'SOL');
console.log('📊 Lamports:', balance);

if (sol >= 0.015) {
  console.log('✅ SUFFICIENT SOL FOR DISTRIBUTION');
} else {
  console.log('❌ NEED MORE SOL (minimum 0.015 SOL)');
}
