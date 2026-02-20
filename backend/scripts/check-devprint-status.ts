/**
 * Check DevPrint API Status
 * Verifies DevPrint integration is working
 */

const DEVPRINT_BASE_URL = process.env.DEVPRINT_API_URL || 'https://devprint-v2-production.up.railway.app';

async function checkDevPrintStatus() {
  console.log('🔍 Checking DevPrint API Status...\n');
  console.log(`Base URL: ${DEVPRINT_BASE_URL}\n`);

  // Test 1: API Health
  try {
    console.log('1. Testing API health endpoint...');
    const healthRes = await fetch(`${DEVPRINT_BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (healthRes.ok) {
      const data = await healthRes.json();
      console.log('   ✅ API is healthy:', data);
    } else {
      console.log(`   ❌ API health check failed: ${healthRes.status} ${healthRes.statusText}`);
    }
  } catch (err: any) {
    console.log(`   ❌ API health check error: ${err.message}`);
  }

  // Test 2: Wallets endpoint (god wallets)
  try {
    console.log('\n2. Testing /api/wallets endpoint...');
    const walletsRes = await fetch(`${DEVPRINT_BASE_URL}/api/wallets`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (walletsRes.ok) {
      const data: any = await walletsRes.json();
      const wallets = Array.isArray(data) ? data : (data.data?.wallets ?? data.wallets ?? []);
      const godWallets = wallets.filter((w: any) => w.is_god_wallet || w.isGodWallet);
      
      console.log(`   ✅ Found ${wallets.length} total wallets`);
      console.log(`   ✅ Found ${godWallets.length} god wallets`);
      
      if (godWallets.length > 0) {
        console.log('\n   Sample god wallets:');
        godWallets.slice(0, 3).forEach((w: any) => {
          console.log(`   - ${w.address} ${w.label ? `(${w.label})` : ''}`);
        });
      }
    } else {
      console.log(`   ❌ Wallets endpoint failed: ${walletsRes.status} ${walletsRes.statusText}`);
    }
  } catch (err: any) {
    console.log(`   ❌ Wallets endpoint error: ${err.message}`);
  }

  // Test 3: Signals endpoint
  try {
    console.log('\n3. Testing /api/signals endpoint...');
    const signalsRes = await fetch(`${DEVPRINT_BASE_URL}/api/signals?limit=5`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (signalsRes.ok) {
      const data: any = await signalsRes.json();
      const signals = Array.isArray(data) ? data : (data.data?.signals ?? data.signals ?? []);
      
      console.log(`   ✅ Found ${signals.length} recent signals`);
      
      if (signals.length > 0) {
        const latestSignal = signals[0];
        console.log(`\n   Latest signal:`);
        console.log(`   - Type: ${latestSignal.type || latestSignal.signal_type || 'unknown'}`);
        console.log(`   - Token: ${latestSignal.token_symbol || latestSignal.tokenSymbol || 'unknown'}`);
        console.log(`   - Created: ${latestSignal.created_at || latestSignal.createdAt || 'unknown'}`);
      } else {
        console.log('   ⚠️  No signals found (feed may be stale)');
      }
    } else {
      console.log(`   ❌ Signals endpoint failed: ${signalsRes.status} ${signalsRes.statusText}`);
    }
  } catch (err: any) {
    console.log(`   ❌ Signals endpoint error: ${err.message}`);
  }

  // Test 4: Check recent agent messages
  console.log('\n4. Checking recent agent conversations...');
  try {
    const { db } = await import('../src/lib/db');
    
    const recentConversations = await db.agentConversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    console.log(`   ✅ Found ${recentConversations.length} recent conversations`);
    
    if (recentConversations.length > 0) {
      console.log('\n   Recent conversation activity:');
      for (const conv of recentConversations) {
        const lastMsg = conv.messages[0];
        const age = lastMsg ? Math.floor((Date.now() - lastMsg.timestamp.getTime()) / 1000 / 60) : 999;
        console.log(`   - ${conv.topic} (${age}min ago)`);
        if (lastMsg) {
          console.log(`     "${lastMsg.message.substring(0, 60)}..."`);
        }
      }
    } else {
      console.log('   ⚠️  No conversations found');
    }
  } catch (err: any) {
    console.log(`   ❌ Database query error: ${err.message}`);
  }

  console.log('\n✅ DevPrint status check complete\n');
  process.exit(0);
}

checkDevPrintStatus();
