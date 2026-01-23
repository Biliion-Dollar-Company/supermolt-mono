import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePortfolioStore } from '@/store/portfolio';
import { useAgentStore } from '@/store/agent';

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

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://devprint-v2-production.up.railway.app/ws';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const updatePositions = usePortfolioStore((state) => state.updatePositions);
  const addDecision = useAgentStore((state) => state.addDecision);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (ws?.readyState === WebSocket.OPEN) return;

    console.log('[WS] Connecting to:', WS_URL);
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      setReconnectAttempts(0);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        handleMessage(data);
      } catch (error) {
        console.error('[WS] Parse error:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    socket.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      setIsConnected(false);
      setWs(null);

      // Attempt reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          setReconnectAttempts((prev) => prev + 1);
          connect();
        }, RECONNECT_DELAY);
      }
    };

    setWs(socket);
  }, [reconnectAttempts]);

  // Handle incoming messages
  const handleMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'holdings_snapshot':
          updatePositions(data.holdings);
          break;

        case 'price_update':
          // Update specific position price
          break;

        case 'take_profit_triggered':
          // Show notification, haptic feedback
          console.log('[WS] TP Triggered:', data);
          break;

        case 'trade_executed':
          // Add to feed, update positions
          console.log('[WS] Trade executed:', data);
          break;

        case 'agent_decision':
          addDecision({
            action: data.action,
            token: data.token,
            reason: data.reason,
            time: new Date().toLocaleTimeString(),
          });
          break;

        default:
          console.log('[WS] Unknown message type:', data.type);
      }
    },
    [updatePositions, addDecision]
  );

  // Send message
  const send = useCallback(
    (message: any) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        console.warn('[WS] Cannot send - not connected');
      }
    },
    [ws]
  );

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (ws) {
      ws.close();
    }
    setReconnectAttempts(0);
    connect();
  }, [ws, connect]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      ws?.close();
    };
  }, []);

  // Handle app state changes (reconnect when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active' && !isConnected) {
          reconnect();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isConnected, reconnect]);

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
