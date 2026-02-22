import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePortfolioStore } from '@/store/portfolio';
import { useAgentLiveStore } from '@/store/agentLive';
import { useFeedStore } from '@/store/feed';
import { useTradeRecommendationStore } from '@/store/tradeRecommendations';
import { getAccessToken } from '@/lib/api/client';
import { successNotification, mediumImpact } from '@/lib/haptics';

// Types
interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: any;
  send: (message: any) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: ReactNode;
}

// Derive WS URL from API URL: https://foo.bar → wss://foo.bar/ws
const API_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3001' : '');
const BASE_WS_URL = process.env.EXPO_PUBLIC_WS_URL || (API_URL ? API_URL.replace(/^http/, 'ws') + '/ws' : '');
const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000; // Keep connection alive through Railway proxy

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Store selectors (stable refs — Zustand selectors don't change)
  const updatePositions = usePortfolioStore((s) => s.updatePositions);
  const updatePosition = usePortfolioStore((s) => s.updatePosition);
  const addDecision = useAgentLiveStore((s) => s.addDecision);
  const pushFeedItem = useFeedStore((s) => s.pushItem);
  const pushRecommendation = useTradeRecommendationStore((s) => s.push);

  // Handle incoming messages
  const handleMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'holdings_snapshot':
          updatePositions(data.holdings);
          break;

        case 'price_update':
          if (data.tokenMint && data.price != null) {
            const positions = usePortfolioStore.getState().positions;
            const pos = positions.find((p) => p.tokenMint === data.tokenMint);
            if (pos) {
              const currentPrice = Number(data.price);
              const currentValueSol = pos.quantity * currentPrice;
              const unrealizedPnlSol = currentValueSol - pos.entrySol;
              const unrealizedPnlPct = pos.entrySol > 0 ? (unrealizedPnlSol / pos.entrySol) * 100 : 0;
              updatePosition(pos.id, { currentPrice, currentValueSol, unrealizedPnlSol, unrealizedPnlPct });
            }
          }
          break;

        case 'take_profit_triggered':
          console.log('[WS] TP Triggered:', data);
          successNotification();
          break;

        case 'trade_executed':
          console.log('[WS] Trade executed:', data);
          if (data.action && (data.token || data.tokenSymbol)) {
            const sym = data.tokenSymbol || data.token || 'Token';
            const agent = data.agentName || 'Agent';
            const reason = data.reason || `${data.action} executed`;
            addDecision({
              action: data.action === 'BUY' ? 'buy' : data.action === 'SELL' ? 'sell' : 'skip',
              token: sym,
              reason,
              time: new Date().toLocaleTimeString(),
            });
            pushFeedItem({
              id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'trade',
              title: `${agent} ${data.action === 'BUY' ? 'bought' : 'sold'} $${sym}`,
              description: reason,
              time: 'just now',
              timestamp: Date.now(),
              action: data.action,
              agentName: data.agentName,
              tokenSymbol: sym,
            });
          }
          break;

        case 'agent_decision':
          addDecision({
            action: data.action,
            token: data.token,
            reason: data.reason,
            time: new Date().toLocaleTimeString(),
          });
          break;

        case 'trade_recommendation': {
          mediumImpact();
          pushRecommendation({
            agentId: data.agentId || '',
            tokenMint: data.tokenMint || '',
            tokenSymbol: data.tokenSymbol || 'Unknown',
            suggestedAmount: data.suggestedAmount || data.amount || 0,
            chain: data.chain || 'SOLANA',
            trigger: data.trigger || 'auto',
            sourceWallet: data.sourceWallet || '',
            reason: data.reason || 'AI trade recommendation',
          });
          break;
        }

        case 'consensus:reached': {
          successNotification();
          const sym = data.tokenSymbol || 'Unknown';
          const count = data.walletCount || 0;
          const reason = `${count} wallets converged on $${sym} within ${data.timeWindowMinutes || 60}m`;
          addDecision({
            action: 'buy',
            token: sym,
            reason,
            time: new Date().toLocaleTimeString(),
          });
          pushFeedItem({
            id: `ws-consensus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'trade',
            title: `CONSENSUS on $${sym}`,
            description: reason,
            time: 'just now',
            timestamp: Date.now(),
            action: 'BUY' as const,
            agentName: data.agentName || 'Arena',
            tokenSymbol: sym,
          });
          break;
        }

        case 'agent:activity': {
          const innerData = data.data;
          if (!innerData) break;

          if (innerData.type === 'trade_recommendation') {
            mediumImpact();
            pushRecommendation({
              agentId: data.agentId || '',
              tokenMint: innerData.tokenMint || '',
              tokenSymbol: innerData.tokenSymbol || 'Unknown',
              suggestedAmount: innerData.suggestedAmount || 0,
              chain: innerData.chain || 'SOLANA',
              trigger: innerData.trigger || 'auto',
              sourceWallet: innerData.sourceWallet || '',
              reason: innerData.reason || 'AI trade recommendation',
            });
          } else if (innerData.type === 'auto_buy_executed') {
            const sym = innerData.tokenSymbol || 'Token';
            const agent = data.agentName || innerData.agentName || 'Agent';
            const trigger = innerData.trigger || 'auto';
            const reason = innerData.reason || `Auto-buy via ${trigger}`;
            successNotification();
            addDecision({
              action: 'buy',
              token: sym,
              reason,
              time: new Date().toLocaleTimeString(),
            });
            pushFeedItem({
              id: `ws-ab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'trade',
              title: `${agent} auto-bought $${sym}`,
              description: reason,
              time: 'just now',
              timestamp: Date.now(),
              action: 'BUY',
              agentName: agent,
              tokenSymbol: sym,
            });
          }
          break;
        }

        default:
          // Silently ignore unknown types
          break;
      }
    },
    [updatePositions, updatePosition, addDecision, pushFeedItem, pushRecommendation]
  );

  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect to WebSocket (ref-based, no stale closures)
  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (!BASE_WS_URL) return;

    // Build URL with auth token if available
    let wsUrl = BASE_WS_URL;
    try {
      const token = await getAccessToken();
      if (token) {
        wsUrl = `${BASE_WS_URL}?token=${encodeURIComponent(token)}`;
      }
    } catch {
      // Connect without token — server accepts anonymous
    }

    console.log(`[WS] Connecting (attempt ${attemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WS] Connected');
      attemptsRef.current = 0;
      if (mountedRef.current) setIsConnected(true);

      // Keep alive — Railway proxy closes idle connections after ~60s
      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return; // Ignore keepalive responses
        if (mountedRef.current) setLastMessage(data);
        handleMessage(data);
      } catch {
        // ignore parse errors
      }
    };

    socket.onerror = () => {
      // Silent — onclose will handle reconnect
    };

    socket.onclose = () => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      if (!mountedRef.current) return;
      setIsConnected(false);
      wsRef.current = null;

      if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        attemptsRef.current += 1;
        const delay = RECONNECT_DELAY * Math.pow(2, attemptsRef.current - 1);
        console.log(`[WS] Closed. Reconnecting in ${Math.round(delay / 1000)}s (${attemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
        reconnectTimerRef.current = setTimeout(connect, delay);
      } else {
        console.log('[WS] Max reconnect attempts reached, stopped');
      }
    };

    wsRef.current = socket;
  }, [handleMessage]);

  // Send message
  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    attemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [connect]);

  // Reconnect when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && !wsRef.current) {
        attemptsRef.current = 0;
        connect();
      }
    });
    return () => sub.remove();
  }, [connect]);

  const value: WebSocketContextType = {
    isConnected,
    lastMessage,
    send,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
