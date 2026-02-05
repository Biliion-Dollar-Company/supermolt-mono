import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const treasuryPubkey = new PublicKey('4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR');
const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

console.log('🔍 Checking Treasury USDC Balance...\n');

try {
  const ata = await getAssociatedTokenAddress(usdcMint, treasuryPubkey);
  console.log('📍 Treasury ATA:', ata.toBase58());
  
  const accountInfo = await getAccount(connection, ata);
  const balance = Number(accountInfo.amount) / 1_000_000; // USDC has 6 decimals
  
  console.log('💰 USDC Balance:', balance, 'USDC');
  console.log('📊 Raw amount:', accountInfo.amount.toString());
  
  if (balance >= 19.73) {
    console.log('✅ SUFFICIENT USDC FOR DISTRIBUTION');
  } else {
    console.log('❌ NEED MORE USDC (need 19.73, have', balance, ')');
  }
} catch (error: any) {
  console.error('❌ Error:', error.message);
  if (error.message.includes('could not find')) {
    console.log('\n💡 Token account does not exist yet. Need to create ATA first.');
  }
}
