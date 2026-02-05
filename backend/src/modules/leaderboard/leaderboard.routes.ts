/**
 * Leaderboard Routes (Hono)
 * 
 * Standardized with ApiResponse<T> pattern
 */

import { Hono } from 'hono';
import { LeaderboardService } from './leaderboard.service';
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '../../types/api';
import type { LeaderboardDto, ScannerStatsDto, GlobalStatsDto } from './dto/leaderboard.dto';

const app = new Hono();

// Lazy-init service
let leaderboardService: LeaderboardService | null = null;
function getLeaderboardService() {
  if (!leaderboardService) {
    leaderboardService = new LeaderboardService();
  }
  return leaderboardService;
}

/**
 * GET /
 * Get current leaderboard (active epoch)
 */
app.get('/', async (c) => {
  try {
    const leaderboard = await getLeaderboardService().getCurrentLeaderboard();
    
    if (!leaderboard) {
      return c.json(createSuccessResponse({
        message: 'No active epoch',
        rankings: []
      }));
    }
    
    return c.json(createSuccessResponse<LeaderboardDto>(leaderboard));
  } catch (error: any) {
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

/**
 * GET /:epochId
 * Get leaderboard for specific epoch
 */
app.get('/:epochId', async (c) => {
  try {
    const { epochId } = c.req.param();
    const leaderboard = await getLeaderboardService().getLeaderboardForEpoch(epochId);
    
    return c.json(createSuccessResponse<LeaderboardDto>(leaderboard));
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
 * GET /scanner/:scannerId
 * Get scanner performance history
 */
app.get('/scanner/:scannerId', async (c) => {
  try {
    const { scannerId } = c.req.param();
    const stats = await getLeaderboardService().getScannerStats(scannerId);
    
    return c.json(createSuccessResponse<ScannerStatsDto>(stats));
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
 * GET /stats/global
 * Get global statistics
 */
app.get('/stats/global', async (c) => {
  try {
    const stats = await getLeaderboardService().getGlobalStats();
    
    return c.json(createSuccessResponse<GlobalStatsDto>(stats));
  } catch (error: any) {
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

export default app;
