import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env';

// Routes
import { health } from './routes/health';
import { auth } from './routes/auth';
import { user } from './routes/user';
import { agent } from './routes/agent';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:8081', 'exp://localhost:8081'], // Expo dev
    credentials: true,
  })
);

// Routes
app.route('/health', health);
app.route('/auth', auth);
app.route('/user', user);
app.route('/agent', agent);

// Root
app.get('/', (c) => {
  return c.json({
    name: 'SR-Mobile API',
    version: '0.1.0',
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
🚀 SR-Mobile API starting...
   Port: ${port}
   Environment: ${process.env.NODE_ENV || 'development'}
`);

export default {
  port,
  fetch: app.fetch,
};
