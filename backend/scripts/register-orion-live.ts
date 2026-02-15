import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import nacl from 'tweetnacl';

const BACKEND_URL = 'https://sr-mobile-production.up.railway.app';

// Load Orion's identity
const envContent = fs.readFileSync('.env.orion', 'utf-8');
const secretKeyMatch = envContent.match(/ORION_SECRET_KEY=(.+)/);
if (!secretKeyMatch) throw new Error('Secret key not found');

const secretKey = bs58.decode(secretKeyMatch[1]);
const keypair = Keypair.fromSecretKey(secretKey);
const pubkey = keypair.publicKey.toBase58();

console.log('🤖 ORION REGISTRATION');
console.log('====================');
console.log('Wallet:', pubkey);
console.log('Backend:', BACKEND_URL);
console.log('');

async function registerOrion() {
  // Step 1: Request challenge
  console.log('📝 Step 1: Requesting SIWS challenge...');
  const challengeRes = await fetch(`${BACKEND_URL}/auth/agent/challenge`, {
    method: 'GET'
  });
  
  if (!challengeRes.ok) {
    const error = await challengeRes.text();
    throw new Error(`Challenge failed: ${error}`);
  }
  
  const { nonce, statement } = await challengeRes.json();
  console.log('✅ Challenge received');
  console.log('   Nonce:', nonce);
  console.log('   Statement:', statement);
  console.log('');
  
  // Step 2: Sign the nonce
  console.log('✍️  Step 2: Signing nonce...');
  const messageToSign = `${statement}\n\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(messageToSign);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signature = bs58.encode(signatureBytes);
  console.log('✅ Signature created');
  console.log('');
  
  // Step 3: Verify and register
  console.log('🔐 Step 3: Verifying signature and registering...');
  const verifyRes = await fetch(`${BACKEND_URL}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey,
      signature,
      nonce
    })
  });
  
  if (!verifyRes.ok) {
    const error = await verifyRes.text();
    throw new Error(`Verification failed: ${error}`);
  }
  
  const result = await verifyRes.json();
  console.log('✅ REGISTERED SUCCESSFULLY!');
  console.log('');
  console.log('Response:', JSON.stringify(result, null, 2));
  console.log('');
  
  if (result.accessToken) {
    const tokenEnv = `ORION_ACCESS_TOKEN=${result.accessToken}
ORION_REFRESH_TOKEN=${result.refreshToken || ''}
ORION_AGENT_ID=${result.agent?.id || ''}
`;
    
    fs.appendFileSync('.env.orion', tokenEnv);
    console.log('✅ Tokens saved to .env.orion');
  }
  
  console.log('');
  console.log('🎉 Orion is now live on SuperMolt!');
  console.log('   View profile: https://www.supermolt.xyz/agents/' + pubkey);
}

registerOrion().catch(console.error);
