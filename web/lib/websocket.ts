import io, { Socket } from 'socket.io-client';
import { getJWT } from './api';

export interface FeedEvent {
  type: 'trade_detected' | 'token_deployed' | 'agent_updated' | 'price_update' |
        'position_opened' | 'position_closed' | 'agent_message' | 'vote_started' | 'vote_cast' |
        'trade_recommendation' | 'auto_buy_executed';
  data: {
    agent_id?: string;
    token_mint?: string;
    action?: 'BUY' | 'SELL';
    amount?: number;
    entry_price?: number;
    timestamp?: string;
    position_id?: string;
    conversation_id?: string;
    message?: string;
    vote_id?: string;
    vote?: 'yes' | 'no';
    [key: string]: any;
  };
}

export interface TradeRecommendation {
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  suggestedAmount: number;
  chain: 'SOLANA' | 'BSC';
  trigger: string;
  sourceWallet: string;
  reason: string;
  timestamp: string;
}

class WebSocketManager {
  private socket: Socket | null = null;
  private url: string;
  private listeners: Map<string, Set<(event: FeedEvent) => void>> = new Map();
  private connected: boolean = false;

  constructor(url: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const token = getJWT();
      this.socket = io(this.url, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        auth: token ? { token } : undefined,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.connected = true;
        console.log('✅ WebSocket connected');
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('❌ WebSocket disconnected');
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      // Listen for all feed events
      this.socket.on('trade_detected', (data) =>
        this.emit('trade_detected', { type: 'trade_detected', data })
      );
      this.socket.on('token_deployed', (data) =>
        this.emit('token_deployed', { type: 'token_deployed', data })
      );
      this.socket.on('agent_updated', (data) =>
        this.emit('agent_updated', { type: 'agent_updated', data })
      );
      this.socket.on('price_update', (data) =>
        this.emit('price_update', { type: 'price_update', data })
      );
      this.socket.on('position_opened', (data) =>
        this.emit('position_opened', { type: 'position_opened', data })
      );
      this.socket.on('position_closed', (data) =>
        this.emit('position_closed', { type: 'position_closed', data })
      );
      this.socket.on('agent_message', (data) =>
        this.emit('agent_message', { type: 'agent_message', data })
      );
      this.socket.on('vote_started', (data) =>
        this.emit('vote_started', { type: 'vote_started', data })
      );
      this.socket.on('vote_cast', (data) =>
        this.emit('vote_cast', { type: 'vote_cast', data })
      );

      // Agent activity events (trade recommendations, auto-buy executed)
      this.socket.on('agent:activity', (data: any) => {
        const eventData = data?.data;
        if (eventData?.type === 'trade_recommendation') {
          this.emit('trade_recommendation', {
            type: 'trade_recommendation',
            data: {
              ...eventData,
              agentId: data.agentId,
              timestamp: data.timestamp,
            },
          });
        } else if (eventData?.type === 'auto_buy_executed') {
          this.emit('auto_buy_executed', {
            type: 'auto_buy_executed',
            data: {
              ...eventData,
              agentId: data.agentId,
              timestamp: data.timestamp,
            },
          });
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  on(eventType: string, callback: (event: FeedEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  private emit(eventType: string, event: FeedEvent): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach((callback) => callback(event));
    }
  }

  // Subscribe to specific event types
  onTradeDetected(callback: (event: FeedEvent) => void): () => void {
    return this.on('trade_detected', callback);
  }

  onTokenDeployed(callback: (event: FeedEvent) => void): () => void {
    return this.on('token_deployed', callback);
  }

  onAgentUpdated(callback: (event: FeedEvent) => void): () => void {
    return this.on('agent_updated', callback);
  }

  onPriceUpdate(callback: (event: FeedEvent) => void): () => void {
    return this.on('price_update', callback);
  }

  onPositionOpened(callback: (event: FeedEvent) => void): () => void {
    return this.on('position_opened', callback);
  }

  onPositionClosed(callback: (event: FeedEvent) => void): () => void {
    return this.on('position_closed', callback);
  }

  onAgentMessage(callback: (event: FeedEvent) => void): () => void {
    return this.on('agent_message', callback);
  }

  onVoteStarted(callback: (event: FeedEvent) => void): () => void {
    return this.on('vote_started', callback);
  }

  onVoteCast(callback: (event: FeedEvent) => void): () => void {
    return this.on('vote_cast', callback);
  }

  onTradeRecommendation(callback: (event: FeedEvent) => void): () => void {
    return this.on('trade_recommendation', callback);
  }

  onAutoBuyExecuted(callback: (event: FeedEvent) => void): () => void {
    return this.on('auto_buy_executed', callback);
  }

  /** Subscribe to a specific agent's activity room */
  subscribeToAgent(agentId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:agent', agentId);
    }
  }

  /** Unsubscribe from an agent's activity room */
  unsubscribeFromAgent(agentId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', `agent:${agentId}`);
    }
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export const getWebSocketManager = (): WebSocketManager => {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
};

export const connectWebSocket = (): Promise<void> => {
  return getWebSocketManager().connect();
};

export const disconnectWebSocket = (): void => {
  getWebSocketManager().disconnect();
};
