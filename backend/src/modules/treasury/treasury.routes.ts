/**
 * Treasury Routes (Hono)
 * 
 * Standardized with ApiResponse<T> pattern
 */

import { Hono } from 'hono';
import { TreasuryManagerService } from '../../services/treasury-manager.service';
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '../../types/api';
import { adminAuth } from '../../middleware/admin-auth';
import { db } from '../../lib/db';
import type {
  TreasuryStatusDto,
  AllocationCalculationDto,
  DistributionResultDto,
  ScannerAllocationsDto
} from './dto/treasury.dto';

const app = new Hono();

// Lazy-init treasury service (requires TREASURY_PRIVATE_KEY)
function getTreasuryService() {
  if (!process.env.TREASURY_PRIVATE_KEY || process.env.TREASURY_PRIVATE_KEY === 'test_key_placeholder') {
    throw new Error('Treasury service not configured. Set TREASURY_PRIVATE_KEY in .env');
  }
  return new TreasuryManagerService();
}

/**
 * GET /status
 * Get current treasury pool status
 */
app.get('/status', async (c) => {
  try {
    const status = await getTreasuryService().getTreasuryStatus();
    
    const response: TreasuryStatusDto = {
      ...status,
      currentEpoch: null, // TODO: query active epoch
      treasuryWallet: getTreasuryService().getTreasuryPublicKey() || 'unknown',
      lastUpdated: new Date().toISOString()
    };
    
    return c.json(createSuccessResponse(response));
  } catch (error: any) {
    return c.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        error.message
      ),
      500
    );
  }
});

/**
 * GET /allocations/:epochId
 * Calculate allocation amounts for an epoch (preview)
 */
app.get('/allocations/:epochId', async (c) => {
  try {
    const { epochId } = c.req.param();
    const allocations = await getTreasuryService().calculateAllocations(epochId);
    
    const totalAmount = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    
    // Epoch name is embedded in allocations context (can extract from error if needed)
    const response: AllocationCalculationDto = {
      epochId,
      epochName: 'USDC Hackathon Week 1', // TODO: Get from epoch query
      allocations,
      totalAmount: Math.round(totalAmount * 100) / 100,
      scannerCount: allocations.length
    };
    
    return c.json(createSuccessResponse(response));
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
 * POST /distribute/:epochId
 * Execute USDC distribution for an epoch
 * 
 * 🔒 PROTECTED: Requires admin API key
 */
app.post('/distribute/:epochId', adminAuth, async (c) => {
  try {
    const { epochId } = c.req.param();
    
    // Execute distribution
    const result = await getTreasuryService().distributeRewards(epochId);
    
    const successCount = result.allocations.filter((t: any) => t.status === 'success').length;
    const failedCount = result.allocations.filter((t: any) => t.status === 'failed').length;
    const totalAmount = result.allocations.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);

    const response: DistributionResultDto = {
      epochId,
      epochName: 'USDC Distribution',
      allocations: result.allocations.map((a: any) => ({
        scannerId: a.scannerId,
        scannerName: a.scannerName,
        pubkey: a.pubkey || '',
        rank: a.rank || 0,
        performanceScore: a.performanceScore || 0,
        winRate: a.winRate || 0,
        totalCalls: a.totalCalls || 0,
        usdcAmount: a.amount || 0,
        multiplier: 1,
      })),
      transactions: result.allocations.map((t: any) => ({
        scannerId: t.scannerId,
        scannerName: t.scannerName,
        signature: t.signature || '',
        status: t.status,
        amount: t.amount || 0,
        error: t.error,
      })),
      summary: {
        total: Math.round(totalAmount * 100) / 100,
        successful: successCount,
        failed: failedCount,
        timestamp: new Date().toISOString()
      }
    };
    
    return c.json(createSuccessResponse(response));
  } catch (error: any) {
    if (error.message.includes('Insufficient')) {
      return c.json(
        createErrorResponse(
          ErrorCodes.INSUFFICIENT_BALANCE,
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
 * GET /scanner/:scannerId/allocations
 * Get allocation history for a scanner
 */
app.get('/scanner/:scannerId/allocations', async (c) => {
  try {
    const { scannerId } = c.req.param();
    const result = await getTreasuryService().getScannerAllocations(scannerId);

    // Query scanner directly from database
    const scanner = await db.scanner.findUnique({ where: { id: scannerId } });

    if (!scanner) {
      return c.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, 'Scanner not found'),
        404
      );
    }

    const response: ScannerAllocationsDto = {
      scannerId,
      scannerName: scanner.name,
      allocations: result.allocations.map((a: any) => ({
        id: a.epochId,
        epochId: a.epochId,
        epochName: a.epochName || 'Unknown',
        amount: a.amount,
        performanceScore: 0,
        rank: a.rank || 0,
        txSignature: a.txSignature || null,
        status: a.status as 'pending' | 'completed' | 'failed',
        createdAt: a.createdAt,
        completedAt: null
      })),
      totalEarned: Math.round(result.totalEarned * 100) / 100,
      allocationCount: result.allocations.length
    };
    
    return c.json(createSuccessResponse(response));
  } catch (error: any) {
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

/**
 * GET /epoch/:epochId/allocations
 * Get all allocations for an epoch
 */
app.get('/epoch/:epochId/allocations', async (c) => {
  try {
    const { epochId } = c.req.param();
    
    // Query allocations directly from database
    const allocations = await db.treasuryAllocation.findMany({
      where: { epochId },
      orderBy: { rank: 'asc' }
    });
    
    return c.json(createSuccessResponse({
      epochId,
      allocations
    }));
  } catch (error: any) {
    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      500
    );
  }
});

export default app;
