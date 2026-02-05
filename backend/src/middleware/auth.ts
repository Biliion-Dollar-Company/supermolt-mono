import { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt';
import type { JwtPayload } from '../types';

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
    userId: string;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authorization token provided',
        },
      },
      401
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);
    c.set('user', payload);
    c.set('userId', payload.sub);
    await next();
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      },
      401
    );
  }
}
