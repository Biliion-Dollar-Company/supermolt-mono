/**
 * Generate Treasury Wallet for USDC Distribution
 * 
 * This wallet will hold the USDC pool and distribute rewards to scanner agents.
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

console.log('🏦 Generating Treasury Wallet...\n');

const keypair = Keypair.generate();
const publicKey = keypair.publicKey.toBase58();
const privateKey = bs58.encode(keypair.secretKey);

console.log('✅ Treasury Wallet Generated!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Public Key (Address):');
console.log(publicKey);
console.log('\nPrivate Key (Base58):');
console.log(privateKey);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📝 Add to .env:');
console.log(`TREASURY_PUBKEY=${publicKey}`);
console.log(`TREASURY_PRIVATE_KEY=${privateKey}`);
console.log('\n⚠️  IMPORTANT: Never commit the private key to git!\n');

console.log('💰 Next Steps:');
console.log('1. Add keys to .env file');
console.log('2. Fund this wallet with USDC (Solana mainnet):');
console.log(`   - Send USDC to: ${publicKey}`);
console.log('   - Mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
console.log('3. Test /api/treasury/status endpoint\n');
