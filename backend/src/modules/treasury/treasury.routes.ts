/**
 * Treasury Routes (Hono)
 * 
 * Standardized with ApiResponse<T> pattern
 */

import { Hono } from 'hono';
import { TreasuryManagerService } from '../../services/treasury-manager.service';
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '../../types/api';
import { adminAuth } from '../../middleware/admin-auth';
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
    const result = await getTreasuryService().distributeEpochRewards(epochId);
    
    if (!result.success) {
      return c.json(
        createErrorResponse(
          ErrorCodes.ALLOCATION_FAILED,
          'No rankings found for epoch'
        ),
        400
      );
    }
    
    const successCount = result.transactions.filter(t => t.status === 'success').length;
    const failedCount = result.transactions.filter(t => t.status === 'failed').length;
    const totalAmount = result.allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    
    const response: DistributionResultDto = {
      epochId: result.epochId || epochId,
      epochName: result.epochName || 'Unknown',
      allocations: result.allocations,
      transactions: result.transactions.map(t => ({
        ...t,
        scannerName: result.allocations.find(a => a.scannerId === t.scannerId)?.scannerName || 'Unknown',
        amount: result.allocations.find(a => a.scannerId === t.scannerId)?.usdcAmount || 0
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
    const allocations = await getTreasuryService().getScannerAllocations(scannerId);
    
    // Query scanner directly from database
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const scanner = await prisma.scanner.findUnique({ where: { id: scannerId } });
    
    if (!scanner) {
      return c.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, 'Scanner not found'),
        404
      );
    }
    
    const totalEarned = allocations
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + parseFloat(a.amount.toString()), 0);
    
    const response: ScannerAllocationsDto = {
      scannerId,
      scannerName: scanner.name,
      allocations: allocations.map(a => ({
        id: a.id,
        epochId: a.epochId,
        epochName: 'Epoch ' + a.epochId.substring(0, 8), // TODO: join with epoch
        amount: parseFloat(a.amount.toString()),
        performanceScore: parseFloat(a.performanceScore.toString()),
        rank: a.rank,
        txSignature: a.txSignature,
        status: a.status as 'pending' | 'completed' | 'failed',
        createdAt: a.createdAt.toISOString(),
        completedAt: a.completedAt?.toISOString() || null
      })),
      totalEarned: Math.round(totalEarned * 100) / 100,
      allocationCount: allocations.length
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
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const allocations = await prisma.scannerAllocation.findMany({
      where: { epochId },
      include: { scanner: true },
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
