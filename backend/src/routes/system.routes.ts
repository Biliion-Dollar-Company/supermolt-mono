/**
 * System Pipeline Status Routes
 *
 * GET /api/system/pipeline-status — Returns health & event counts for all
 *     data ingestion services (Helius WS, DevPrint feeds, Socket.IO, etc.)
 *
 * Public endpoint — no auth required (read-only telemetry).
 */

import { Hono } from 'hono';
import { websocketEvents } from '../services/websocket-events.js';
import { getHeliusMonitor } from '../index.js';

const systemRoutes = new Hono();

// Lazily resolved at runtime so we don't need a circular import for DevPrint
let getDevPrintFeed: (() => import('../services/devprint-feed.service.js').DevPrintFeedService | null) | null = null;

/**
 * Inject the DevPrint feed reference from index.ts at startup time.
 * Called once in index.ts after the service is instantiated.
 */
export function setDevPrintFeedGetter(
    getter: () => import('../services/devprint-feed.service.js').DevPrintFeedService | null,
) {
    getDevPrintFeed = getter;
}

/**
 * GET /api/system/pipeline-status
 *
 * Returns a snapshot of every data-ingestion & processing service:
 *   - connected / disconnected
 *   - event count since last restart
 *   - Socket.IO connected client count
 *   - Helius tracked-wallet count
 *   - DevPrint stream health per channel
 */
systemRoutes.get('/pipeline-status', async (c) => {
    // ── Helius WebSocket ─────────────────────────────────────────
    const helius = getHeliusMonitor();

    // ── DevPrint Feed ────────────────────────────────────────────
    const devprint = getDevPrintFeed?.();
    const devprintStatus = devprint?.getStatus() ?? {};

    // Aggregate devprint event counts
    const devprintEvents = Object.values(devprintStatus).reduce(
        (sum, s) => sum + (s.events ?? 0),
        0,
    );
    const devprintConnected = Object.values(devprintStatus).some((s) => s.connected);

    // ── Socket.IO ────────────────────────────────────────────────
    const socketClients = websocketEvents.getConnectedClientsCount();
    const feedSubscribers = websocketEvents.getFeedSubscriberCounts();

    // ── Build response ───────────────────────────────────────────
    return c.json({
        success: true,
        timestamp: new Date().toISOString(),
        services: {
            helius: {
                connected: helius?.isRunning() ?? false,
                trackedWallets: helius?.getTrackedWalletCount() ?? 0,
            },
            devprint: {
                connected: devprintConnected,
                events: devprintEvents,
                streams: devprintStatus,
            },
            twitter: {
                // Twitter API is stateless request/response — "connected" means key is set
                connected: !!process.env.TWITTER_API_KEY,
            },
            dexscreener: {
                // DexScreener is also stateless — always considered available
                connected: true,
            },
            socketio: {
                connected: true,
                clients: socketClients,
                feedSubscribers,
            },
            redis: {
                connected: !!(process.env.WS_REDIS_URL || process.env.REDIS_URL),
            },
            llm: {
                connected: !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
            },
            sortinoCron: {
                enabled: (process.env.ENABLE_SORTINO_CRON ?? 'true').toLowerCase() === 'true',
            },
        },
    });
});

/**
 * PATCH /api/system/agent-config
 *
 * Persist agent trading configuration (risk level, position size, TP/SL, etc.)
 * into the agent's JSON `config` column.
 *
 * Requires agent JWT.
 */
systemRoutes.patch('/agent-config', async (c) => {
    // Inline JWT check (same pattern as agent-auth routes)
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ success: false, error: 'Authorization required' }, 401);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return c.json({ success: false, error: 'Server configuration error' }, 500);
    }

    try {
        const jose = await import('jose');
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jose.jwtVerify(authHeader.slice(7), secret);

        if (payload.type !== 'agent') {
            return c.json({ success: false, error: 'Invalid token type' }, 401);
        }

        const agentId = payload.agentId as string;

        const body = await c.req.json();
        const { riskLevel, maxPositionSize, takeProfitPercent, stopLossPercent, aggression, enabledFeeds } = body;

        // Merge into existing config
        const { db } = await import('../lib/db');
        const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
        if (!agent) {
            return c.json({ success: false, error: 'Agent not found' }, 404);
        }

        const existingConfig = (typeof agent.config === 'object' && agent.config !== null) ? agent.config as Record<string, unknown> : {};

        const tradingConfig: Record<string, unknown> = {};
        if (riskLevel !== undefined) tradingConfig.riskLevel = riskLevel;
        if (maxPositionSize !== undefined) tradingConfig.maxPositionSize = maxPositionSize;
        if (takeProfitPercent !== undefined) tradingConfig.takeProfitPercent = takeProfitPercent;
        if (stopLossPercent !== undefined) tradingConfig.stopLossPercent = stopLossPercent;
        if (aggression !== undefined) tradingConfig.aggression = aggression;
        if (enabledFeeds !== undefined) tradingConfig.enabledFeeds = enabledFeeds;

        const updatedConfig = {
            ...existingConfig,
            tradingConfig: {
                ...(existingConfig.tradingConfig as Record<string, unknown> ?? {}),
                ...tradingConfig,
                updatedAt: new Date().toISOString(),
            },
        };

        await db.tradingAgent.update({
            where: { id: agentId },
            data: { config: updatedConfig },
        });

        console.log(`[System] Agent ${agentId} config updated:`, tradingConfig);

        return c.json({
            success: true,
            data: {
                agentId,
                tradingConfig: updatedConfig.tradingConfig,
            },
        });
    } catch (error: any) {
        if (error.code === 'ERR_JWT_EXPIRED' || error.code === 'ERR_JWS_INVALID') {
            return c.json({ success: false, error: 'Invalid or expired token' }, 401);
        }
        console.error('[System] Config update error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export { systemRoutes };
