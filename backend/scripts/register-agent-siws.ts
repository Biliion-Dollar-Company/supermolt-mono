/**
 * Register Agent via SIWS (Sign In With Solana)
 * 
 * Usage:
 *   DATABASE_URL="..." bun run scripts/register-agent-siws.ts obs_2d699d1509105cd0
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { db as prisma } from '../src/lib/db';

const API_BASE = process.env.API_BASE || 'https://sr-mobile-production.up.railway.app';

async function main() {
  const agentId = process.argv[2];
  if (!agentId) {
    console.error('❌ Usage: bun run scripts/register-agent-siws.ts <agentId>');
    process.exit(1);
  }

  // Get agent from DB
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, config: true }
  });

  if (!agent) {
    console.error('❌ Agent not found:', agentId);
    process.exit(1);
  }

  const config = agent.config as any;
  const secretKey = config.secretKey;

  if (!secretKey) {
    console.error('❌ Agent has no secretKey in config');
    process.exit(1);
  }

  // Create keypair from secret
  const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
  const publicKey = keypair.publicKey.toBase58();

  console.log(`\n🔐 Registering agent: ${agent.name}`);
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
  console.log('   Statement:', statement);

  // Step 2: Sign challenge
  console.log('\n✍️  Step 2: Signing challenge...');
  const message = `${statement}\n\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = bs58.encode(signature);
  console.log('   Signature:', signatureBase58.substring(0, 20) + '...');

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
  const refreshToken = verifyData.data?.refreshToken || verifyData.refreshToken;
  const agentInfo = verifyData.data?.agent || verifyData.agent;

  console.log('\n🎉 SUCCESS! Agent registered via SIWS\n');
  console.log('Agent Info:');
  console.log('  ID:', agentInfo?.id || 'N/A');
  console.log('  Name:', agentInfo?.name || '(not set)');
  console.log('  Wallet:', publicKey);
  
  if (token) {
    console.log('\n🔑 Access Token (save this!):');
    console.log('  ' + token);
    if (refreshToken) {
      console.log('\n🔄 Refresh Token:');
      console.log('  ' + refreshToken);
    }
  }
  
  console.log('\n💡 Next steps:');
  console.log('  1. Fund the wallet:', publicKey);
  console.log('  2. Trade on-chain (Jupiter/Pump.fun)');
  console.log('  3. Helius will detect trades automatically');
  console.log('\n🎯 Test the API:');
  console.log(`  curl -H "Authorization: Bearer ${token?.substring(0, 30)}..." ${API_BASE}/arena/me`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
