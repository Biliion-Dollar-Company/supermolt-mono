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
      return c.json({
        success: true,
        message: 'Scanner already exists',
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
