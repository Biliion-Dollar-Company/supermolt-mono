/**
 * WebSocket Events Service
 * Broadcast real-time updates to connected clients
 */

import { Server as HTTPServer, IncomingMessage } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { WebSocketServer, WebSocket as RawWebSocket } from 'ws';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { verifyToken } from '../lib/jwt';
import { notifyTradeRecommendation, notifyTradeExecuted, notifyConsensus } from './notification.service';

type FeedChannel = 'godwallet' | 'signals' | 'market' | 'watchlist' | 'tokens' | 'tweets' | 'training';

const VALID_FEED_CHANNELS = new Set<FeedChannel>([
  'godwallet', 'signals', 'market', 'watchlist', 'tokens', 'tweets', 'training',
]);

interface BroadcastEvents {
  'agent:activity': {
    agentId: string;
    action: 'TRADE' | 'DEPLOYMENT' | 'UPDATE';
    data: any;
  };
  'leaderboard:update': {
    agentId: string;
    rank: number;
    sortino: number;
    pnl: number;
  };
  'price:update': {
    mint: string;
    price: number;
    change24h: number;
    volume24h: number;
  };
  'signal:alert': {
    mint: string;
    symbol: string;
    signal: string;
    confidence: number;
  };
  'feed:godwallet': any;
  'feed:signals': any;
  'feed:market': any;
  'feed:watchlist': any;
  'feed:tokens': any;
  'feed:tweets': any;
  'consensus:reached': {
    tokenMint: string;
    tokenSymbol: string;
    walletCount: number;
    timeWindowMinutes: number;
    chain: 'SOLANA' | 'BSC' | 'BASE';
    agentId: string;
    agentName: string;
  };
}

class WebSocketEventsService {
  private io: SocketIOServer | null = null;
  private wss: WebSocketServer | null = null;
  private rawClients = new Set<RawWebSocket>();
  private connectedClients = new Map<string, Set<string>>(); // agentId -> set of socketIds
  private redisPub: Redis | null = null;
  private redisSub: Redis | null = null;

  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:8081',
            'exp://localhost:8081',
            'https://sr-mobile-production.up.railway.app',
          ];
          
          // Allow requests with no origin (mobile apps)
          if (!origin) {
            callback(null, true);
            return;
          }
          
          // Check exact match
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          
          // Allow Vercel deployments
          if (origin.match(/https:\/\/.*\.vercel\.app$/)) {
            callback(null, true);
            return;
          }
          
          callback(new Error('Not allowed by CORS'), false);
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
    });

    this.attachRedisAdapter();

    // Auth middleware: verify JWT if provided, attach user data to socket
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) {
        // Allow unauthenticated connections for public data (leaderboard, prices, feeds)
        (socket as any).userId = null;
        return next();
      }
      try {
        const payload = await verifyToken(token);
        (socket as any).userId = payload.sub;
        return next();
      } catch {
        console.warn(`[WebSocket] Invalid JWT from ${socket.id}, allowing as unauthenticated`);
        (socket as any).userId = null;
        return next();
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      console.log(`[WebSocket] Client connected: ${socket.id} (user: ${userId || 'anonymous'})`);

      // Subscribe to agent — requires authentication
      socket.on('subscribe:agent', (agentId: string) => {
        if (!userId) {
          socket.emit('error', { message: 'Authentication required to subscribe to agent' });
          console.warn(`[WebSocket] ${socket.id} tried subscribe:agent without auth`);
          return;
        }
        if (!this.connectedClients.has(agentId)) {
          this.connectedClients.set(agentId, new Set());
        }
        this.connectedClients.get(agentId)!.add(socket.id);
        socket.join(`agent:${agentId}`);
        console.log(`[WebSocket] ${socket.id} subscribed to agent:${agentId}`);
      });

      // Subscribe to leaderboard updates
      socket.on('subscribe:leaderboard', () => {
        socket.join('leaderboard:all');
        console.log(`[WebSocket] ${socket.id} subscribed to leaderboard`);
      });

      // Subscribe to price updates
      socket.on('subscribe:price', (mint: string) => {
        socket.join(`price:${mint}`);
        console.log(`[WebSocket] ${socket.id} subscribed to price:${mint}`);
      });

      // Subscribe to token feed room (unified activity feed)
      socket.on('subscribe:token', (mint: string) => {
        if (!mint || typeof mint !== 'string') return;
        socket.join(`token:${mint}`);
        console.log(`[WebSocket] ${socket.id} subscribed to token:${mint}`);
      });

      // Subscribe to feed channels (DevPrint market intelligence)
      socket.on('subscribe:feed', (channel: string) => {
        if (!VALID_FEED_CHANNELS.has(channel as FeedChannel)) {
          console.log(`[WebSocket] ${socket.id} tried invalid feed: ${channel}`);
          return;
        }
        socket.join(`feed:${channel}`);
        console.log(`[WebSocket] ${socket.id} subscribed to feed:${channel}`);
      });

      // Unsubscribe
      socket.on('unsubscribe', (room: string) => {
        socket.leave(room);
        console.log(`[WebSocket] ${socket.id} left ${room}`);
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        // Clean up subscriptions
        this.connectedClients.forEach((clients) => {
          clients.delete(socket.id);
        });
      });
    });

    // Raw WebSocket server for mobile clients (connects to /ws)
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: RawWebSocket, request: IncomingMessage) => {
      // Extract token from query param for mobile auth
      const url = new URL(request.url || '/', `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      let wsUserId: string | null = null;

      if (token) {
        verifyToken(token)
          .then((payload) => {
            wsUserId = payload.sub;
            (ws as any).userId = wsUserId;
            console.log(`[WebSocket] Raw WS authenticated: ${wsUserId}`);
          })
          .catch(() => {
            console.warn('[WebSocket] Raw WS invalid token, connected as anonymous');
          });
      }

      this.rawClients.add(ws);
      console.log(`[WebSocket] Raw WS client connected (total: ${this.rawClients.size})`);

      ws.on('close', () => {
        this.rawClients.delete(ws);
        console.log(`[WebSocket] Raw WS client disconnected (total: ${this.rawClients.size})`);
      });

      ws.on('error', () => {
        this.rawClients.delete(ws);
      });
    });

    // Handle HTTP upgrade: route /ws to raw WS, everything else to Socket.IO
    httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
      const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;

      if (pathname === '/ws' && this.wss) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
      // Socket.IO handles its own upgrade via its internal engine
    });

    return this.io;
  }

  private attachRedisAdapter() {
    if (!this.io) return;

    const redisUrl = process.env.WS_REDIS_URL || process.env.REDIS_URL;
    if (!redisUrl) {
      console.log('[WebSocket] Redis adapter disabled (WS_REDIS_URL/REDIS_URL not set)');
      return;
    }

    try {
      this.redisPub = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
      this.redisSub = new Redis(redisUrl, { maxRetriesPerRequest: 2 });

      this.redisPub.on('error', (err) => {
        console.error('[WebSocket] Redis pub error:', err);
      });
      this.redisSub.on('error', (err) => {
        console.error('[WebSocket] Redis sub error:', err);
      });

      this.io.adapter(createAdapter(this.redisPub, this.redisSub));
      console.log('[WebSocket] Redis adapter enabled');
    } catch (error) {
      console.error('[WebSocket] Failed to initialize Redis adapter:', error);
    }
  }

  /** Send JSON to all raw WebSocket clients (mobile) */
  private broadcastRaw(data: object) {
    const json = JSON.stringify(data);
    for (const client of this.rawClients) {
      if (client.readyState === RawWebSocket.OPEN) {
        client.send(json);
      }
    }
  }

  broadcastAgentActivity(agentId: string, event: BroadcastEvents['agent:activity']) {
    if (!this.io) return;

    const payload = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.io.to(`agent:${agentId}`).emit('agent:activity', payload);

    // Also send to raw WS clients (mobile)
    this.broadcastRaw({ type: 'agent:activity', ...payload });

    // Push notification for trade recommendations (fire-and-forget)
    if (event.data?.type === 'trade_recommendation') {
      notifyTradeRecommendation(
        agentId,
        event.data.tokenSymbol || 'Unknown',
        'BUY',
        event.data.reason || 'AI trade recommendation',
      ).catch(() => {});
    } else if (event.data?.type === 'auto_buy_executed') {
      notifyTradeExecuted(
        agentId,
        event.data.tokenSymbol || 'Unknown',
        event.data.action || 'BUY',
        event.data.amount || '?',
      ).catch(() => {});
    }

    console.log(`[WebSocket] Broadcast agent:activity to agent:${agentId}`);
  }

  broadcastLeaderboardUpdate(update: BroadcastEvents['leaderboard:update']) {
    if (!this.io) return;

    const payload = {
      timestamp: new Date().toISOString(),
      ...update,
    };

    this.io.to('leaderboard:all').emit('leaderboard:update', payload);
    this.broadcastRaw({ type: 'leaderboard:update', ...payload });

    console.log(`[WebSocket] Broadcast leaderboard:update for agent ${update.agentId}`);
  }

  broadcastPriceUpdate(mint: string, update: BroadcastEvents['price:update']) {
    if (!this.io) return;

    const payload = {
      timestamp: new Date().toISOString(),
      ...update,
    };

    this.io.to(`price:${mint}`).emit('price:update', payload);
    this.broadcastRaw({ type: 'price_update', tokenMint: mint, ...payload });

    console.log(`[WebSocket] Broadcast price:update for ${mint}`);
  }

  broadcastSignalAlert(alert: BroadcastEvents['signal:alert']) {
    if (!this.io) return;

    const payload = {
      timestamp: new Date().toISOString(),
      ...alert,
    };

    this.io.emit('signal:alert', payload);
    this.broadcastRaw({ type: 'signal:alert', ...payload });

    console.log(`[WebSocket] Broadcast signal:alert for ${alert.symbol}`);
  }

  broadcastConsensusReached(event: BroadcastEvents['consensus:reached']) {
    const payload = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Socket.IO — global emit to all clients
    if (this.io) {
      this.io.emit('consensus:reached', payload);
    }

    // Raw WS — broadcast to mobile clients
    this.broadcastRaw({ type: 'consensus:reached', ...payload });

    // Push notification for consensus (fire-and-forget)
    notifyConsensus(event.agentId, event.tokenSymbol, event.walletCount).catch(() => {});

    console.log(`[WebSocket] Broadcast consensus:reached for ${event.tokenSymbol} (${event.walletCount} wallets)`);
  }

  /** Broadcast a unified feed item to a token room */
  broadcastTokenFeedItem(mint: string, item: any): void {
    if (!this.io) return;
    this.io.to(`token:${mint}`).emit('feed:item', item);
    this.broadcastRaw({ type: 'feed:item', tokenMint: mint, ...item });
  }

  /** Broadcast typing status for a token room */
  broadcastTokenTyping(mint: string, agentNames: string[]): void {
    if (!this.io) return;
    this.io.to(`token:${mint}`).emit('feed:typing', { tokenMint: mint, agentNames });
    this.broadcastRaw({ type: 'feed:typing', tokenMint: mint, agentNames });
  }

  /** Broadcast active agent count for a token room */
  broadcastTokenAgentsActive(mint: string, count: number): void {
    if (!this.io) return;
    this.io.to(`token:${mint}`).emit('feed:agents_active', { tokenMint: mint, count });
    this.broadcastRaw({ type: 'feed:agents_active', tokenMint: mint, count });
  }

  broadcastFeedEvent(channel: FeedChannel, data: any): void {
    if (!this.io) return;
    this.io.to(`feed:${channel}`).emit(`feed:${channel}`, data);
    this.broadcastRaw({ type: `feed:${channel}`, ...data });
  }

  getFeedSubscriberCounts(): Record<string, number> {
    if (!this.io) return {};
    const counts: Record<string, number> = {};
    for (const ch of VALID_FEED_CHANNELS) {
      const room = this.io.sockets.adapter.rooms.get(`feed:${ch}`);
      counts[ch] = room ? room.size : 0;
    }
    return counts;
  }

  getConnectedClientsCount(): number {
    const socketIO = this.io?.engine?.clientsCount || 0;
    return socketIO + this.rawClients.size;
  }

  getActiveRooms(): string[] {
    if (!this.io) return [];
    return Object.keys(this.io.sockets.adapter.rooms);
  }
}

export const websocketEvents = new WebSocketEventsService();
