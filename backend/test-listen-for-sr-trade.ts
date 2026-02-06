/**
 * Listen for SR Token Trade Events
 * Monitor if Helius detected Henry's swap
 */

import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import io from 'socket.io-client';

const API_URL = 'https://sr-mobile-production.up.railway.app';
const WS_URL = 'https://sr-mobile-production.up.railway.app';

// Agent Beta (Observer)
const AGENT_BETA_KEY = Buffer.from(
  '2c6a23934df1d308ea5708af52da5d1570372a0f508f3471b3799314139f9784001a0afebb8ac9758dc62e2798ba6aee1160a037e51e02190e4ec58c6e169cea',
  'hex'
);

const HENRY_WALLET = '3N2dmcXyQ4wMcsX18CCcr3dxmDbmbrUwU2D3LCCrhSbA';
const EXPECTED_SIGNATURE = 'HErdYjAxQxANziGKRznQzsgCbHNuzcx2pfoHDWR3RYqwiFqxiB1R8ZAf9ASAE3X7WFqgupMNnVTipFMfAu3svDf';

async function authenticate(keypair: Keypair): Promise<string> {
  console.log('🔐 Authenticating Agent Beta...');
  
  const challengeRes = await fetch(`${API_URL}/auth/agent/challenge`, {
    method: 'GET',
  });

  const { nonce } = await challengeRes.json();
  const messageBytes = Buffer.from(nonce);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase64 = Buffer.from(signature).toString('base64');

  const verifyRes = await fetch(`${API_URL}/auth/agent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubkey: keypair.publicKey.toBase58(),
      signature: signatureBase64,
      nonce: nonce,
    }),
  });

  const { token } = await verifyRes.json();
  console.log('   ✓ Authenticated\n');
  
  return token;
}

async function listen() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         LISTENING FOR SR TOKEN TRADE (Henry\'s Swap)           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`Monitoring for: ${HENRY_WALLET}`);
  console.log(`Expected signature: ${EXPECTED_SIGNATURE.substring(0, 20)}...\n`);

  const betaKeypair = Keypair.fromSecretKey(AGENT_BETA_KEY);
  const betaJwt = await authenticate(betaKeypair);

  return new Promise((resolve) => {
    const socket = io(WS_URL, {
      auth: { token: betaJwt },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('📡 Connected to WebSocket');
      console.log(`   Socket ID: ${socket.id}\n`);
      
      // Subscribe to all events
      socket.emit('subscribe:agent', HENRY_WALLET);
      socket.emit('subscribe:leaderboard');
      
      console.log('🔔 Subscribed to events');
      console.log('⏳ Listening for trade events...\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    let eventCount = 0;

    socket.on('trade_detected', (data: any) => {
      eventCount++;
      console.log(`\n🔥 [${new Date().toLocaleTimeString()}] TRADE DETECTED #${eventCount}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      if (data.signature === EXPECTED_SIGNATURE) {
        console.log('✅ THIS IS HENRY\'S SR TOKEN PURCHASE!\n');
      }
    });

    socket.on('position_updated', (data: any) => {
      eventCount++;
      console.log(`\n📈 [${new Date().toLocaleTimeString()}] POSITION UPDATED #${eventCount}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('agent:activity', (data: any) => {
      eventCount++;
      console.log(`\n🎯 [${new Date().toLocaleTimeString()}] AGENT ACTIVITY #${eventCount}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('leaderboard:update', (data: any) => {
      eventCount++;
      console.log(`\n🏆 [${new Date().toLocaleTimeString()}] LEADERBOARD UPDATE #${eventCount}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Connection error:', err.message);
    });

    // Listen for 2 minutes
    setTimeout(() => {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`\n📊 SUMMARY: Received ${eventCount} events in 2 minutes\n`);
      
      if (eventCount === 0) {
        console.log('⚠️ No events received. Possible issues:');
        console.log('   - Helius webhook not configured for this wallet');
        console.log('   - Webhook not firing');
        console.log('   - Event broadcaster not connected\n');
      }
      
      socket.close();
      resolve(eventCount);
    }, 120000); // 2 minutes
  });
}

listen().catch(console.error);
