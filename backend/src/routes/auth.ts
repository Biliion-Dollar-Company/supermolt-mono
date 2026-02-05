import { Hono } from 'hono';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { authMiddleware } from '../middleware/auth';

const auth = new Hono();

const loginSchema = z.object({
  privyToken: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST /auth/login
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { privyToken } = loginSchema.parse(body);

    const result = await authService.login(privyToken);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          },
        },
        400
      );
    }

    console.error('Login error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: error instanceof Error ? error.message : 'Authentication failed',
        },
      },
      401
    );
  }
});

// POST /auth/refresh
auth.post('/refresh', async (c) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = refreshSchema.parse(body);

    const tokens = await authService.refresh(refreshToken);

    return c.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          },
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid refresh token',
        },
      },
      401
    );
  }
});

// GET /auth/me (protected) — returns userId from JWT
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    data: {
      userId: user.sub,
      privyId: user.privyId,
      wallet: user.wallet ?? null,
    },
  });
});

export { auth };
