/**
 * Referral Routes
 * GET  /referral/my-code  — get your referral code + stats
 * POST /referral/use      — record a referral on signup
 * GET  /referral/stats    — get referral stats
 */

import { Hono } from 'hono';
import { db } from '../lib/db';
import { verifyToken } from '../lib/jwt';

const referralRoutes = new Hono();

function generateCode(agentId: string): string {
  return 'SM-' + agentId.slice(-6).toUpperCase();
}

async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  try {
    const payload = await verifyToken(authHeader.substring(7));
    if (!payload.agentId) {
      return c.json({ success: false, error: 'Agent JWT required' }, 403);
    }
    c.set('agentId', payload.agentId);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
}

// GET /referral/my-code — get your referral code and referral count
referralRoutes.get('/my-code', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId') as string;
    const code = generateCode(agentId);

    const referralCount = await db.referral.count({
      where: { referrerId: agentId },
    });

    const convertedCount = await db.referral.count({
      where: { referrerId: agentId, status: 'CONVERTED' },
    });

    return c.json({
      success: true,
      data: { code, referralCount, convertedCount },
    });
  } catch (error) {
    console.error('[Referral] my-code error:', error);
    return c.json({ success: false, error: 'Failed to get referral code' }, 500);
  }
});

// POST /referral/use — record a referral (called after signup)
referralRoutes.post('/use', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId') as string;
    const body = await c.req.json();
    const { code } = body as { code: string };

    if (!code || !code.startsWith('SM-')) {
      return c.json({ success: false, error: 'Invalid referral code' }, 400);
    }

    // Find the referrer by checking all agents for a matching code
    const allAgents = await db.tradingAgent.findMany({
      select: { id: true },
    });

    const referrer = allAgents.find(a => generateCode(a.id) === code);
    if (!referrer) {
      return c.json({ success: false, error: 'Referral code not found' }, 404);
    }

    // Can't refer yourself
    if (referrer.id === agentId) {
      return c.json({ success: false, error: 'Cannot use your own referral code' }, 400);
    }

    // Create referral (unique constraint prevents duplicates)
    try {
      await db.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId: agentId,
          code,
          status: 'CONVERTED',
          convertedAt: new Date(),
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        return c.json({ success: false, error: 'Referral already recorded' }, 409);
      }
      throw e;
    }

    return c.json({ success: true, data: { message: 'Referral recorded' } });
  } catch (error) {
    console.error('[Referral] use error:', error);
    return c.json({ success: false, error: 'Failed to record referral' }, 500);
  }
});

// GET /referral/stats — get referral stats (auth required)
referralRoutes.get('/stats', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId') as string;

    const [total, converted] = await Promise.all([
      db.referral.count({ where: { referrerId: agentId } }),
      db.referral.count({ where: { referrerId: agentId, status: 'CONVERTED' } }),
    ]);

    return c.json({
      success: true,
      data: { totalReferrals: total, convertedReferrals: converted },
    });
  } catch (error) {
    console.error('[Referral] stats error:', error);
    return c.json({ success: false, error: 'Failed to get stats' }, 500);
  }
});

export { referralRoutes };
