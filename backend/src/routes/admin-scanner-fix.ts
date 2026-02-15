/**
 * TEMPORARY ADMIN ROUTE: Create missing Scanner for Epic Reward
 * DELETE THIS FILE after use
 */

import { Hono } from 'hono';
import { db } from '../lib/db';

const adminFix = new Hono();

adminFix.post('/create-scanner-epic-reward', async (c) => {
  try {
    const AGENT_ID = 'cmlnwnyyd005ks502eqyr38v0';
    const WALLET = '615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs';
    
    // Get agent
    const agent = await db.tradingAgent.findUnique({
      where: { id: AGENT_ID }
    });
    
    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }
    
    // Check if scanner exists
    let scanner = await db.scanner.findFirst({
      where: { pubkey: WALLET }
    });
    
    if (scanner) {
      // Scanner exists, but check if it has a ranking in the active epoch
      const activeEpoch = await db.scannerEpoch.findFirst({
        where: { status: 'ACTIVE' }
      });
      
      if (activeEpoch) {
        const ranking = await db.scannerRanking.findFirst({
          where: {
            scannerId: scanner.id,
            epochId: activeEpoch.id
          }
        });
        
        if (!ranking) {
          // Create ranking entry
          await db.scannerRanking.create({
            data: {
              epochId: activeEpoch.id,
              scannerId: scanner.id,
              performanceScore: 0,
              totalCalls: 0,
              winningCalls: 0,
              losingCalls: 0,
              winRate: 0,
              avgReturn: 0,
              totalPnl: 0,
              winStreak: 0,
              maxWinStreak: 0,
              usdcAllocated: 0
            }
          });
          
          return c.json({
            success: true,
            message: 'Scanner ranking created for active epoch!',
            scanner: {
              id: scanner.id,
              name: scanner.name,
              pubkey: scanner.pubkey,
              active: scanner.active
            },
            checkLeaderboard: 'https://sr-mobile-production.up.railway.app/api/leaderboard'
          });
        }
      }
      
      return c.json({
        success: true,
        message: 'Scanner already exists and is ranked',
        scanner: {
          id: scanner.id,
          name: scanner.name,
          pubkey: scanner.pubkey,
          active: scanner.active
        }
      });
    }
    
    // Create scanner
    scanner = await db.scanner.create({
      data: {
        agentId: AGENT_ID,
        name: agent.name,
        pubkey: WALLET,
        privateKey: '',
        strategy: 'general',
        description: 'Auto-created agent scanner',
        active: true
      }
    });
    
    // Get active epoch
    const activeEpoch = await db.scannerEpoch.findFirst({
      where: { status: 'ACTIVE' }
    });
    
    if (activeEpoch) {
      // Create ranking entry for this scanner in the active epoch
      await db.scannerRanking.create({
        data: {
          epochId: activeEpoch.id,
          scannerId: scanner.id,
          performanceScore: 0,
          totalCalls: 0,
          winningCalls: 0,
          losingCalls: 0,
          winRate: 0,
          avgReturn: 0,
          totalPnl: 0,
          winStreak: 0,
          maxWinStreak: 0,
          usdcAllocated: 0
        }
      });
    }
    
    return c.json({
      success: true,
      message: 'Scanner created successfully!',
      scanner: {
        id: scanner.id,
        name: scanner.name,
        pubkey: scanner.pubkey,
        active: scanner.active
      },
      checkLeaderboard: 'https://sr-mobile-production.up.railway.app/api/leaderboard'
    });
    
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

export default adminFix;
