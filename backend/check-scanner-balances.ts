import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const scanners = [
  { name: 'Alpha', pubkey: 'EoB8VttZSpnkuT7AutztD76jgroeCAatvArEXiTe7Suu', expected: 7.84 },
  { name: 'Gamma', pubkey: '9TSvGsV1ThqcjWd6TRUZkSkrWShUeDyomhKyWn3hp865', expected: 5.88 },
  { name: 'Beta', pubkey: 'FZMLekiQwvnVQoDkbWpGtHCC3djv4oCH4GZaSvhsfsyG', expected: 2.94 },
  { name: 'Delta', pubkey: '4mbfrw6jHmN6JTHHo7vPcMKR6kbT6K6pBLnCyXTVvr4G', expected: 1.84 },
  { name: 'Epsilon', pubkey: 'DnrBCtAasuS6ruWvvNyN6J5vudTmwaa6hUs1fEzdYPWx', expected: 1.23 }
];

console.log('💰 Checking Scanner USDC Balances...\n');

for (const scanner of scanners) {
  try {
    const pubkey = new PublicKey(scanner.pubkey);
    const ata = await getAssociatedTokenAddress(usdcMint, pubkey);
    const accountInfo = await getAccount(connection, ata);
    const balance = Number(accountInfo.amount) / 1_000_000;
    
    const status = Math.abs(balance - scanner.expected) < 0.01 ? '✅' : '⚠️';
    console.log(`${status} ${scanner.name} Scanner:`);
    console.log(`   Expected: ${scanner.expected} USDC`);
    console.log(`   Actual: ${balance} USDC`);
    console.log(`   Address: ${scanner.pubkey}`);
    console.log('');
  } catch (error: any) {
    console.error(`❌ ${scanner.name} Scanner: ${error.message}\n`);
  }
}

// Check treasury remaining
const treasuryPubkey = new PublicKey('4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR');
const treasuryAta = await getAssociatedTokenAddress(usdcMint, treasuryPubkey);
const treasuryAccount = await getAccount(connection, treasuryAta);
const treasuryBalance = Number(treasuryAccount.amount) / 1_000_000;

console.log('💰 Treasury Remaining:');
console.log(`   Balance: ${treasuryBalance} USDC`);
console.log(`   Expected: ~0.54 USDC (20.27 - 19.73)\n`);
