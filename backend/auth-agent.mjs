import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const PRIVATE_KEY = 'KhKMohi5KGGoJ9tbBLmhV18Cu96xQYCiDi1MuVv9dLf8q2QPbyc8bCjUJet1Zo334ureBwWP7qBC9Evj4nsf4dn';
const API_BASE = 'https://sr-mobile-production.up.railway.app';

async function authenticateAgent() {
  try {
    // Decode the private key
    const secretKey = bs58.decode(PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey.toBase58();
    
    console.log('🔑 Public Key:', publicKey);
    
    // Step 1: Get challenge
    console.log('\n📋 Step 1: Getting SIWS challenge...');
    const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge?publicKey=${publicKey}`);
    const challengeData = await challengeRes.json();
    
    // Build the SIWS message
    const message = `${challengeData.statement}\n\nNonce: ${challengeData.nonce}`;
    
    console.log('✅ Challenge received');
    
    // Step 2: Sign the challenge
    console.log('\n🖊️  Step 2: Signing challenge...');
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);
    
    console.log('✅ Signature generated');
    
    // Step 3: Verify and get token
    console.log('\n🔐 Step 3: Verifying signature...');
    const verifyRes = await fetch(`${API_BASE}/auth/agent/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: publicKey,
        nonce: challengeData.nonce,
        signature: signatureBase58
      })
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyData.success) {
      throw new Error(`Verification failed: ${JSON.stringify(verifyData)}`);
    }
    
    console.log('\n✅ Authentication successful!');
    console.log('\n🎫 Access Token:', verifyData.token.substring(0, 40) + '...');
    console.log('🔄 Refresh Token:', verifyData.refreshToken.substring(0, 40) + '...');
    
    if (verifyData.agent) {
      console.log('\n👤 Agent Profile:');
      console.log('   ID:', verifyData.agent.id);
      console.log('   Name:', verifyData.agent.name);
      console.log('   Wallet:', verifyData.agent.pubkey);
      console.log('   Status:', verifyData.agent.status);
      console.log('   Archetype:', verifyData.agent.archetypeId);
    }
    
    console.log('\n📚 Skills Loaded:', Object.keys(verifyData.skills).length, 'categories');
    console.log('   Tasks:', verifyData.skills.tasks?.length || 0);
    console.log('   Trading:', verifyData.skills.trading?.length || 0);
    console.log('   Onboarding:', verifyData.skills.onboarding?.length || 0);
    
    // Save tokens to file
    const fs = await import('fs');
    fs.writeFileSync('.agent-tokens.json', JSON.stringify({
      publicKey,
      accessToken: verifyData.token,
      refreshToken: verifyData.refreshToken,
      agent: verifyData.agent,
      skills: verifyData.skills
    }, null, 2));
    
    console.log('\n💾 Tokens saved to .agent-tokens.json');
    
    return verifyData;
    
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

authenticateAgent();
