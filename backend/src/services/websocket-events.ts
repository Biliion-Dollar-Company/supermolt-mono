/**
 * WebSocket Events Service
 * Broadcast real-time updates to connected clients
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

type FeedChannel = 'godwallet' | 'signals' | 'market' | 'watchlist' | 'tokens' | 'tweets';

const VALID_FEED_CHANNELS = new Set<FeedChannel>([
  'godwallet', 'signals', 'market', 'watchlist', 'tokens', 'tweets',
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
}

class WebSocketEventsService {
  private io: SocketIOServer | null = null;
  private connectedClients = new Map<string, Set<string>>(); // agentId -> set of socketIds

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

    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Subscribe to agent
      socket.on('subscribe:agent', (agentId: string) => {
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

    return this.io;
  }

  broadcastAgentActivity(agentId: string, event: BroadcastEvents['agent:activity']) {
    if (!this.io) return;
    
    this.io.to(`agent:${agentId}`).emit('agent:activity', {
      timestamp: new Date().toISOString(),
      ...event,
    });

    console.log(`[WebSocket] Broadcast agent:activity to agent:${agentId}`);
  }

  broadcastLeaderboardUpdate(update: BroadcastEvents['leaderboard:update']) {
    if (!this.io) return;

    this.io.to('leaderboard:all').emit('leaderboard:update', {
      timestamp: new Date().toISOString(),
      ...update,
    });

    console.log(`[WebSocket] Broadcast leaderboard:update for agent ${update.agentId}`);
  }

  broadcastPriceUpdate(mint: string, update: BroadcastEvents['price:update']) {
    if (!this.io) return;

    this.io.to(`price:${mint}`).emit('price:update', {
      timestamp: new Date().toISOString(),
      ...update,
    });

    console.log(`[WebSocket] Broadcast price:update for ${mint}`);
  }

  broadcastSignalAlert(alert: BroadcastEvents['signal:alert']) {
    if (!this.io) return;

    this.io.emit('signal:alert', {
      timestamp: new Date().toISOString(),
      ...alert,
    });

    console.log(`[WebSocket] Broadcast signal:alert for ${alert.symbol}`);
  }

  broadcastFeedEvent(channel: FeedChannel, data: any): void {
    if (!this.io) return;
    this.io.to(`feed:${channel}`).emit(`feed:${channel}`, data);
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
    if (!this.io) return 0;
    return this.io.engine.clientsCount || 0;
  }

  getActiveRooms(): string[] {
    if (!this.io) return [];
    return Object.keys(this.io.sockets.adapter.rooms);
  }
}

export const websocketEvents = new WebSocketEventsService();
