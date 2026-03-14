const API_BASE = 'https://sr-mobile-production.up.railway.app';

async function verifyTwitter() {
  try {
    // Get JWT token and tweet URL from args
    const args = process.argv.slice(2);
    let jwtToken = args[0];
    let tweetUrl = args[1];
    
    // If no args, try to load from saved file
    if (!jwtToken) {
      const fs = await import('fs');
      if (fs.existsSync('.twitter-link-token.json')) {
        const saved = JSON.parse(fs.readFileSync('.twitter-link-token.json', 'utf-8'));
        jwtToken = saved.token;
        
        console.log('📂 Loaded saved token');
        console.log('🔑 Agent:', saved.publicKey);
        console.log('📝 Code:', saved.code);
        console.log('⏰ Expires:', new Date(saved.expiresAt).toLocaleString());
        console.log('');
      } else {
        console.error('❌ No token found. Run link-twitter.mjs first.');
        process.exit(1);
      }
    }
    
    if (!tweetUrl) {
      console.error('❌ Usage: node link-twitter-verify.mjs [JWT_TOKEN] TWEET_URL');
      console.error('Example: node link-twitter-verify.mjs "https://x.com/yourhandle/status/123456"');
      process.exit(1);
    }
    
    // If token was provided as second arg, swap them
    if (!jwtToken.startsWith('http') && tweetUrl.startsWith('http')) {
      // Correct order
    } else if (jwtToken.startsWith('http') && !tweetUrl.startsWith('http')) {
      // Swapped - fix it
      [jwtToken, tweetUrl] = [tweetUrl, jwtToken];
    }
    
    console.log('🔗 Verifying Twitter link...');
    console.log('📱 Tweet URL:', tweetUrl);
    console.log('');
    
    // ============================================
    // Submit tweet URL for verification
    // ============================================
    const verifyRes = await fetch(`${API_BASE}/agent-auth/twitter/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tweetUrl })
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyData.success) {
      console.error('❌ Verification failed:', verifyData.error);
      console.error('');
      console.error('💡 Troubleshooting:');
      console.error('   1. Check the tweet URL format: https://x.com/yourhandle/status/123456');
      console.error('   2. Ensure the tweet was posted from the intended account');
      console.error('   3. Make sure the tweet contains the verification code');
      console.error('   4. Check if the code expired (30 minute limit)');
      console.error('');
      process.exit(1);
    }
    
    // Success!
    const { agentId, twitterHandle, verifiedAt } = verifyData.data;
    
    console.log('✅ Twitter linked successfully!\n');
    console.log('🤖 Agent ID:', agentId);
    console.log('🐦 Twitter:', twitterHandle);
    console.log('✅ Verified:', new Date(verifiedAt).toLocaleString());
    console.log('');
    console.log('🎉 All done! The agent is now linked to', twitterHandle);
    console.log('');
    
    // Clean up saved token
    const fs = await import('fs');
    if (fs.existsSync('.twitter-link-token.json')) {
      fs.unlinkSync('.twitter-link-token.json');
      console.log('🧹 Cleaned up saved token');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyTwitter();
