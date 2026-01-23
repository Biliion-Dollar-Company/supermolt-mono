import { Hono } from 'hono';
import { checkDbConnection } from '../lib/db';
import { redis } from '../lib/redis';

const health = new Hono();

health.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
  });
});

health.get('/ready', async (c) => {
  const dbOk = await checkDbConnection();

  let redisOk = true;
  if (redis) {
    try {
      await redis.ping();
    } catch {
      redisOk = false;
    }
  }

  const allOk = dbOk && redisOk;

  return c.json(
    {
      success: allOk,
      data: {
        status: allOk ? 'ready' : 'degraded',
        services: {
          database: dbOk ? 'ok' : 'error',
          redis: redis ? (redisOk ? 'ok' : 'error') : 'disabled',
        },
      },
    },
    allOk ? 200 : 503
  );
});

export { health };
