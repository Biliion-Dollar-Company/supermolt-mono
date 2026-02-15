/**
 * Verify SuperRouter wallet from private key
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const secretKey = 'cwcVZMtHYbBRsgitd9c6Q3NkN9Po3qPBoQBbAAFrD3JLVX2ruf5b1p7Jf3td55UywBeyu95e2Sak73hpwFWgtaU';

try {
  const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
  const publicKey = keypair.publicKey.toBase58();
  
  console.log('\n🔑 SuperRouter Wallet Info:');
  console.log('   Public Key:', publicKey);
  console.log('   Expected:', '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn');
  console.log('   Match:', publicKey === '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn' ? '✅ YES' : '❌ NO');
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
