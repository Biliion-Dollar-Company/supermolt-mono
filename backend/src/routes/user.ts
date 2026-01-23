import { Hono } from 'hono';
import { z } from 'zod';
import * as userService from '../services/user.service';
import { authMiddleware } from '../middleware/auth';

const user = new Hono();

// All routes require auth
user.use('*', authMiddleware);

const updateSettingsSchema = z.object({
  notifications: z.boolean().optional(),
  autoSign: z.boolean().optional(),
  maxSlippage: z.number().min(0.1).max(10).optional(),
});

// GET /user/settings
user.get('/settings', async (c) => {
  try {
    const userId = c.get('userId');
    const settings = await userService.getSettings(userId);

    return c.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get settings',
        },
      },
      500
    );
  }
});

// PUT /user/settings
user.put('/settings', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const updates = updateSettingsSchema.parse(body);

    const settings = await userService.updateSettings(userId, updates);

    return c.json({
      success: true,
      data: settings,
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

    console.error('Update settings error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update settings',
        },
      },
      500
    );
  }
});

export { user };
