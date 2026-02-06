#!/usr/bin/env bun
/**
 * Test if observer message fix is deployed
 * Check the code in production by making a request
 */

console.log('🔍 Testing if observer fix is deployed...\n');

// Check 1: Health endpoint (should be up)
console.log('1️⃣ Checking health endpoint...');
const healthRes = await fetch('https://sr-mobile-production.up.railway.app/health');
const health = await healthRes.json();
console.log(`   Status: ${health.success ? '✅' : '❌'}`);
console.log(`   Timestamp: ${health.data.timestamp}\n`);

// Check 2: Recent conversations (should have messages soon)
console.log('2️⃣ Checking recent conversations...');
const convsRes = await fetch('https://sr-mobile-production.up.railway.app/messaging/conversations?limit=5');
const convs = await convsRes.json();

if (convs.success && convs.data.conversations.length > 0) {
  console.log(`   Found ${convs.data.conversations.length} conversations:`);
  
  for (const conv of convs.data.conversations) {
    console.log(`\n   📝 ${conv.topic}`);
    console.log(`      ID: ${conv.id}`);
    console.log(`      Messages: ${conv.messageCount}`);
    console.log(`      Last Message: ${conv.lastMessage || 'None'}`);
    console.log(`      Created: ${new Date(conv.createdAt).toLocaleTimeString()}`);
    
    // Check messages for this conversation
    if (conv.messageCount > 0) {
      const msgsRes = await fetch(`https://sr-mobile-production.up.railway.app/messaging/conversations/${conv.id}/messages`);
      const msgs = await msgsRes.json();
      
      if (msgs.success && msgs.data.messages.length > 0) {
        console.log(`      💬 Messages (${msgs.data.messages.length}):`);
        for (const msg of msgs.data.messages.slice(0, 3)) {
          const preview = msg.message.slice(0, 60);
          console.log(`         - ${preview}${msg.message.length > 60 ? '...' : ''}`);
        }
      }
    }
  }
} else {
  console.log('   No conversations found yet');
}

// Check 3: Status summary
console.log('\n📊 Summary:');
if (convs.data?.conversations.some((c: any) => c.messageCount > 0)) {
  console.log('   ✅ Fix is DEPLOYED - Messages are being created!');
} else {
  console.log('   ⏳ Fix may not be deployed yet OR no new SR trades since fix');
  console.log('   💡 Trigger a test SR trade or wait for natural webhook');
}

process.exit(0);
