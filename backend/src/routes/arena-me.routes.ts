/**
 * Arena Me Routes
 *
 * GET /arena/me — JWT-protected endpoint returning the authenticated
 * agent's profile, XP, stats, and onboarding progress.
 */

import { Hono } from 'hono';
import { Context, Next } from 'hono';
import * as jose from 'jose';
import { getLevelName, getXPForNextLevel, getOnboardingProgress } from '../services/onboarding.service';
import { db } from '../lib/db';
const arenaMeRoutes = new Hono();

const JWT_SECRET = process.env.JWT_SECRET;

async function agentJwtMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Authorization required' }, 401);
  }

  const token = authHeader.slice(7);
  if (!JWT_SECRET) {
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    if (payload.type !== 'agent') {
      return c.json({ success: false, error: 'Invalid token type' }, 401);
    }

    c.set('agentId', payload.agentId as string);
    c.set('agentPubkey', payload.sub as string);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
}

arenaMeRoutes.get('/me', agentJwtMiddleware, async (c) => {
  try {
    const agentId = c.get('agentId');

    const agent = await db.tradingAgent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        userId: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        twitterHandle: true,
        status: true,
        archetypeId: true,
        xp: true,
        level: true,
        totalTrades: true,
        winRate: true,
        totalPnl: true,
        config: true,
        createdAt: true,
      },
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    // Get stats from AgentStats table + prediction stats in parallel
    const [stats, predictionStats, onboarding] = await Promise.all([
      db.agentStats.findUnique({
        where: { agentId },
        select: {
          sortinoRatio: true,
          maxDrawdown: true,
          totalPnl: true,
          totalTrades: true,
          winRate: true,
        },
      }),
      db.predictionStats.findUnique({
        where: { agentId },
      }),
      getOnboardingProgress(agentId),
    ]);

    const config = agent?.config as Record<string, unknown> | null;
    const walletOverride = config && typeof config.walletAddress === 'string' ? config.walletAddress : null;

    return c.json({
      success: true,
      agent: {
        id: agent.id,
        pubkey: walletOverride || agent.userId,
        name: agent.displayName || agent.name,
        avatarUrl: agent.avatarUrl,
        bio: agent.bio,
        twitterHandle: agent.twitterHandle,
        status: agent.status,
        xp: agent.xp,
        level: agent.level,
        levelName: getLevelName(agent.level),
        xpForNextLevel: getXPForNextLevel(agent.level),
        totalTrades: agent.totalTrades,
        winRate: Number(agent.winRate),
        totalPnl: Number(agent.totalPnl),
        onboardingComplete: onboarding.progress === 100,
        createdAt: agent.createdAt,
      },
      stats: stats
        ? {
            sortinoRatio: Number(stats.sortinoRatio),
            maxDrawdown: Number(stats.maxDrawdown),
            totalPnl: Number(stats.totalPnl),
            totalTrades: stats.totalTrades,
            winRate: Number(stats.winRate),
          }
        : null,
      predictionStats: predictionStats
        ? {
            totalPredictions: predictionStats.totalPredictions,
            correctPredictions: predictionStats.correctPredictions,
            accuracy: Number(predictionStats.accuracy),
            brierScore: Number(predictionStats.brierScore),
            roi: Number(predictionStats.roi),
            streak: predictionStats.streak,
            bestStreak: predictionStats.bestStreak,
          }
        : null,
      onboarding,
    });
  } catch (error: any) {
    console.error('Arena me error:', error);
    return c.json({ success: false, error: 'Failed to load agent data' }, 500);
  }
});

export default arenaMeRoutes;
