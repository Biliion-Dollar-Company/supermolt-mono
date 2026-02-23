/**
 * Notification Routes
 * POST /register — Register push token for the authenticated agent
 * DELETE /register — Unregister push token
 */

import { Hono } from 'hono';
import { Context, Next } from 'hono';
import * as jose from 'jose';
import { registerPushToken, unregisterPushToken } from '../services/notification.service';

const notificationRoutes = new Hono();

const JWT_SECRET = process.env.JWT_SECRET;

async function agentJwtMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Authorization required' }, 401);
  }

  const token = authHeader.slice(7);
  if (!JWT_SECRET) {
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    if (payload.type !== 'agent') {
      return c.json({ success: false, error: 'Invalid token type' }, 401);
    }

    c.set('agentId', payload.agentId as string);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
}

// Register push token
notificationRoutes.post('/register', agentJwtMiddleware, async (c) => {
  try {
    const agentId = c.get('agentId') as string;
    const { pushToken } = await c.req.json<{ pushToken: string }>();

    if (!pushToken || typeof pushToken !== 'string') {
      return c.json({ success: false, error: 'pushToken is required' }, 400);
    }

    await registerPushToken(agentId, pushToken);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Notifications] Register error:', error);
    return c.json({ success: false, error: error.message || 'Failed to register push token' }, 400);
  }
});

// Unregister push token
notificationRoutes.delete('/register', agentJwtMiddleware, async (c) => {
  try {
    const agentId = c.get('agentId') as string;
    await unregisterPushToken(agentId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Notifications] Unregister error:', error);
    return c.json({ success: false, error: 'Failed to unregister' }, 500);
  }
});

export default notificationRoutes;
