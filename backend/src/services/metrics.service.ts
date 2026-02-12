/**
 * Prometheus Metrics Service
 * 
 * Exposes application and infrastructure metrics in Prometheus format
 * Endpoint: GET /metrics
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Collect default Node.js metrics (CPU, memory, event loop lag, etc.)
collectDefaultMetrics({ prefix: 'supermolt_' });

// ============================================================================
// HTTP Metrics
// ============================================================================

export const httpRequestDuration = new Histogram({
  name: 'supermolt_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 10ms to 5s
});

export const httpRequestTotal = new Counter({
  name: 'supermolt_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestErrors = new Counter({
  name: 'supermolt_http_errors_total',
  help: 'Total number of HTTP errors (5xx)',
  labelNames: ['method', 'route', 'status'],
});

// ============================================================================
// Application Metrics
// ============================================================================

export const activeAgents = new Gauge({
  name: 'supermolt_agents_active_total',
  help: 'Total number of active trading agents',
});

export const agentSignups = new Counter({
  name: 'supermolt_agents_signups_total',
  help: 'Total number of agent signups',
  labelNames: ['method'], // 'siws', 'webhook'
});

export const tradesTotal = new Counter({
  name: 'supermolt_trades_total',
  help: 'Total number of trades executed',
  labelNames: ['action'], // 'BUY', 'SELL'
});

export const twitterVerifications = new Counter({
  name: 'supermolt_twitter_verifications_total',
  help: 'Total number of Twitter account verifications',
  labelNames: ['status'], // 'success', 'failed'
});

export const usdcPoolSize = new Gauge({
  name: 'supermolt_usdc_pool_size',
  help: 'Current USDC pool size in epoch',
});

// ============================================================================
// WebSocket Metrics
// ============================================================================

export const websocketConnections = new Gauge({
  name: 'supermolt_websocket_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['type'], // 'helius', 'devprint', 'socketio'
});

export const websocketMessages = new Counter({
  name: 'supermolt_websocket_messages_total',
  help: 'Total WebSocket messages received',
  labelNames: ['source'], // 'helius', 'devprint'
});

export const websocketReconnects = new Counter({
  name: 'supermolt_websocket_reconnects_total',
  help: 'Total WebSocket reconnection attempts',
  labelNames: ['source'],
});

// ============================================================================
// Database Metrics
// ============================================================================

export const dbQueryDuration = new Histogram({
  name: 'supermolt_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const dbQueryTotal = new Counter({
  name: 'supermolt_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'model'],
});

export const dbConnectionPool = new Gauge({
  name: 'supermolt_db_connection_pool',
  help: 'Database connection pool statistics',
  labelNames: ['state'], // 'active', 'idle', 'waiting'
});

// ============================================================================
// Authentication Metrics
// ============================================================================

export const siwsAuthAttempts = new Counter({
  name: 'supermolt_siws_auth_attempts_total',
  help: 'Total SIWS authentication attempts',
  labelNames: ['status'], // 'success', 'failed'
});

export const jwtTokensIssued = new Counter({
  name: 'supermolt_jwt_tokens_issued_total',
  help: 'Total JWT tokens issued',
  labelNames: ['type'], // 'access', 'refresh'
});

// ============================================================================
// External API Metrics
// ============================================================================

export const externalApiCalls = new Counter({
  name: 'supermolt_external_api_calls_total',
  help: 'Total external API calls',
  labelNames: ['service', 'status'], // service: 'helius', 'birdeye', 'twitter_api'
});

export const externalApiDuration = new Histogram({
  name: 'supermolt_external_api_duration_seconds',
  help: 'Duration of external API calls',
  labelNames: ['service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// ============================================================================
// Business Metrics
// ============================================================================

export const leaderboardQueries = new Counter({
  name: 'supermolt_leaderboard_queries_total',
  help: 'Total leaderboard queries',
});

export const epochRewards = new Gauge({
  name: 'supermolt_epoch_rewards_distributed',
  help: 'Total rewards distributed in current epoch',
});

export const sortinoCalculations = new Counter({
  name: 'supermolt_sortino_calculations_total',
  help: 'Total Sortino ratio calculations',
  labelNames: ['status'], // 'success', 'failed'
});

export const cronLockEvents = new Counter({
  name: 'supermolt_cron_lock_events_total',
  help: 'Total number of cron lock events',
  labelNames: ['job', 'result'], // result: 'acquired', 'skipped', 'release_failed'
});

export const webhookQueueDepth = new Gauge({
  name: 'supermolt_webhook_queue_depth',
  help: 'Current depth of the webhook queue',
  labelNames: ['mode'], // 'redis', 'memory'
});

export const webhookQueueEnqueued = new Counter({
  name: 'supermolt_webhook_queue_enqueued_total',
  help: 'Total items enqueued to webhook queue',
  labelNames: ['mode', 'result'], // result: 'accepted', 'rejected'
});

export const webhookQueueProcessed = new Counter({
  name: 'supermolt_webhook_queue_processed_total',
  help: 'Total webhook items processed',
  labelNames: ['mode', 'result'], // result: 'success', 'failed'
});

// ============================================================================
// Worker/Cron Metrics
// ============================================================================



// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Middleware to track HTTP request metrics
 */
export function createMetricsMiddleware() {
  return async (c: any, next: any) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    // Normalize route to get meaningful patterns
    let route = path;

    // Map common routes to patterns for better grouping
    if (path.startsWith('/api/leaderboard')) {
      route = '/api/leaderboard';
    } else if (path.startsWith('/api/epochs')) {
      route = '/api/epochs/*';
    } else if (path.startsWith('/api/treasury')) {
      route = '/api/treasury/*';
    } else if (path.startsWith('/api/calls')) {
      route = '/api/calls/*';
    } else if (path.startsWith('/agents/')) {
      route = '/agents/:id';
    } else if (path.startsWith('/trades/')) {
      route = '/trades/*';
    } else if (path.startsWith('/auth/')) {
      route = '/auth/*';
    } else if (path.startsWith('/webhooks/')) {
      route = '/webhooks/*';
    } else if (path.startsWith('/feed/')) {
      route = '/feed/*';
    } else if (path.startsWith('/positions/')) {
      route = '/positions/*';
    } else if (path.startsWith('/messaging/')) {
      route = '/messaging/*';
    } else if (path.startsWith('/voting/')) {
      route = '/voting/*';
    } else if (path === '/health' || path === '/metrics' || path === '/') {
      route = path; // Keep as-is
    } else if (path.startsWith('/docs') || path.startsWith('/swagger') || path.startsWith('/skills')) {
      route = path.split('/').slice(0, 2).join('/'); // Keep first level
    }

    await next();

    const duration = (Date.now() - start) / 1000;
    const status = c.res.status;

    // Record metrics
    httpRequestDuration.labels(method, route, String(status)).observe(duration);
    httpRequestTotal.labels(method, route, String(status)).inc();

    // Track errors
    if (status >= 500) {
      httpRequestErrors.labels(method, route, String(status)).inc();
    }
  };
}

/**
 * Update agent count (call periodically)
 */
export async function updateAgentMetrics(prisma: any) {
  try {
    const count = await prisma.tradingAgent.count({
      where: { status: 'ACTIVE' }
    });
    activeAgents.set(count);
  } catch (error) {
    console.error('Failed to update agent metrics:', error);
  }
}

/**
 * Update USDC pool size (call when epoch changes)
 */
export async function updateEpochMetrics(prisma: any) {
  try {
    const activeEpoch = await prisma.scannerEpoch.findFirst({
      where: { status: 'ACTIVE' },
    });

    if (activeEpoch) {
      usdcPoolSize.set(parseFloat(activeEpoch.usdcPool.toString()));
    }
  } catch (error) {
    console.error('Failed to update epoch metrics:', error);
  }
}

/**
 * Export Prometheus metrics in text format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

// Export the registry for custom metrics
export { register };
