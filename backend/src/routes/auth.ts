import { Hono } from 'hono';
import { z } from 'zod';
import { rateLimiter } from 'hono-rate-limiter';
import * as authService from '../services/auth.service';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateQuickstartAgent, issueAgentTokens } from '../services/agent-session.service';
import { getOnboardingProgress } from '../services/onboarding.service';

const auth = new Hono();

const loginSchema = z.object({
  privyToken: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const quickstartSchema = z.object({
  archetypeId: z.string().min(1).optional(),
  name: z.string().min(1).max(32).optional(),
  displayName: z.string().min(1).max(50).optional(),
});

const quickstartLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-6',
  keyGenerator: (c) =>
    c.get('userId')
    || c.req.header('x-forwarded-for')
    || c.req.header('x-real-ip')
    || 'unknown',
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

// POST /auth/agent/quickstart (protected) — one-click agent setup for regular users
auth.post('/agent/quickstart', authMiddleware, quickstartLimiter, async (c) => {
  try {
    const user = c.get('user');
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({}));
    const { archetypeId, name, displayName } = quickstartSchema.parse(body || {});

    const agent = await getOrCreateQuickstartAgent({
      userId,
      walletAddress: user.wallet ?? null,
      archetypeId,
      name,
      displayName,
    });

    const subject = user.wallet || userId;
    const tokens = await issueAgentTokens(agent.id, subject);
    const onboarding = await getOnboardingProgress(agent.id);

    return c.json({
      success: true,
      data: {
        agent,
        onboarding,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
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

    console.error('Quickstart error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Quickstart failed',
        },
      },
      500
    );
  }
});

export { auth };
