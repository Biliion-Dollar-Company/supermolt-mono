import { Hono } from 'hono';
import { z } from 'zod';
import * as profileService from '../services/profile.service';
import { authMiddleware } from '../middleware/auth';

const profile = new Hono();

// Validation schema
const updateProfileSchema = z.object({
  displayName: z.string().max(50).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  twitterHandle: z.string().max(50).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  discord: z.string().max(50).optional().or(z.literal('')),
  telegram: z.string().max(50).optional().or(z.literal('')),
});

// Note: GET is public, PUT requires auth
// Auth is applied only to the PUT route below

// GET /profiles/:wallet - Get agent profile (public)
profile.get('/:wallet', async (c) => {
  try {
    const wallet = c.req.param('wallet');
    const agentProfile = await profileService.getAgentProfile(wallet);

    return c.json({ success: true, data: agentProfile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get profile';
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message } },
      404
    );
  }
});

// PUT /profiles/:wallet - Update agent profile (auth required)
profile.put('/:wallet', authMiddleware, async (c) => {
  try {
    const wallet = c.req.param('wallet');
    const authenticatedUserId = c.get('userId');
    const body = await c.req.json();
    
    // Validate request body
    const data = updateProfileSchema.parse(body);

    // Update profile
    const updated = await profileService.updateAgentProfile(
      wallet,
      authenticatedUserId,
      data
    );

    return c.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid request body', 
            details: error.errors 
          } 
        },
        400
      );
    }
    
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    
    // Check if it's a forbidden error
    if (message.includes('FORBIDDEN')) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: message.replace('FORBIDDEN: ', '') } },
        403
      );
    }

    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      500
    );
  }
});

export { profile };
