/**
 * Scanner Calls Routes (Hono)
 * 
 * Standardized with ApiResponse<T> pattern
 */

import { Hono } from 'hono';
import { ScannerCallsService } from './scanner-calls.service';
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '../../types/api';
import type {
  ScannerCallDto,
  SubmitCallDto,
  CloseCallDto,
  ScannerCallsListDto,
  CallStatsDto
} from './dto/scanner-call.dto';

const app = new Hono();

// Lazy-init service
let callsService: ScannerCallsService | null = null;
function getCallsService() {
  if (!callsService) {
    callsService = new ScannerCallsService();
  }
  return callsService;
}

/**
 * POST /
 * Submit new scanner call
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<SubmitCallDto>();
    
    // Validation
    if (!body.scannerId || !body.tokenAddress || body.convictionScore === undefined) {
      return c.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Missing required fields: scannerId, tokenAddress, convictionScore'
        ),
        400
      );
    }

    if (body.convictionScore < 0 || body.convictionScore > 1) {
      return c.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'convictionScore must be between 0 and 1'
        ),
        400
      );
    }
    
    const call = await getCallsService().submit(body);
    return c.json(createSuccessResponse<ScannerCallDto>(call), 201);
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('No active epoch')) {
      return c.json(
        createErrorResponse(
          error.message.includes('epoch') ? ErrorCodes.EPOCH_NOT_ACTIVE : ErrorCodes.NOT_FOUND,
          error.message
        ),
        400
      );
    }
    
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

/**
 * GET /scanner/:scannerId
 * Get scanner calls
 */
app.get('/scanner/:scannerId', async (c) => {
  try {
    const { scannerId } = c.req.param();
    const limit = parseInt(c.req.query('limit') || '50');
    
    const result = await getCallsService().getScannerCalls(scannerId, limit);
    return c.json(createSuccessResponse<ScannerCallsListDto>(result));
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return c.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, error.message),
        404
      );
    }
    
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

/**
 * GET /scanner/:scannerId/stats
 * Get call statistics for scanner
 */
app.get('/scanner/:scannerId/stats', async (c) => {
  try {
    const { scannerId } = c.req.param();
    const stats = await getCallsService().getStats(scannerId);
    
    return c.json(createSuccessResponse<CallStatsDto>(stats));
  } catch (error: any) {
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

/**
 * GET /:callId
 * Get call by ID
 */
app.get('/:callId', async (c) => {
  try {
    const { callId } = c.req.param();
    const call = await getCallsService().getById(callId);
    
    return c.json(createSuccessResponse<ScannerCallDto>(call));
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return c.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, error.message),
        404
      );
    }
    
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

/**
 * POST/PATCH /:callId/close
 * Close call (mark as win/loss)
 */
const closeHandler = async (c: any) => {
  try {
    const { callId } = c.req.param();
    const body = await c.req.json<CloseCallDto>();
    
    if (!body.exitPrice || !body.status) {
      return c.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Missing required fields: exitPrice, status'
        ),
        400
      );
    }

    if (!['win', 'loss', 'expired'].includes(body.status)) {
      return c.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'status must be one of: win, loss, expired'
        ),
        400
      );
    }
    
    const call = await getCallsService().close(callId, body);
    return c.json(createSuccessResponse<ScannerCallDto>(call));
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('already closed')) {
      return c.json(
        createErrorResponse(ErrorCodes.VALIDATION_ERROR, error.message),
        400
      );
    }
    
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
};

app.post('/:callId/close', closeHandler);
app.patch('/:callId/close', closeHandler);

export default app;
