/**
 * Live Trade Observer Test
 * 
 * Agent Alpha (funded): Executes a real swap
 * Agent Beta (observer): Watches and receives real-time updates
 * 
 * Tests:
 * - Real-time WebSocket events
 * - Cross-agent position visibility
 * - Chat/messaging between agents
 * - Position tracking after real swaps
 */

import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import nacl from 'tweetnacl';
import io from 'socket.io-client';

const API_URL = 'https://sr-mobile-production.up.railway.app';
const WS_URL = 'https://sr-mobile-production.up.railway.app';
const RPC_URL = 'https://api.mainnet-beta.solana.com'; // MAINNET - REAL DEAL

// Agent Alpha (FUNDED TRADER - MAINNET) - 0.115 SOL confirmed
const AGENT_ALPHA_KEY = Buffer.from(
  '101f3878c5e29150a44a10c73508eb05624b084b6b6615a150f94d9c38fc15e9231a6b1983aa11eea8c482d4e441f29ca4e549df044f71c85a89a0a27a2976b1',
  'hex'
);

// Agent Beta (OBSERVER - MAINNET)
const AGENT_BETA_KEY = Buffer.from(
  '2c6a23934df1d308ea5708af52da5d1570372a0f508f3471b3799314139f9784001a0afebb8ac9758dc62e2798ba6aee1160a037e51e02190e4ec58c6e169cea',
  'hex'
);

// Real mainnet token - using BONK as example (popular meme coin)
const TEST_TOKEN = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK on mainnet

interface AgentSession {
  name: string;
  keypair: Keypair;
  jwt: string;
  socket: any;
  eventsReceived: any[];
}

/**
 * Authenticate agent via SIWS
 */
async function authenticate(keypair: Keypair, name: string): Promise<string> {
  console.log(`\n🔐 Authenticating ${name}...`);
  
  const publicKey = keypair.publicKey.toBase58();
  
  // Get challenge
  const challengeRes = await fetch(`${API_URL}/auth/agent/challenge`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!challengeRes.ok) {
    throw new Error(`Challenge failed: ${await challengeRes.text()}`);
  }

  const { nonce } = await challengeRes.json();
  console.log(`   ✓ Nonce: ${nonce.substring(0, 16)}...`);

  // Sign nonce
  const messageBytes = Buffer.from(nonce);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase64 = Buffer.from(signature).toString('base64');

  // Verify
  const verifyRes = await fetch(`${API_URL}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey: publicKey,
      signature: signatureBase64,
      nonce: nonce,
    }),
  });

  if (!verifyRes.ok) {
    throw new Error(`Verification failed: ${await verifyRes.text()}`);
  }

  const { token } = await verifyRes.json();
  console.log(`   ✓ Authenticated (JWT: ${token.substring(0, 20)}...)`);
  
  return token;
}

/**
 * Connect WebSocket
 */
function connectWebSocket(name: string, jwt: string): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`\n📡 Connecting ${name} to WebSocket...`);
    
    const socket = io(WS_URL, {
      auth: { token: jwt },
      transports: ['websocket'],
      reconnection: true,
    });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Connection timeout'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`   ✓ Connected (socket.id: ${socket.id})`);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err.message}`));
    });
  });
}

/**
 * Subscribe to token updates
 */
function subscribeToToken(session: AgentSession, tokenMint: string) {
  console.log(`\n🔔 ${session.name} subscribing to token ${tokenMint.substring(0, 8)}...`);
  
  session.socket.emit('subscribe_token', { tokenMint });
  session.socket.emit('subscribe:agent', session.keypair.publicKey.toBase58());
  session.socket.emit('subscribe:leaderboard');
  
  // Listen for all event types
  session.socket.on('trade_detected', (data: any) => {
    console.log(`\n   🔥 ${session.name} received TRADE_DETECTED:`, {
      agent: data.agentPubkey?.substring(0, 8) || 'unknown',
      token: data.tokenMint?.substring(0, 8) || 'unknown',
      type: data.type,
      amount: data.amount,
      signature: data.signature?.substring(0, 8),
      timestamp: new Date(data.timestamp).toLocaleTimeString(),
    });
    session.eventsReceived.push({ type: 'trade_detected', data, timestamp: Date.now() });
  });

  session.socket.on('position_updated', (data: any) => {
    console.log(`\n   📈 ${session.name} received POSITION_UPDATED:`, {
      agent: data.agentPubkey?.substring(0, 8),
      token: data.tokenMint?.substring(0, 8),
      pnl: data.pnl,
      change: data.change,
    });
    session.eventsReceived.push({ type: 'position_updated', data, timestamp: Date.now() });
  });

  session.socket.on('agent:activity', (data: any) => {
    console.log(`\n   🎯 ${session.name} received AGENT_ACTIVITY:`, {
      agentId: data.agentId?.substring(0, 8),
      action: data.action,
    });
    session.eventsReceived.push({ type: 'agent:activity', data, timestamp: Date.now() });
  });

  session.socket.on('leaderboard:update', (data: any) => {
    console.log(`\n   🏆 ${session.name} received LEADERBOARD_UPDATE:`, {
      agentId: data.agentId?.substring(0, 8),
      rank: data.rank,
      sortino: data.sortino,
    });
    session.eventsReceived.push({ type: 'leaderboard:update', data, timestamp: Date.now() });
  });

  console.log(`   ✓ Subscribed to events`);
}

/**
 * Execute a real swap (simple SOL transfer for testing)
 */
async function executeTestSwap(keypair: Keypair): Promise<string> {
  console.log(`\n💰 Executing test transaction from ${keypair.publicKey.toBase58().substring(0, 8)}...`);
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  if (balance < 0.001 * LAMPORTS_PER_SOL) {
    throw new Error('Insufficient balance for test transaction');
  }
  
  // Create a simple transfer (simulates a swap)
  const toAddress = new PublicKey('11111111111111111111111111111111');
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: toAddress,
      lamports: 0.0001 * LAMPORTS_PER_SOL, // 0.0001 SOL
    })
  );
  
  // Send transaction
  const signature = await connection.sendTransaction(transaction, [keypair]);
  console.log(`   ✓ Transaction sent: ${signature}`);
  console.log(`   ⏳ Waiting for confirmation...`);
  
  await connection.confirmTransaction(signature, 'confirmed');
  console.log(`   ✅ Transaction confirmed!`);
  console.log(`   🔗 https://explorer.solana.com/tx/${signature}`);
  
  return signature;
}

/**
 * Check positions for both agents
 */
async function checkPositions(alphaJwt: string, betaJwt: string, alphaPubkey: string, betaPubkey: string) {
  console.log(`\n📊 Checking positions...`);
  
  // Alpha's positions
  const alphaRes = await fetch(`${API_URL}/positions/agent/${alphaPubkey}`, {
    headers: { 'Authorization': `Bearer ${alphaJwt}` },
  });
  
  if (alphaRes.ok) {
    const positions = await alphaRes.json();
    console.log(`   Agent Alpha positions: ${positions.length} found`);
    if (positions.length > 0) {
      console.log(`   `, positions[0]);
    }
  } else {
    console.log(`   Agent Alpha: ${alphaRes.status} (${await alphaRes.text()})`);
  }
  
  // Beta's visibility of Alpha's positions
  const visibilityRes = await fetch(`${API_URL}/positions/agent/${alphaPubkey}`, {
    headers: { 'Authorization': `Bearer ${betaJwt}` },
  });
  
  if (visibilityRes.ok) {
    const positions = await visibilityRes.json();
    console.log(`   Agent Beta can see Alpha's positions: ${positions.length} visible`);
  } else {
    console.log(`   Agent Beta visibility: ${visibilityRes.status}`);
  }
}

/**
 * Test messaging between agents
 */
async function testMessaging(alphaJwt: string, betaJwt: string, tokenMint: string) {
  console.log(`\n💬 Testing cross-agent messaging...`);
  
  // Agent Beta sends a message about the token
  const messageRes = await fetch(`${API_URL}/messaging/conversations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${betaJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokenMint: tokenMint,
      message: 'I saw your trade on this token! Looks interesting.',
    }),
  });
  
  if (messageRes.ok) {
    const conversation = await messageRes.json();
    console.log(`   ✓ Message sent (conversation ID: ${conversation.id})`);
  } else {
    console.log(`   ⚠️ Messaging: ${messageRes.status} - ${await messageRes.text()}`);
  }
}

/**
 * Main test
 */
async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     LIVE TRADE OBSERVER TEST - Real Blockchain Activity       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const alphaKeypair = Keypair.fromSecretKey(AGENT_ALPHA_KEY);
  const betaKeypair = Keypair.fromSecretKey(AGENT_BETA_KEY);
  
  console.log(`Agent Alpha (TRADER): ${alphaKeypair.publicKey.toBase58()}`);
  console.log(`Agent Beta (OBSERVER): ${betaKeypair.publicKey.toBase58()}`);

  const sessions: AgentSession[] = [];

  try {
    // Step 1: Authenticate both agents
    console.log('\n━━━ STEP 1: Authentication ━━━');
    const alphaJwt = await authenticate(alphaKeypair, 'Agent Alpha');
    const betaJwt = await authenticate(betaKeypair, 'Agent Beta');

    // Step 2: Connect WebSockets
    console.log('\n━━━ STEP 2: WebSocket Connections ━━━');
    const alphaSocket = await connectWebSocket('Agent Alpha', alphaJwt);
    const betaSocket = await connectWebSocket('Agent Beta', betaJwt);

    sessions.push({
      name: 'Agent Alpha',
      keypair: alphaKeypair,
      jwt: alphaJwt,
      socket: alphaSocket,
      eventsReceived: [],
    });

    sessions.push({
      name: 'Agent Beta',
      keypair: betaKeypair,
      jwt: betaJwt,
      socket: betaSocket,
      eventsReceived: [],
    });

    // Step 3: Subscribe to token
    console.log('\n━━━ STEP 3: Event Subscriptions ━━━');
    subscribeToToken(sessions[0], TEST_TOKEN);
    subscribeToToken(sessions[1], TEST_TOKEN);

    // Step 4: Execute real swap
    console.log('\n━━━ STEP 4: Execute Real Swap ━━━');
    const signature = await executeTestSwap(alphaKeypair);

    // Step 5: Wait for Helius webhook to detect and broadcast
    console.log('\n━━━ STEP 5: Waiting for Webhook Detection ━━━');
    console.log('   ⏳ Waiting 15 seconds for Helius webhook → backend → WebSocket flow...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Step 6: Check positions
    console.log('\n━━━ STEP 6: Position Tracking ━━━');
    await checkPositions(
      alphaJwt,
      betaJwt,
      alphaKeypair.publicKey.toBase58(),
      betaKeypair.publicKey.toBase58()
    );

    // Step 7: Test messaging
    console.log('\n━━━ STEP 7: Cross-Agent Messaging ━━━');
    await testMessaging(alphaJwt, betaJwt, TEST_TOKEN);

    // Step 8: Final event check
    console.log('\n━━━ STEP 8: Event Summary ━━━');
    console.log(`\n   Agent Alpha received: ${sessions[0].eventsReceived.length} events`);
    console.log(`   Agent Beta received: ${sessions[1].eventsReceived.length} events`);
    
    const betaReceivedAlphaEvents = sessions[1].eventsReceived.filter(e => 
      e.data.agentPubkey === alphaKeypair.publicKey.toBase58() ||
      e.data.signature === signature
    );
    
    console.log(`   Agent Beta received events about Alpha: ${betaReceivedAlphaEvents.length}`);
    
    if (betaReceivedAlphaEvents.length > 0) {
      console.log('\n   ✅ SUCCESS! Cross-agent real-time events working!');
      console.log('\n   Events received by Beta about Alpha:');
      betaReceivedAlphaEvents.forEach(e => {
        console.log(`      - ${e.type} (${new Date(e.timestamp).toLocaleTimeString()})`);
      });
    } else {
      console.log('\n   ⚠️ No events detected yet. Helius webhook may still be processing...');
    }

    // Keep listening for late events
    console.log('\n   ⏳ Keeping connections open for 10 more seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Final summary
    console.log('\n━━━ FINAL RESULTS ━━━');
    console.log(`   Agent Alpha: ${sessions[0].eventsReceived.length} events`);
    console.log(`   Agent Beta: ${sessions[1].eventsReceived.length} events`);
    console.log(`   Transaction: ${signature}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n━━━ Cleanup ━━━');
    for (const session of sessions) {
      if (session.socket) {
        session.socket.close();
        console.log(`   ✓ ${session.name} disconnected`);
      }
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST COMPLETE                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

// Run
runTest().catch(console.error);
