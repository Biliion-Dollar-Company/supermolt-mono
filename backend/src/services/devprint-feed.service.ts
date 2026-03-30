/**
 * DevPrint Feed Service — Trench Terminal Integration Bridge
 *
 * Connects to DevPrint's WebSocket streams and re-broadcasts market intelligence
 * via Socket.IO. Core integration for the detect → deploy → trade → learn loop.
 *
 * Streams:
 *   /ws/tokens   → new token detections + deployment results
 *   /ws/tweets   → celebrity/influencer tweets (signal source)
 *   /ws/training → training progress + outcome labels
 *
 * Pipeline events (deployment results, position updates) are now broadcast
 * to enable agents to react to DevPrint-deployed tokens in real time.
 */

import { websocketEvents } from './websocket-events.js';
import { agentSignalReactor } from './agent-signal-reactor.js';
import { evaluateDeploymentTrigger, type DeploymentEvent } from './trigger-engine.js';

type FeedChannel = 'godwallet' | 'signals' | 'market' | 'watchlist' | 'tokens' | 'tweets' | 'training' | 'deployments' | 'pipeline' | 'positions';

interface StreamConfig {
  name: string;
  path: string;
  connected: boolean;
  ws: WebSocket | null;
  eventCount: number;
  reconnectAttempts: number;
}

// Map event type → feed channel
const EVENT_ROUTING: Record<string, FeedChannel> = {
  // ── Social signals ──
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
  // camelCase variants (DevPrint wire format)
  newTweet: 'tweets',
  newToken: 'tokens',
  godWalletBuy: 'godwallet',
  godWalletSell: 'godwallet',
  signalDetected: 'signals',
  buySignal: 'signals',
  buyRejected: 'signals',
  marketDataUpdated: 'market',
  // ── Pipeline events (detect → deploy → trade → learn) ──
  token_deployed: 'deployments',
  tokenDeployed: 'deployments',
  deployment_result: 'deployments',
  deploymentResult: 'deployments',
  deploy_request: 'pipeline',
  deployRequest: 'pipeline',
  meme_filtered: 'pipeline',
  memeFiltered: 'pipeline',
  concept_generated: 'pipeline',
  conceptGenerated: 'pipeline',
  outcome_labeled: 'pipeline',
  outcomeLabeled: 'pipeline',
  // ── Position tracking (DevPrint trading engine) ──
  position_opened: 'positions',
  position_closed: 'positions',
  take_profit_triggered: 'positions',
  stop_loss_triggered: 'positions',
  positionOpened: 'positions',
  positionClosed: 'positions',
  // ── Filtered (internal only, no broadcast) ──
  // price_update, holdings_snapshot, stats_update, config_updated → handled below
};

// Events that are too noisy to broadcast (high-frequency price ticks)
const FILTERED_EVENTS = new Set([
  'price_update',
  'holdings_snapshot',
  'stats_update',
  'config_updated',
]);

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

    // Filter out position events
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

    // Trigger agent commentary on high-signal events (fire-and-forget)
    const REACTOR_EVENTS = new Set([
      // snake_case
      'signal_detected', 'buy_signal',
      'god_wallet_buy_detected', 'god_wallet_sell_detected',
      'new_token', 'new_tweet',
      'token_deployed', 'deployment_result',
      'position_opened', 'position_closed',
      // camelCase (DevPrint wire format)
      'newTweet', 'newToken', 'godWalletBuy', 'godWalletSell', 'signalDetected', 'buySignal',
      'tokenDeployed', 'deploymentResult',
      'positionOpened', 'positionClosed',
    ]);
    if (REACTOR_EVENTS.has(eventType)) {
      agentSignalReactor.react(eventType, data).catch((err) =>
        console.error('[DevPrintFeed] AgentReactor error:', err),
      );
    }

    // Pipeline deployment events → trigger agent evaluation
    if (channel === 'deployments') {
      const symbol = data.tokenSymbol || data.symbol || 'unknown';
      const mint = data.tokenMint || data.mint;
      console.log(`[DevPrintFeed] 🚀 Token deployed: $${symbol} (${mint || '?'})`);

      // Fire deployment trigger → agents evaluate and potentially trade
      if (mint) {
        const deploymentEvent: DeploymentEvent = {
          tokenMint: mint,
          tokenSymbol: symbol,
          chain: 'SOLANA',
          deployedBy: data.deployedBy || 'pipeline',
          signature: data.signature || data.tx,
          liquidity: data.liquidity,
          marketCap: data.marketCap,
        };
        evaluateDeploymentTrigger(deploymentEvent).catch((err) =>
          console.error('[DevPrintFeed] Deployment trigger error:', err),
        );
      }
    }
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
