/**
 * Epoch Routes
 * Admin endpoints for managing scanner competition epochs
 */

import { Hono } from 'hono';
import { EpochService } from './epoch.service';
import type {
  CreateEpochDto,
  UpdateEpochStatusDto,
} from './dto/epoch.dto';

const app = new Hono();

// Lazy-init service
let epochService: EpochService | null = null;
function getEpochService() {
  if (!epochService) {
    epochService = new EpochService();
  }
  return epochService;
}

/**
 * Admin auth middleware
 */
const requireAdmin = async (c: any, next: any) => {
  const adminKey = c.req.header('X-Admin-Key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'ADMIN_API_KEY not configured in environment',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }

  if (!adminKey || adminKey !== expectedKey) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing admin API key',
          timestamp: new Date().toISOString(),
        },
      },
      401
    );
  }

  await next();
};

/**
 * POST /api/epochs
 * Create new epoch
 */
app.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();

    // Validate required fields
    if (!body.name || !body.startAt || !body.endAt) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: name, startAt, endAt',
            timestamp: new Date().toISOString(),
          },
        },
        400
      );
    }

    // Validate dates
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date format for startAt or endAt',
            timestamp: new Date().toISOString(),
          },
        },
        400
      );
    }

    if (endAt <= startAt) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'endAt must be after startAt',
            timestamp: new Date().toISOString(),
          },
        },
        400
      );
    }

    const epoch = await getEpochService().create(body);

    return c.json(
      {
        success: true,
        data: epoch,
      },
      201
    );
  } catch (error: any) {
    console.error('[Epoch Routes] Create epoch error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to create epoch',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
});

/**
 * GET /api/epochs
 * List all epochs
 */
app.get('/', async (c) => {
  try {
    // Note: getAll() doesn't support filtering by status yet, returns all epochs
    const result = await getEpochService().getAll();

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Epoch Routes] List epochs error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to list epochs',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
});

/**
 * GET /api/epochs/active
 * Get current active epoch
 */
app.get('/active', async (c) => {
  try {
    const epoch = await getEpochService().getActive();

    if (!epoch) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No active epoch found',
            timestamp: new Date().toISOString(),
          },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: epoch,
    });
  } catch (error: any) {
    console.error('[Epoch Routes] Get active epoch error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to get active epoch',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
});

/**
 * GET /api/epochs/:id
 * Get epoch by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const epoch = await getEpochService().getById(id);

    return c.json({
      success: true,
      data: epoch,
    });
  } catch (error: any) {
    console.error('[Epoch Routes] Get epoch error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to get epoch',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
});

/**
 * PATCH /api/epochs/:id/status
 * Update epoch status (admin only)
 */
app.patch('/:id/status', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (!body.status) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required field: status',
            timestamp: new Date().toISOString(),
          },
        },
        400
      );
    }

    const validStatuses = ['ACTIVE', 'ENDED', 'PAID'];
    if (!validStatuses.includes(body.status)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            timestamp: new Date().toISOString(),
          },
        },
        400
      );
    }

    const epoch = await getEpochService().updateStatus(id, body.status);

    return c.json({
      success: true,
      data: epoch,
    });
  } catch (error: any) {
    console.error('[Epoch Routes] Update epoch status error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to update epoch status',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
});

/**
 * POST /api/epochs/:id/end
 * End epoch early (admin only)
 */
app.post('/:id/end', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const epoch = await getEpochService().end(id);

    return c.json({
      success: true,
      data: epoch,
    });
  } catch (error: any) {
    console.error('[Epoch Routes] End epoch error:', error);
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to end epoch',
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
});

export default app;
