import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

// Generate a new keypair for Orion
const keypair = Keypair.generate();
const pubkey = keypair.publicKey.toBase58();
const secretKey = bs58.encode(keypair.secretKey);

console.log('🤖 ORION AGENT IDENTITY');
console.log('======================');
console.log('Public Key:', pubkey);
console.log('Secret Key:', secretKey);
console.log('');

// Save to env file
const envContent = `ORION_PUBKEY=${pubkey}
ORION_SECRET_KEY=${secretKey}
`;

fs.writeFileSync('.env.orion', envContent);
console.log('✅ Saved to .env.orion');
console.log('');
console.log('Next step: Authenticate via SIWS and register!');
