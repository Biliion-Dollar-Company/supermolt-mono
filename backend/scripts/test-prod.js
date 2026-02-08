import nacl from 'tweetnacl';
import bs58 from 'bs58';

const PROD_URL = 'https://sr-mobile-production.up.railway.app';

async function testSIWSFlow() {
  console.log('🔐 Testing SIWS Authentication on Production\n');
  console.log(`URL: ${PROD_URL}\n`);

  // Step 1: Generate a keypair
  console.log('Step 1: Generating keypair...');
  const keypair = nacl.sign.keyPair();
  const pubkeyBase58 = bs58.encode(Buffer.from(keypair.publicKey));
  const secretKeyBase58 = bs58.encode(Buffer.from(keypair.secretKey));
  
  console.log(`✅ Generated keypair`);
  console.log(`   Public Key: ${pubkeyBase58}`);
  console.log(`   Secret Key: ${secretKeyBase58.slice(0, 20)}...\n`);

  // Step 2: Get nonce from production (GET request)
  console.log('Step 2: Requesting nonce from production...');
  const challengeRes = await fetch(`${PROD_URL}/auth/agent/challenge`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const challengeData = await challengeRes.json();
  console.log(`✅ Got challenge response (status ${challengeRes.status})`);

  if (!challengeData.nonce) {
    console.log(`❌ Failed to get nonce`);
    return;
  }

  const nonce = challengeData.nonce;
  console.log(`   Nonce: ${nonce}\n`);

  // Step 3: Sign the nonce
  console.log('Step 3: Signing nonce...');
  const message = Buffer.from(nonce);
  const signature = nacl.sign.detached(message, keypair.secretKey);
  const signatureBase64 = Buffer.from(signature).toString('base64');
  
  console.log(`✅ Signed nonce with generated keypair\n`);

  // Step 4: Verify signature on production
  console.log('Step 4: Verifying signature on production...');
  const verifyRes = await fetch(`${PROD_URL}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey: pubkeyBase58,
      nonce,
      signature: signatureBase64
    })
  });

  const verifyData = await verifyRes.json();
  console.log(`✅ Got verify response (status ${verifyRes.status})\n`);

  if (verifyData.success && verifyData.agent) {
    console.log(`\n🎉 SUCCESS! SIWS Authentication Works on Production!\n`);
    console.log(`   ✅ Challenge endpoint: OK`);
    console.log(`   ✅ Signature verification: OK`);
    console.log(`   ✅ JWT issued: ${verifyData.token.slice(0, 50)}...`);
    console.log(`   ✅ Agent registered:`);
    console.log(`      - ID: ${verifyData.agent.id}`);
    console.log(`      - Pubkey: ${verifyData.agent.pubkey}`);
    console.log(`      - Status: ${verifyData.agent.status}`);
    console.log(`      - Name: ${verifyData.agent.name}`);
    console.log(`\n✨ Full SIWS Authentication Flow Validated! ✨\n`);
    console.log(`Next steps:`);
    console.log(`  1. Configure Helius webhook`);
    console.log(`  2. Make real mainnet trade`);
    console.log(`  3. Test leaderboard updates`);
    console.log(`  4. Test copy-trading`);
    console.log(`  5. Launch Friday!\n`);
  } else {
    console.log(`❌ Verification failed:`, verifyData);
  }
}

testSIWSFlow().catch(console.error);
