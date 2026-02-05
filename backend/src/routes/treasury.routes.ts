import { Router } from 'express';
import { TreasuryManagerService } from '../services/treasury-manager.service.js';

const router = Router();
const treasuryService = new TreasuryManagerService();

/**
 * GET /api/treasury/status
 * Get current treasury pool status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await treasuryService.getTreasuryStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/treasury/allocations/:epochId
 * Calculate allocation amounts for an epoch (preview)
 */
router.get('/allocations/:epochId', async (req, res) => {
  try {
    const { epochId } = req.params;
    const allocations = await treasuryService.calculateAllocations(epochId);
    
    const totalAmount = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    
    res.json({
      success: true,
      data: {
        epochId,
        allocations,
        totalAmount,
        scannerCount: allocations.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/treasury/distribute/:epochId
 * Execute USDC distribution for an epoch
 * 
 * This is the BIG ONE - actually sends USDC to scanners
 */
router.post('/distribute/:epochId', async (req, res) => {
  try {
    const { epochId } = req.params;
    
    // Execute distribution
    const result = await treasuryService.distributeEpochRewards(epochId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'No rankings found for epoch'
      });
    }
    
    const successCount = result.transactions.filter(t => t.status === 'success').length;
    const failedCount = result.transactions.filter(t => t.status === 'failed').length;
    
    res.json({
      success: true,
      message: `Distributed USDC to ${successCount} scanners`,
      data: {
        epochId,
        allocations: result.allocations,
        transactions: result.transactions,
        summary: {
          total: result.allocations.reduce((sum, a) => sum + a.usdcAmount, 0),
          successful: successCount,
          failed: failedCount
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/treasury/scanner/:scannerId/allocations
 * Get allocation history for a scanner
 */
router.get('/scanner/:scannerId/allocations', async (req, res) => {
  try {
    const { scannerId } = req.params;
    const allocations = await treasuryService.getScannerAllocations(scannerId);
    
    const totalEarned = allocations
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + parseFloat(a.amount.toString()), 0);
    
    res.json({
      success: true,
      data: {
        scannerId,
        allocations,
        totalEarned,
        allocationCount: allocations.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/treasury/epoch/:epochId/allocations
 * Get all allocations for an epoch
 */
router.get('/epoch/:epochId/allocations', async (req, res) => {
  try {
    const { epochId } = req.params;
    const allocations = await treasuryService.getEpochAllocations(epochId);
    
    res.json({
      success: true,
      data: {
        epochId,
        allocations
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
