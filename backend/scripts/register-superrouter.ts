/**
 * Register SuperRouter via SIWS
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { db as prisma } from '../src/lib/db';

const API_BASE = process.env.API_BASE || 'https://sr-mobile-production.up.railway.app';
const SECRET_KEY = 'cwcVZMtHYbBRsgitd9c6Q3NkN9Po3qPBoQBbAAFrD3JLVX2ruf5b1p7Jf3td55UywBeyu95e2Sak73hpwFWgtaU';

async function main() {
  // Create keypair from secret
  const keypair = Keypair.fromSecretKey(bs58.decode(SECRET_KEY));
  const publicKey = keypair.publicKey.toBase58();

  console.log(`\n🔐 Registering SuperRouter...`);
  console.log(`   Wallet: ${publicKey}\n`);

  // Step 1: Get challenge
  console.log('📝 Step 1: Getting SIWS challenge...');
  const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge?publicKey=${publicKey}`);
  
  if (!challengeRes.ok) {
    console.error('❌ Failed to get challenge:', await challengeRes.text());
    process.exit(1);
  }

  const { nonce, statement } = await challengeRes.json();
  console.log('   Nonce:', nonce);

  // Step 2: Sign challenge
  console.log('\n✍️  Step 2: Signing challenge...');
  const message = `${statement}\n\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = bs58.encode(signature);

  // Step 3: Verify and get JWT
  console.log('\n✅ Step 3: Verifying signature...');
  const verifyRes = await fetch(`${API_BASE}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey: publicKey,
      nonce,
      signature: signatureBase58
    })
  });

  if (!verifyRes.ok) {
    console.error('❌ Verification failed:', await verifyRes.text());
    process.exit(1);
  }

  const verifyData = await verifyRes.json();
  
  const token = verifyData.data?.token || verifyData.token;
  const agentInfo = verifyData.data?.agent || verifyData.agent;

  console.log('\n🎉 SUCCESS! SuperRouter registered\n');
  console.log('Agent Info:');
  console.log('  ID:', agentInfo?.id);
  console.log('  Name:', agentInfo?.name || 'SuperRouter');
  console.log('  Wallet:', publicKey);
  
  // Step 4: Update profile with Twitter handle
  if (token && agentInfo?.id) {
    console.log('\n🐦 Step 4: Linking Twitter...');
    
    const profileRes = await fetch(`${API_BASE}/agent-auth/profile/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        twitterHandle: 'superroutersol',
        displayName: 'SuperRouter',
        bio: 'Autonomous AI trading agent on Solana. Built with DevPrint analytics.'
      })
    });

    if (profileRes.ok) {
      const profileData = await profileRes.json();
      console.log('   ✅ Twitter linked: @superroutersol');
      console.log('   ✅ Profile updated');
    } else {
      console.log('   ⚠️  Profile update failed:', await profileRes.text());
    }
  }
  
  console.log('\n🔑 Access Token (save this!):');
  console.log('  ' + token);
  
  console.log('\n💡 Next: Fund the wallet and start trading!');
  console.log('   Wallet: ' + publicKey);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
