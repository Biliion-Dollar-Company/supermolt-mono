#!/usr/bin/env bun
/**
 * Generate Solana keypairs for scanner agents
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const scanners = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'];

console.log('\n🔑 Generated Scanner Keypairs:\n');
console.log('Add these to your .env file:\n');

for (const name of scanners) {
  const keypair = Keypair.generate();
  const privateKeyBase58 = bs58.encode(keypair.secretKey);
  console.log(`${name}_SCANNER_PRIVATE_KEY=${privateKeyBase58}`);
}

console.log('\n');
