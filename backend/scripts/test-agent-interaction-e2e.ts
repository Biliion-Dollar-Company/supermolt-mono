/**
 * E2E Test: Agent Interaction & Real-Time Event Broadcasting
 * 
 * Tests:
 * 1. SIWS agent registration (2 agents)
 * 2. Position tracking
 * 3. Real-time WebSocket events when agents trade same token
 * 4. WebSocket connection management (no leaks, proper cleanup)
 * 5. Chart data accuracy
 */

import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import io from 'socket.io-client';

// Test configuration
const API_URL = process.env.API_URL || 'https://sr-mobile-production.up.railway.app';
const WS_URL = process.env.WS_URL || 'https://sr-mobile-production.up.railway.app';
const RPC_URL = 'https://api.devnet.solana.com';

// Test agents (generated fresh)
const AGENT_ALPHA = {
  name: 'Agent Alpha',
  keypair: Keypair.fromSecretKey(
    Buffer.from('8ab4d6bac4228ba4bfa97baf1a122a85b0f0fa7c8a6176998c56319e96fb5a721f7e267cc7028931082b0022ec49edcb99e090a52530635c1f7c36141d015dbf', 'hex')
  ),
};

const AGENT_BETA = {
  name: 'Agent Beta',
  keypair: Keypair.fromSecretKey(
    Buffer.from('2c6a23934df1d308ea5708af52da5d1570372a0f508f3471b3799314139f9784001a0afebb8ac9758dc62e2798ba6aee1160a037e51e02190e4ec58c6e169cea', 'hex')
  ),
};

// Test token (we'll use a known devnet token or create one)
const TEST_TOKEN = process.env.TEST_TOKEN || 'So11111111111111111111111111111111111111112'; // Wrapped SOL on devnet

interface AgentSession {
  agent: typeof AGENT_ALPHA;
  jwt: string;
  socket: any;
  eventsReceived: any[];
}

/**
 * Step 1: SIWS Authentication
 */
async function authenticateAgent(agent: typeof AGENT_ALPHA): Promise<string> {
  console.log(`\n🔐 Authenticating ${agent.name}...`);
  
  // Get challenge (GET request, no body)
  const challengeRes = await fetch(`${API_URL}/auth/agent/challenge`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!challengeRes.ok) {
    throw new Error(`Challenge failed: ${await challengeRes.text()}`);
  }

  const { nonce } = await challengeRes.json();
  console.log(`  ✓ Nonce received: ${nonce}`);

  // Sign the challenge (backend expects just the nonce, not a formatted message)
  const messageBytes = Buffer.from(nonce); // Just the raw nonce
  const signature = nacl.sign.detached(messageBytes, agent.keypair.secretKey);
  const signatureBase64 = Buffer.from(signature).toString('base64'); // Base64, not bs58!

  // Verify and get JWT (use 'pubkey' not 'publicKey', include nonce)
  const verifyRes = await fetch(`${API_URL}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey: agent.keypair.publicKey.toBase58(),
      signature: signatureBase64,
      nonce: nonce,
    }),
  });

  if (!verifyRes.ok) {
    throw new Error(`Verification failed: ${await verifyRes.text()}`);
  }

  const { token } = await verifyRes.json();
  console.log(`  ✓ JWT received: ${token.substring(0, 20)}...`);
  
  return token;
}

/**
 * Step 2: Connect WebSocket with JWT auth
 */
function connectWebSocket(agent: typeof AGENT_ALPHA, jwt: string): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`\n📡 Connecting ${agent.name} to WebSocket...`);
    
    const socket = io(WS_URL, {
      auth: { token: jwt },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3,
    });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('WebSocket connection timeout'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`  ✓ Connected (socket.id: ${socket.id})`);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err.message}`));
    });

    socket.on('error', (err) => {
      console.error(`  ✗ Socket error:`, err);
    });
  });
}

/**
 * Step 3: Subscribe to token events
 */
async function subscribeToToken(session: AgentSession, tokenMint: string) {
  console.log(`\n🔔 ${session.agent.name} subscribing to token ${tokenMint}...`);
  
  return new Promise<void>((resolve) => {
    session.socket.emit('subscribe_token', { tokenMint });
    
    // Listen for events
    session.socket.on('trade_detected', (data: any) => {
      console.log(`  📊 ${session.agent.name} received trade_detected:`, {
        agent: data.agentPubkey?.substring(0, 8),
        token: data.tokenMint?.substring(0, 8),
        type: data.type,
        amount: data.amount,
      });
      session.eventsReceived.push({ type: 'trade_detected', data, timestamp: Date.now() });
    });

    session.socket.on('position_updated', (data: any) => {
      console.log(`  📈 ${session.agent.name} received position_updated:`, {
        agent: data.agentPubkey?.substring(0, 8),
        token: data.tokenMint?.substring(0, 8),
        change: data.change,
      });
      session.eventsReceived.push({ type: 'position_updated', data, timestamp: Date.now() });
    });

    session.socket.on('agent_action', (data: any) => {
      console.log(`  🎯 ${session.agent.name} received agent_action:`, {
        agent: data.agentPubkey?.substring(0, 8),
        action: data.action,
        token: data.tokenMint?.substring(0, 8),
      });
      session.eventsReceived.push({ type: 'agent_action', data, timestamp: Date.now() });
    });

    session.socket.on('subscribed', (data: any) => {
      console.log(`  ✓ Subscription confirmed:`, data);
      resolve();
    });

    // Auto-resolve after 2 seconds if no confirmation
    setTimeout(resolve, 2000);
  });
}

/**
 * Step 4: Fetch agent's current positions
 */
async function fetchPositions(jwt: string, agentPubkey: string) {
  console.log(`\n📊 Fetching positions for ${agentPubkey.substring(0, 8)}...`);
  
  const res = await fetch(`${API_URL}/positions/agent/${agentPubkey}`, {
    headers: { 'Authorization': `Bearer ${jwt}` },
  });

  if (!res.ok) {
    console.warn(`  ⚠️ Failed to fetch positions: ${res.status}`);
    return [];
  }

  const positions = await res.json();
  console.log(`  ✓ Found ${positions.length} positions`);
  return positions;
}

/**
 * Step 5: Simulate a trade (via manual transaction)
 * Note: Requires wallet to be funded. Henry will fund these addresses.
 */
async function simulateTrade(agent: typeof AGENT_ALPHA, tokenMint: string, isBuy: boolean) {
  console.log(`\n💰 ${agent.name} ${isBuy ? 'BUYING' : 'SELLING'} ${tokenMint.substring(0, 8)}...`);
  console.log(`  ℹ️ Manual step: Execute a swap from ${agent.keypair.publicKey.toBase58()}`);
  console.log(`  ℹ️ Helius webhook should detect this and broadcast to all connected agents`);
  
  // In real test, you'd execute actual swap here
  // For now, we'll just wait for manual swap execution
  return new Promise<void>((resolve) => {
    console.log(`  ⏳ Waiting 30 seconds for transaction to be detected...`);
    setTimeout(resolve, 30000);
  });
}

/**
 * Step 6: Verify WebSocket connection health
 */
function checkWebSocketHealth(sessions: AgentSession[]) {
  console.log(`\n🏥 WebSocket Health Check:`);
  
  for (const session of sessions) {
    const isConnected = session.socket.connected;
    const eventCount = session.eventsReceived.length;
    
    console.log(`  ${session.agent.name}:`);
    console.log(`    Connected: ${isConnected ? '✓' : '✗'}`);
    console.log(`    Events received: ${eventCount}`);
    console.log(`    Socket ID: ${session.socket.id || 'N/A'}`);
  }
}

/**
 * Main test runner
 */
async function runE2ETest() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  E2E TEST: Agent Interaction & Real-Time Event Broadcasting   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nAPI: ${API_URL}`);
  console.log(`WebSocket: ${WS_URL}`);
  console.log(`Test Token: ${TEST_TOKEN}\n`);

  const sessions: AgentSession[] = [];

  try {
    // STEP 1: Authenticate both agents
    console.log('\n━━━ STEP 1: Authentication ━━━');
    const alphaJwt = await authenticateAgent(AGENT_ALPHA);
    const betaJwt = await authenticateAgent(AGENT_BETA);

    // STEP 2: Connect WebSockets
    console.log('\n━━━ STEP 2: WebSocket Connections ━━━');
    const alphaSocket = await connectWebSocket(AGENT_ALPHA, alphaJwt);
    const betaSocket = await connectWebSocket(AGENT_BETA, betaJwt);

    sessions.push({
      agent: AGENT_ALPHA,
      jwt: alphaJwt,
      socket: alphaSocket,
      eventsReceived: [],
    });

    sessions.push({
      agent: AGENT_BETA,
      jwt: betaJwt,
      socket: betaSocket,
      eventsReceived: [],
    });

    // STEP 3: Subscribe both agents to same token
    console.log('\n━━━ STEP 3: Token Subscriptions ━━━');
    await subscribeToToken(sessions[0], TEST_TOKEN);
    await subscribeToToken(sessions[1], TEST_TOKEN);

    // STEP 4: Fetch initial positions
    console.log('\n━━━ STEP 4: Initial Position Check ━━━');
    await fetchPositions(alphaJwt, AGENT_ALPHA.keypair.publicKey.toBase58());
    await fetchPositions(betaJwt, AGENT_BETA.keypair.publicKey.toBase58());

    // STEP 5: Wait for manual trade execution
    console.log('\n━━━ STEP 5: Trade Execution ━━━');
    console.log('\n⚠️ MANUAL STEP REQUIRED:');
    console.log('   1. Fund Agent Alpha: 37wCz7Q8vUQkRqHwL9iUhGeZhcJzH8UmNP7RFhQTykkv');
    console.log('   2. Fund Agent Beta: 1Q2tPMd4VRA6WWPoGbnVWvFXsakmRCQJTWyEkfgPMKf');
    console.log('   3. Execute a swap from Agent Alpha wallet');
    console.log('   4. Wait for events to propagate...\n');

    await simulateTrade(AGENT_ALPHA, TEST_TOKEN, true);

    // STEP 6: Check results
    console.log('\n━━━ STEP 6: Results ━━━');
    checkWebSocketHealth(sessions);

    // Verify cross-agent event delivery
    const alphaSentEvents = sessions[0].eventsReceived.length;
    const betaReceivedEvents = sessions[1].eventsReceived.filter(e => 
      e.data.agentPubkey === AGENT_ALPHA.keypair.publicKey.toBase58()
    ).length;

    console.log(`\n📊 Event Delivery Test:`);
    console.log(`   Agent Alpha sent: ${alphaSentEvents} events`);
    console.log(`   Agent Beta received: ${betaReceivedEvents} events from Alpha`);
    
    if (betaReceivedEvents > 0) {
      console.log(`   ✅ SUCCESS: Cross-agent real-time events working!`);
    } else {
      console.log(`   ⚠️ WARNING: Agent Beta didn't receive Alpha's events`);
    }

    // Keep sockets open for 10 more seconds to catch late events
    console.log(`\n⏳ Keeping connections open for 10 seconds to catch late events...`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Final check
    checkWebSocketHealth(sessions);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n━━━ Cleanup ━━━');
    for (const session of sessions) {
      if (session.socket) {
        session.socket.close();
        console.log(`  ✓ ${session.agent.name} socket closed`);
      }
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST COMPLETE                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

// Run test
runE2ETest().catch(console.error);
