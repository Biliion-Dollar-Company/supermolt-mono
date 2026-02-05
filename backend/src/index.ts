import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from 'bun';
import { Server as HTTPServer } from 'http';
import { env } from './lib/env';
import { PrismaClient } from '@prisma/client';
import { HeliusWebSocketMonitor } from './services/helius-websocket.js';
import { websocketEvents } from './services/websocket-events.js';
import { createLeaderboardAdvanced } from './routes/leaderboard-advanced.js';
import { createSortinoCron } from './services/sortino-cron.js';

// Routes
import { health } from './routes/health';
import { auth } from './routes/auth';
import { siwsAuthRoutes } from './routes/auth.siws';
import { agent } from './routes/agent';
import { trades } from './routes/trades';
import { archetypes } from './routes/archetypes';
import { internal } from './routes/internal';
import { webhooks } from './routes/webhooks';
import { feed } from './routes/feed';
import { copyTrade } from './routes/copy-trade';
import { ponzinomicsRoutes } from './routes/ponzinomics';
import { positions } from './routes/positions';
import { messaging } from './routes/messaging';
import { voting } from './routes/voting';
import { profile } from './routes/profile';

// USDC Hackathon Routes (Standardized Modules)
import treasury from './modules/treasury/treasury.routes';
import leaderboard from './modules/leaderboard/leaderboard.routes';
import epochs from './modules/epoch/epoch.routes';
import calls from './modules/scanner-calls/scanner-calls.routes';

const db = new PrismaClient();
const app = new Hono();

// CORS Configuration - Allow frontend origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  'exp://localhost:8081',
  'https://sr-mobile-production.up.railway.app',
];

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return origin;
      
      // Check if origin matches allowed origins
      for (const allowed of allowedOrigins) {
        if (allowed === origin) {
          return origin;
        }
      }
      
      // Allow all Vercel deployment URLs
      if (origin.match(/https:\/\/.*\.vercel\.app$/)) {
        return origin;
      }
      
      return origin; // Allow all for now, can be restricted later
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Helius-Signature'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 600,
  })
);

// Public routes
app.route('/health', health);
app.route('/archetypes', archetypes);
app.route('/webhooks', webhooks); // Helius webhooks (public, signature validated)
app.route('/ponzinomics', ponzinomicsRoutes); // Ponzinomics analytics & trading

// Auth routes
app.route('/auth', auth);
app.route('/auth', siwsAuthRoutes); // SIWS agent auth

// Protected routes (JWT required)
app.route('/agents', agent);
app.route('/trades', trades);

// Profile routes (GET is public, PUT requires auth)
app.route('/profiles', profile);
app.route('/feed', feed);
app.route('/feed/leaderboard-advanced', createLeaderboardAdvanced(db)); // Advanced ranking
app.route('/trades', copyTrade); // /trades/copy/* endpoints

// Agent Coordination routes
app.route('/positions', positions); // Position tracking
app.route('/messaging', messaging); // Agent messaging
app.route('/voting', voting); // Voting system

// Internal routes (API key required — DevPrint → SR-Mobile)
app.route('/internal', internal);

// USDC Hackathon API Routes (Public for hackathon demo)
app.route('/api/treasury', treasury);
app.route('/api/leaderboard', leaderboard);
app.route('/api/epochs', epochs);
app.route('/api/calls', calls);

// Root
app.get('/', (c) => {
  return c.json({
    name: 'SR-Mobile API',
    version: '0.3.0',
    docs: '/health',
    endpoints: {
      health: '/health',
      auth: '/auth/*',
      agents: '/agents/*',
      trades: '/trades/*',
      usdc: {
        treasury: '/api/treasury/*',
        leaderboard: '/api/leaderboard/*',
        epochs: '/api/epochs/*',
        calls: '/api/calls/*'
      }
    }
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});

// Global Helius monitor instance (exported for dynamic wallet management)
export let heliusMonitor: HeliusWebSocketMonitor | null = null;

// Start Helius WebSocket Monitor (real-time transaction tracking)
async function startHeliusMonitor() {
  const heliusApiKey = process.env.HELIUS_API_KEY;
  
  if (!heliusApiKey || heliusApiKey === 'your-helius-api-key') {
    console.warn('⚠️  HELIUS_API_KEY not configured, WebSocket monitor disabled');
    return;
  }

  // Tracked wallets for real-time monitoring (initial hardcoded wallets)
  const trackedWallets = [
    'DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy',
    '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
    '48BbwbZHWc8QJBiuGJTQZD5aWZdP3i6xrDw5N9EHpump'
  ];

  try {
    heliusMonitor = new HeliusWebSocketMonitor(heliusApiKey, trackedWallets, db);
    
    // Start in background
    heliusMonitor.start().catch((error) => {
      console.error('❌ Helius monitor failed to start:', error);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down...');
      if (heliusMonitor) {
        await heliusMonitor.stop();
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to initialize Helius monitor:', error);
  }
}

// Start server with Socket.IO support
const port = parseInt(env.PORT, 10);

console.log(`
  SR-Mobile API starting...
   Port: ${port}
   Environment: ${process.env.NODE_ENV || 'development'}
`);

// Create HTTP server using Node's http module for Socket.IO compatibility
import { createServer } from 'http';
import { Readable } from 'stream';

// Create a Node.js HTTP server that integrates with Hono
const server = createServer(async (req, res) => {
  try {
    // Build full URL
    const protocol = 'http'; // Railway handles HTTPS termination
    const host = req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url || '/'}`;
    
    // Read request body if present
    let bodyInit: BodyInit | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      if (chunks.length > 0) {
        bodyInit = Buffer.concat(chunks);
      }
    }
    
    // Create Fetch Request
    const request = new Request(url, {
      method: req.method || 'GET',
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])
      ),
      body: bodyInit,
    });

    // Process with Hono
    const response = await app.fetch(request);
    
    // Set status code
    res.statusCode = response.status;
    
    // Set headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Stream body
    if (response.body) {
      const reader = response.body.getReader();
      const readable = new Readable({
        async read() {
          try {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null);
            } else {
              this.push(value);
            }
          } catch (err) {
            this.destroy(err as Error);
          }
        }
      });
      readable.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Request handling error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

// Initialize Socket.IO with the HTTP server
console.log('🔌 Initializing Socket.IO WebSocket server...');
try {
  const io = websocketEvents.initialize(server);
  console.log('✅ Socket.IO initialized and ready');
} catch (error) {
  console.error('❌ Failed to initialize Socket.IO:', error);
  console.error('⚠️  Server will continue without WebSocket support');
}

// Start the server
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`   HTTP: http://0.0.0.0:${port}`);
  console.log(`   WebSocket: ws://0.0.0.0:${port}`);
  console.log(`   Socket.IO: ws://0.0.0.0:${port}/socket.io/`);
  console.log(`   Ready for connections`);
});

// Start WebSocket monitor in background
startHeliusMonitor();

// Start Sortino cron job (hourly recalculation)
const sortinoCron = createSortinoCron(db);
sortinoCron.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  sortinoCron.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  sortinoCron.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Note: Bun doesn't use the default export when server.listen() is called
// The server.listen() call takes precedence
