/**
 * Create USDC token accounts for all scanner wallets
 */
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';

const RPC_URL = 'https://api.devnet.solana.com';
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Treasury wallet (payer)
const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY!;
let treasuryKeyPair: Keypair;

try {
  const privKeyBytes = Uint8Array.from(Buffer.from(treasuryPrivateKey, 'base64'));
  treasuryKeyPair = Keypair.fromSecretKey(privKeyBytes);
} catch {
  const privKeyBytes = bs58.decode(treasuryPrivateKey);
  treasuryKeyPair = Keypair.fromSecretKey(privKeyBytes);
}

// Scanner wallets (devnet)
const scanners = [
  { name: 'Alpha', pubkey: 'EoB8VttZSpnkuT7AutztD76jgroeCAatvArEXiTe7Suu' },
  { name: 'Gamma', pubkey: '9TSvGsV1ThqcjWd6TRUZkSkrWShUeDyomhKyWn3hp865' },
  { name: 'Beta', pubkey: 'FZMLekiQwvnVQoDkbWpGtHCC3djv4oCH4GZaSvhsfsyG' },
  { name: 'Delta', pubkey: '4mbfrw6jHmN6JTHHo7vPcMKR6kbT6K6pBLnCyXTVvr4G' },
  { name: 'Epsilon', pubkey: 'DnrBCtAasuS6ruWvvNyN6J5vudTmwaa6hUs1fEzdYPWx' }
];

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('🏗️  Creating USDC token accounts for scanners...\n');
  console.log(`Treasury: ${treasuryKeyPair.publicKey.toBase58()}`);
  console.log(`USDC Mint: ${USDC_MINT.toBase58()}\n`);
  
  for (const scanner of scanners) {
    try {
      const recipientPubkey = new PublicKey(scanner.pubkey);
      const tokenAccount = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);
      
      // Check if already exists
      try {
        await getAccount(connection, tokenAccount);
        console.log(`✅ ${scanner.name}: Token account already exists`);
        console.log(`   Account: ${tokenAccount.toBase58()}\n`);
        continue;
      } catch {}
      
      // Create it
      console.log(`🔨 ${scanner.name}: Creating token account...`);
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          treasuryKeyPair.publicKey,  // payer
          tokenAccount,                // ata
          recipientPubkey,             // owner
          USDC_MINT                     // mint
        )
      );
      
      const signature = await connection.sendTransaction(transaction, [treasuryKeyPair]);
      await connection.confirmTransaction(signature);
      
      console.log(`✅ ${scanner.name}: Token account created!`);
      console.log(`   Account: ${tokenAccount.toBase58()}`);
      console.log(`   Signature: ${signature}\n`);
      
    } catch (error: any) {
      console.error(`❌ ${scanner.name}: Failed -`, error.message, '\n');
    }
  }
  
  console.log('🎉 All token accounts created!');
}

main().catch(console.error);
