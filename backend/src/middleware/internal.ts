import { Context, Next } from 'hono';
import { env } from '../lib/env';

// Middleware for internal API calls (DevPrint → SR-Mobile)
// Uses a shared API key in the x-api-key header.
export async function internalAuthMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('x-api-key');

  if (!env.INTERNAL_API_KEY) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API not configured',
        },
      },
      500
    );
  }

  if (!apiKey || apiKey !== env.INTERNAL_API_KEY) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
        },
      },
      401
    );
  }

  await next();
}
