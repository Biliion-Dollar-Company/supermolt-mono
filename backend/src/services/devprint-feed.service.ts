/**
 * DevPrint Feed Service
 * Connects to DevPrint's WebSocket streams and re-broadcasts raw market intelligence
 * via SuperMolt's Socket.IO. Agents subscribe to channels they care about.
 *
 * Streams:
 *   /ws/tokens   → new token detections
 *   /ws/tweets   → celebrity/influencer tweets
 *   /ws/training → training progress updates
 *
 * Filtered out (SuperRouter private):
 *   position_opened, position_closed, price_update,
 *   take_profit_triggered, stop_loss_triggered,
 *   holdings_snapshot, stats_update, config_updated
 */

import { websocketEvents } from './websocket-events.js';

type FeedChannel = 'godwallet' | 'signals' | 'market' | 'watchlist' | 'tokens' | 'tweets' | 'training';

interface StreamConfig {
  name: string;
  path: string;
  connected: boolean;
  ws: WebSocket | null;
  eventCount: number;
  reconnectAttempts: number;
}

// SuperRouter position events — NEVER broadcast
const FILTERED_EVENTS = new Set([
  'position_opened',
  'position_closed',
  'price_update',
  'take_profit_triggered',
  'stop_loss_triggered',
  'holdings_snapshot',
  'stats_update',
  'config_updated',
]);

// Map event type → feed channel
const EVENT_ROUTING: Record<string, FeedChannel> = {
  god_wallet_buy_detected: 'godwallet',
  god_wallet_sell_detected: 'godwallet',
  signal_detected: 'signals',
  buy_signal: 'signals',
  buy_rejected: 'signals',
  market_data_updated: 'market',
  watchlist_added: 'watchlist',
  watchlist_updated: 'watchlist',
  watchlist_graduated: 'watchlist',
  watchlist_removed: 'watchlist',
  new_token: 'tokens',
  new_tweet: 'tweets',
  training_progress: 'training',
  training_log: 'training',
  training_complete: 'training',
  training_started: 'training',
};

const BASE_RECONNECT_MS = 5_000;
const MAX_RECONNECT_MS = 30_000;

export class DevPrintFeedService {
  private baseUrl: string;
  private streams: Map<string, StreamConfig> = new Map();
  private running = false;

  constructor(wsUrl: string) {
    // Strip trailing slash
    this.baseUrl = wsUrl.replace(/\/$/, '');

    // Initialize stream configs
    const paths: Array<[string, string]> = [
      ['tokens', '/ws/tokens'],
      ['tweets', '/ws/tweets'],
      ['training', '/ws/training'],
    ];

    for (const [name, path] of paths) {
      this.streams.set(name, {
        name,
        path,
        connected: false,
        ws: null,
        eventCount: 0,
        reconnectAttempts: 0,
      });
    }
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`[DevPrintFeed] Connecting to ${this.baseUrl} (${this.streams.size} streams)`);

    for (const stream of this.streams.values()) {
      this.connectStream(stream);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('[DevPrintFeed] Shutting down all streams');

    for (const stream of this.streams.values()) {
      if (stream.ws) {
        stream.ws.close();
        stream.ws = null;
        stream.connected = false;
      }
    }
  }

  getStatus(): Record<string, { connected: boolean; events: number }> {
    const status: Record<string, { connected: boolean; events: number }> = {};
    for (const [name, stream] of this.streams) {
      status[name] = { connected: stream.connected, events: stream.eventCount };
    }
    return status;
  }

  private connectStream(stream: StreamConfig): void {
    if (!this.running) return;

    const url = `${this.baseUrl}${stream.path}`;
    console.log(`[DevPrintFeed] Connecting stream: ${stream.name} → ${url}`);

    try {
      const ws = new WebSocket(url);
      stream.ws = ws;

      ws.onopen = () => {
        stream.connected = true;
        stream.reconnectAttempts = 0;
        console.log(`[DevPrintFeed] ${stream.name} stream connected`);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(typeof event.data === 'string' ? event.data : '');
          this.handleEvent(stream, data);
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onclose = (event: CloseEvent) => {
        stream.connected = false;
        stream.ws = null;
        console.log(`[DevPrintFeed] ${stream.name} stream closed (${event.code})`);
        this.scheduleReconnect(stream);
      };

      ws.onerror = (event: Event) => {
        stream.connected = false;
        console.error(`[DevPrintFeed] ${stream.name} stream error`);
        // onclose will fire after onerror, triggering reconnect
      };
    } catch (err) {
      console.error(`[DevPrintFeed] Failed to create WebSocket for ${stream.name}:`, err);
      this.scheduleReconnect(stream);
    }
  }

  private handleEvent(stream: StreamConfig, data: any): void {
    // Determine event type — DevPrint messages use `type` or `event` field
    const eventType: string | undefined = data.type || data.event;
    if (!eventType) return;

    // Filter out SuperRouter position events
    if (FILTERED_EVENTS.has(eventType)) return;

    // Route to feed channel
    const channel = EVENT_ROUTING[eventType];
    if (!channel) return; // Unknown event type, skip

    stream.eventCount++;

    // Log periodically (every 100 events per stream)
    if (stream.eventCount % 100 === 0) {
      console.log(`[DevPrintFeed] ${stream.name}: ${stream.eventCount} events relayed`);
    }

    // Broadcast via Socket.IO
    websocketEvents.broadcastFeedEvent(channel, {
      type: eventType,
      timestamp: data.timestamp || new Date().toISOString(),
      ...data,
    });
  }

  private scheduleReconnect(stream: StreamConfig): void {
    if (!this.running) return;

    stream.reconnectAttempts++;
    const delay = Math.min(
      BASE_RECONNECT_MS * Math.pow(2, stream.reconnectAttempts - 1),
      MAX_RECONNECT_MS
    );

    console.log(
      `[DevPrintFeed] Reconnecting ${stream.name} in ${delay / 1000}s (attempt ${stream.reconnectAttempts})`
    );

    setTimeout(() => {
      if (this.running) {
        this.connectStream(stream);
      }
    }, delay);
  }
}
