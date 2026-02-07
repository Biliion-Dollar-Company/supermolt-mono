import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const zeta = Keypair.generate();
const theta = Keypair.generate();

console.log('Agent Zeta:');
console.log('  Public:', zeta.publicKey.toBase58());
console.log('  Secret:', bs58.encode(zeta.secretKey));
console.log('');
console.log('Agent Theta:');
console.log('  Public:', theta.publicKey.toBase58());
console.log('  Secret:', bs58.encode(theta.secretKey));
