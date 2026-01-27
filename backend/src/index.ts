import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env';

// Routes
import { health } from './routes/health';
import { auth } from './routes/auth';
import { agent } from './routes/agent';
import { trades } from './routes/trades';
import { archetypes } from './routes/archetypes';
import { internal } from './routes/internal';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:8081', 'exp://localhost:8081'],
    credentials: true,
  })
);

// Public routes
app.route('/health', health);
app.route('/archetypes', archetypes);

// Auth routes
app.route('/auth', auth);

// Protected routes (JWT required)
app.route('/agents', agent);
app.route('/trades', trades);

// Internal routes (API key required — DevPrint → SR-Mobile)
app.route('/internal', internal);

// Root
app.get('/', (c) => {
  return c.json({
    name: 'SR-Mobile API',
    version: '0.2.0',
    docs: '/health',
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

// Start server
const port = parseInt(env.PORT, 10);

console.log(`
  SR-Mobile API starting...
   Port: ${port}
   Environment: ${process.env.NODE_ENV || 'development'}
`);

export default {
  port,
  fetch: app.fetch,
};
