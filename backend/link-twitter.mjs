import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const PRIVATE_KEY = 'cwcVZMtHYbBRsgitd9c6Q3NkN9Po3qPBoQBbAAFrD3JLVX2ruf5b1p7Jf3td55UywBeyu95e2Sak73hpwFWgtaU';
const API_BASE = 'https://sr-mobile-production.up.railway.app';

async function linkTwitter() {
  try {
    // ============================================
    // STEP 1: Authenticate via SIWS
    // ============================================
    console.log('🔐 Step 1: Authenticating agent via SIWS...\n');
    
    const secretKey = bs58.decode(PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey.toBase58();
    
    console.log('🔑 Public Key:', publicKey);
    
    // Get challenge
    const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge?publicKey=${publicKey}`);
    const challengeData = await challengeRes.json();
    console.log('📋 Nonce received:', challengeData.nonce);
    
    // Build SIWS message (statement + nonce)
    const message = `${challengeData.statement}\n\nNonce: ${challengeData.nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    
    // Sign message
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);
    console.log('✍️  Signature created');
    
    // Verify signature
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
      throw new Error('SIWS verification failed: ' + verifyData.error);
    }
    
    const jwtToken = verifyData.token;
    const agentId = verifyData.agent?.id;
    console.log('✅ Authenticated! JWT token received\n');
    
    // ============================================
    // STEP 2: Request Twitter Verification Code
    // ============================================
    console.log('🐦 Step 2: Requesting Twitter verification code...\n');
    
    const twitterReqRes = await fetch(`${API_BASE}/agent-auth/twitter/request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const twitterReqData = await twitterReqRes.json();
    if (!twitterReqData.success) {
      throw new Error('Twitter request failed: ' + twitterReqData.error);
    }
    
    const { code, tweetTemplate, expiresAt } = twitterReqData.data;
    const expiresDate = new Date(expiresAt).toLocaleString();
    
    console.log('📝 Verification Code:', code);
    console.log('⏰ Expires:', expiresDate);
    console.log('\n📱 TWEET THIS FROM YOUR OFFICIAL ACCOUNT:\n');
    console.log('─'.repeat(60));
    console.log(tweetTemplate);
    console.log('─'.repeat(60));
    console.log('\n⚠️  Important: Post this tweet NOW (expires in 30 minutes)');
    console.log('⚠️  Use the official account you want to link');
    console.log('\n📋 After posting, get the tweet URL (format: https://x.com/yourhandle/status/123456)\n');
    
    // ============================================
    // STEP 3: Wait for User to Post Tweet
    // ============================================
    console.log('🔗 Step 3: Submit tweet URL to verify\n');
    console.log('Run this command after posting the tweet:');
    console.log(`\nnode link-twitter-verify.mjs "${jwtToken}" "TWEET_URL_HERE"\n`);
    
    // Save token for verification step
    const fs = await import('fs');
    fs.writeFileSync('.twitter-link-token.json', JSON.stringify({
      token: jwtToken,
      code,
      expiresAt,
      agentId,
      publicKey
    }, null, 2));
    
    console.log('💾 Token saved to .twitter-link-token.json');
    console.log('✅ Ready for verification step!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

linkTwitter();
