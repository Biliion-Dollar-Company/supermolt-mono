import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from 'bun';
import { Server as HTTPServer } from 'http';
import { env } from './lib/env';
import { db } from './lib/db';
import { HeliusWebSocketMonitor } from './services/helius-websocket.js';
import { websocketEvents } from './services/websocket-events.js';
import { DevPrintFeedService } from './services/devprint-feed.service.js';
import { createBSCMonitor } from './services/bsc-monitor.js';
import { createBaseMonitor } from './services/base-monitor.js';
import { createFourMemeMonitor } from './services/fourmeme-monitor.js';
import { createClankerMonitor } from './services/clanker-monitor.js';

import { createSortinoCron } from './services/sortino-cron.js';
import { createPredictionCron } from './services/prediction-cron.js';
import { createMetricsMiddleware, getMetrics, getMetricsContentType, updateAgentMetrics, updateEpochMetrics } from './services/metrics.service.js';
import { DistributedLockService, getReplicaId } from './services/distributed-lock.service.js';

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
import { agentAuth } from './routes/agent-auth.routes';
import { skills } from './routes/skills';
import { skillsGuide } from './routes/skills-guide';
import { docsRoutes } from './routes/docs';
import { swaggerRoutes } from './routes/swagger';
import { siweAuthRoutes } from './routes/auth.siwe';
import { bscRoutes } from './routes/bsc.routes';
import { baseRoutes } from './routes/base.routes';
import { surgeRoutes } from './routes/surge.routes';
import { pumpfunRoutes } from './routes/pumpfun.routes';
import { predictionRoutes } from './routes/prediction.routes';
import { trading } from './routes/trading.routes';
import { erc8004Routes } from './routes/erc8004.routes';
import { startAutoBuyExecutor, stopAutoBuyExecutor } from './services/auto-buy-executor';
import { getScannerScheduler } from './scanners/scheduler';

// TEMPORARY: Admin fix for Epic Reward scanner
import adminFix from './routes/admin-scanner-fix';

// USDC Hackathon Routes (Standardized Modules)
import treasuryModule from './modules/treasury/treasury.routes';
import leaderboard from './modules/leaderboard/leaderboard.routes';
import epochs from './modules/epoch/epoch.routes';
import calls from './modules/scanner-calls/scanner-calls.routes';
import arenaRoutes from './modules/arena/arena.routes';
import arenaMeRoutes from './routes/arena-me.routes';
import agentConfigRoutes from './routes/agent-config.routes';
import taskRoutes from './modules/tasks/tasks.routes';
import newsRoutes from './modules/news/news.routes';
import { systemRoutes, setDevPrintFeedGetter } from './routes/system.routes';
import notificationRoutes from './routes/notifications.routes';

const app = new Hono();

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return raw.toLowerCase() === 'true';
}

// Global Helius monitor instance (for dynamic wallet management)
let heliusMonitor: HeliusWebSocketMonitor | null = null;

// DevPrint feed service (market intelligence relay)
let devprintFeed: DevPrintFeedService | null = null;

// Export function to get monitor instance
export function getHeliusMonitor(): HeliusWebSocketMonitor | null {
  return heliusMonitor;
}

// Export function to get DevPrint feed instance
export function getDevPrintFeed(): DevPrintFeedService | null {
  return devprintFeed;
}

// CORS Configuration - Allow frontend origins
// Extra origins can be added via ALLOWED_ORIGINS env var (comma-separated)
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  'exp://localhost:8081',
  'https://sr-mobile-production.up.railway.app',
  'https://supermolt.xyz',
  'https://www.supermolt.xyz',
  'https://supermolt.app',
  'https://www.supermolt.app',
];
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [...defaultOrigins, ...extraOrigins];

// Middleware
app.use('*', logger());
app.use('*', createMetricsMiddleware()); // Prometheus metrics tracking
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

      // Allow all Vercel deployment URLs (preview deployments)
      if (origin.match(/https:\/\/.*\.vercel\.app$/)) {
        return origin;
      }

      // Reject unknown origins in production
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return null;
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

// Prometheus metrics endpoint
app.get('/metrics', async (c) => {
  const metrics = await getMetrics();
  return c.text(metrics, 200, {
    'Content-Type': getMetricsContentType(),
  });
});

app.route('/archetypes', archetypes);
app.route('/webhooks', webhooks); // Helius webhooks (public, signature validated)
app.route('/admin-fix', adminFix); // TEMPORARY: Fix Epic Reward scanner
app.route('/ponzinomics', ponzinomicsRoutes); // Ponzinomics analytics & trading
// Agent onboarding (THE ONE COMMAND)
app.route('/skills', skillsGuide); // Quickstart guide at /skills

// Agent resources
app.route('/skills/pack', skills); // JSON skill pack at /skills/pack
app.route('/docs', docsRoutes); // Full documentation at /docs/*
app.route('/swagger', swaggerRoutes); // Swagger UI at /swagger

// Legacy alias
app.get('/skill.md', (c) => {
  return c.redirect('/skills', 301);
});

// Auth routes
app.route('/auth', auth);
app.route('/auth', siwsAuthRoutes); // SIWS agent auth (Solana)
app.route('/auth', siweAuthRoutes); // SIWE agent auth (BSC/EVM)

// Protected routes (JWT required)
app.route('/agents', agent);
app.route('/trades', trades);

// Profile routes (GET is public, PUT requires auth)
app.route('/profiles', profile);
app.route('/feed', feed);

app.route('/trades', copyTrade); // /trades/copy/* endpoints

// Agent Coordination routes
app.route('/positions', positions); // Position tracking
app.route('/messaging', messaging); // Agent messaging
app.route('/voting', voting); // Voting system
app.route('/agent-auth', agentAuth); // Twitter auth + task verification

// Trading routes (Agent trade execution via Jupiter)
app.route('/trading', trading);

// Treasury routes (USDC reward distribution)
app.route('/treasury', treasuryModule); // Treasury management and USDC distribution

// Internal routes (API key required — DevPrint → SR-Mobile)
app.route('/internal', internal);

// USDC Hackathon API Routes (Public for hackathon demo)
app.route('/api/treasury', treasuryModule);
app.route('/api/leaderboard', leaderboard);
app.route('/api/epochs', epochs);
app.route('/api/calls', calls);

// BSC routes (token factory, treasury, monitoring)
app.route('/bsc', bscRoutes);

// Base chain routes (Clanker token deployer, trade monitor)
app.route('/base', baseRoutes);

// ERC-8004 routes (Agent Identity, Reputation, Validation)
app.route('/erc8004', erc8004Routes);

// Base chain routes (Surge OpenClaw API — managed wallets, trading, treasury)
app.route('/surge', surgeRoutes);

// Solana routes (pump.fun token launcher)
app.route('/pumpfun', pumpfunRoutes);

// Prediction market routes (Kalshi + future platforms)
app.route('/prediction', predictionRoutes);

// Arena routes (public, frontend arena page)
app.route('/arena', arenaMeRoutes); // /arena/me — must be before generic arena routes
app.route('/arena/me', agentConfigRoutes); // Agent configuration endpoints
app.route('/arena', arenaRoutes);
app.route('/arena/tasks', taskRoutes);

// Push notification routes
app.route('/notifications', notificationRoutes);

// News routes (platform announcements, updates, partnerships)
app.route('/news', newsRoutes);

// System routes (pipeline status, agent config)
app.route('/api/system', systemRoutes);

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
      },
      bsc: {
        auth: '/auth/evm/*',
        tokens: '/bsc/tokens/*',
        factory: '/bsc/factory/info',
        treasury: '/bsc/treasury/*',
      },
      base: {
        tokens: '/base/tokens/*',
        monitor: '/base/monitor/status',
        wallet: '/surge/wallet/*',
        trading: '/surge/buy, /surge/sell, /surge/quote',
        treasury: '/surge/treasury/*',
        history: '/surge/history/*',
      },
      prediction: '/prediction/*'
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

    // Load user-defined tracked wallets from DB into monitor
    try {
      const userWallets = await db.trackedWallet.findMany({
        where: { chain: 'SOLANA' },
        select: { address: true },
      });
      let added = 0;
      for (const w of userWallets) {
        if (!trackedWallets.includes(w.address)) {
          heliusMonitor.addWallet(w.address);
          added++;
        }
      }
      if (added > 0) {
        console.log(`✅ Loaded ${added} user-tracked Solana wallets from DB`);
      }
    } catch (err) {
      console.warn('⚠️  Failed to load tracked wallets from DB:', err);
    }

    console.log('✅ Helius monitor instance saved globally (dynamic wallet support enabled)');

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

// Ensure observer agents exist in DB (idempotent, safe to run every startup)
import('./services/agent-signal-reactor.js').then(({ ensureObserverAgents }) => {
  ensureObserverAgents().catch((err) =>
    console.error('❌ Failed to seed observer agents:', err),
  );
});

// Start DevPrint feed service (market intelligence relay)
if (env.DEVPRINT_WS_URL) {
  devprintFeed = new DevPrintFeedService(env.DEVPRINT_WS_URL);
  devprintFeed.start().catch((err) => {
    console.error('❌ DevPrint feed failed to start:', err);
  });
  console.log('✅ DevPrint feed service started');
  // Wire DevPrint feed getter into system routes for pipeline-status
  setDevPrintFeedGetter(() => devprintFeed);
} else {
  console.warn('⚠️  DEVPRINT_WS_URL not set, DevPrint feed disabled');
}

const replicaId = getReplicaId();
const enableBackgroundWorkers = envFlag('ENABLE_BACKGROUND_WORKERS', true);
const enableHeliusMonitor = envFlag('ENABLE_HELIUS_MONITOR', enableBackgroundWorkers);
const enableSortinoCron = envFlag('ENABLE_SORTINO_CRON', enableBackgroundWorkers);

console.log(`[Replica] id=${replicaId}`);
console.log(`[Replica] ENABLE_BACKGROUND_WORKERS=${enableBackgroundWorkers}`);
console.log(`[Replica] ENABLE_HELIUS_MONITOR=${enableHeliusMonitor}`);
console.log(`[Replica] ENABLE_SORTINO_CRON=${enableSortinoCron}`);

// Start WebSocket monitor in background
if (enableHeliusMonitor) {
  startHeliusMonitor();
} else {
  console.log('⏭️  Helius monitor disabled on this replica');
}

// Start BSC Trade Monitor (always on — RPC-based, no API key needed)
const bscMonitor = createBSCMonitor();
bscMonitor.start().catch((err) => {
  console.error('❌ BSC monitor failed to start:', err);
});

// Start Base Trade Monitor (always on — RPC-based, no API key needed)
const baseMonitor = createBaseMonitor();
baseMonitor.start().catch((err) => {
  console.error('❌ Base monitor failed to start:', err);
});

// Start Clanker Token Launch Monitor (always on — RPC-based)
const clankerMonitor = createClankerMonitor();
clankerMonitor.start().catch((err) => {
  console.error('❌ Clanker monitor failed to start:', err);
});

// Start Four.Meme Migration Monitor (always on — RPC-based, no API key needed)
const fourMemeMonitor = createFourMemeMonitor();
fourMemeMonitor.onMigration(async (event) => {
  console.log(`🎉 [4meme] New token: ${event.tokenSymbol} (${event.tokenAddress.slice(0, 10)}...)`);

  // Generate agent conversation about the migration
  try {
    const { agentSignalReactor } = await import('./services/agent-signal-reactor.js');
    await agentSignalReactor.react('new_token', {
      mint: event.tokenAddress,
      symbol: event.tokenSymbol,
      name: event.tokenName,
      marketCap: 0,
      liquidity: 0,
      chain: 'BSC',
      source: 'four_meme_migration',
      txHash: event.txHash,
    });
  } catch (err) {
    console.error('[4meme] Failed to generate agent conversation:', err);
  }
});
fourMemeMonitor.start().catch((err) => {
  console.error('❌ 4meme monitor failed to start:', err);
});

// Start Auto-Buy Executor (always on — processes trigger engine queue)
startAutoBuyExecutor();

// Start Sortino cron job (hourly recalculation)
const lockService = new DistributedLockService(db, replicaId);
let sortinoCron: ReturnType<typeof createSortinoCron> | null = null;
let predictionCron: ReturnType<typeof createPredictionCron> | null = null;
if (enableSortinoCron) {
  sortinoCron = createSortinoCron(db, lockService);
  sortinoCron.start();
  try {
    predictionCron = createPredictionCron(db, lockService);
    predictionCron.start();
  } catch (err) {
    console.warn('⚠️  Prediction cron failed to start (tables may not exist yet):', err);
  }
} else {
  console.log('⏭️  Sortino cron disabled on this replica');
}

// Start Autonomous Trading Loop (agent activity generator)
const enableTradingLoop = envFlag('ENABLE_TRADING_LOOP', enableBackgroundWorkers);
if (enableTradingLoop) {
  import('./services/agent-trading-loop.js').then(({ startTradingLoop }) => {
    const intervalMinutes = parseInt(process.env.TRADING_LOOP_INTERVAL || '20', 10);
    const agentsPerCycle = parseInt(process.env.AGENTS_PER_CYCLE || '3', 10);
    const minConfidence = parseInt(process.env.TRADING_MIN_CONFIDENCE || '70', 10);

    startTradingLoop({
      intervalMinutes,
      agentsPerCycle,
      minConfidence,
      maxTradesPerCycle: 5,
      positionSizeSOL: 1.5,
    });

    console.log(`✅ Autonomous trading loop started (every ${intervalMinutes}min, ${agentsPerCycle} agents/cycle)`);
  }).catch((err) => {
    console.error('❌ Failed to start trading loop:', err);
  });
} else {
  console.log('⏭️  Trading loop disabled on this replica');
}

// Start Scanner Scheduler (5 AI scanners on independent schedules)
const enableScanners = envFlag('ENABLE_SCANNERS', enableBackgroundWorkers);
const scannerScheduler = enableScanners ? getScannerScheduler() : null;
if (scannerScheduler) {
  scannerScheduler.start();
  console.log('✅ Scanner scheduler started (Alpha/Beta/Gamma/Delta/Epsilon)');
} else {
  console.log('⏭️  Scanner scheduler disabled on this replica');
}

// Update Prometheus metrics every 30 seconds
setInterval(async () => {
  await updateAgentMetrics(db);
  await updateEpochMetrics(db);
}, 30000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  if (sortinoCron) sortinoCron.stop();
  if (predictionCron) predictionCron.stop();
  if (scannerScheduler) scannerScheduler.stop();
  stopAutoBuyExecutor();
  if (devprintFeed) await devprintFeed.stop();
  // Stop trading loop if running
  if (enableTradingLoop) {
    import('./services/agent-trading-loop.js').then(({ stopTradingLoop }) => {
      stopTradingLoop();
    });
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (sortinoCron) sortinoCron.stop();
  if (predictionCron) predictionCron.stop();
  if (scannerScheduler) scannerScheduler.stop();
  stopAutoBuyExecutor();
  if (devprintFeed) await devprintFeed.stop();
  // Stop trading loop if running
  if (enableTradingLoop) {
    import('./services/agent-trading-loop.js').then(({ stopTradingLoop }) => {
      stopTradingLoop();
    });
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Note: Bun doesn't use the default export when server.listen() is called
// The server.listen() call takes precedence
