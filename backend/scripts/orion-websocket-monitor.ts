import { io } from 'socket.io-client';

const BACKEND_URL = 'https://sr-mobile-production.up.railway.app';

console.log('🔌 Orion WebSocket Monitor Starting...');
console.log('Connecting to:', BACKEND_URL);
console.log('');

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected to SuperMolt WebSocket!');
  console.log('Socket ID:', socket.id);
  console.log('');
  
  // Subscribe to all available feeds
  const feeds = ['godwallet', 'signals', 'market', 'watchlist', 'tokens', 'tweets'];
  
  feeds.forEach(feed => {
    socket.emit('subscribe:feed', feed);
    console.log(`📡 Subscribed to feed: ${feed}`);
  });
  
  console.log('');
  console.log('🎧 Listening for events...');
  console.log('----------------------------------------');
  console.log('');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

// Listen to all feed channels
['feed:godwallet', 'feed:signals', 'feed:market', 'feed:watchlist', 'feed:tokens', 'feed:tweets'].forEach(channel => {
  socket.on(channel, (data) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${channel}:`);
    console.log(JSON.stringify(data, null, 2));
    console.log('');
  });
});

// Keep the script running
console.log('Press Ctrl+C to stop monitoring...');
