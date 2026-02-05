/**
 * Admin Authentication Middleware
 * 
 * Protects admin endpoints with API key
 */

import { Context, Next } from 'hono';
import { createErrorResponse, ErrorCodes } from '../types/api';

/**
 * Middleware to check admin API key
 * 
 * Usage:
 * app.post('/admin-endpoint', adminAuth, async (c) => { ... })
 */
export async function adminAuth(c: Context, next: Next) {
  const apiKey = c.req.header('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    console.warn('[Admin Auth] ADMIN_API_KEY not configured in environment');
    return c.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'Admin authentication not configured'
      ),
      500
    );
  }

  if (!apiKey) {
    return c.json(
      createErrorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Missing admin API key. Include X-Admin-Key header.'
      ),
      401
    );
  }

  if (apiKey !== expectedKey) {
    return c.json(
      createErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Invalid admin API key'
      ),
      403
    );
  }

  // Key is valid, proceed
  await next();
}

/**
 * Optional: Bearer token auth
 */
export function bearerAuth(c: Context, next: Next) {
  const authHeader = c.req.header('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      createErrorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Missing bearer token. Include Authorization: Bearer <token> header.'
      ),
      401
    );
  }

  const token = authHeader.substring(7);
  const expectedToken = process.env.ADMIN_BEARER_TOKEN || process.env.ADMIN_API_KEY;

  if (token !== expectedToken) {
    return c.json(
      createErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Invalid bearer token'
      ),
      403
    );
  }

  return next();
}
