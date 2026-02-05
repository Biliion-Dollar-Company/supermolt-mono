import { useEffect, useState, useCallback } from 'react';
import { getWebSocketManager, connectWebSocket, FeedEvent } from './websocket';

/**
 * Hook to connect WebSocket on mount and disconnect on unmount
 */
export const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        await connectWebSocket();
        setConnected(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect WebSocket');
        setConnected(false);
      }
    };

    connect();

    const ws = getWebSocketManager();
    const checkInterval = setInterval(() => {
      setConnected(ws.isConnected());
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  return { connected, error };
};

/**
 * Hook to listen for specific feed events
 */
export const useFeedEvent = (eventType: string, callback: (event: FeedEvent) => void) => {
  useEffect(() => {
    const ws = getWebSocketManager();
    const unsubscribe = ws.on(eventType, callback);

    return unsubscribe;
  }, [eventType, callback]);
};

/**
 * Hook to listen for trade_detected events
 */
export const useTradeDetected = (callback: (event: FeedEvent) => void) => {
  useFeedEvent('trade_detected', callback);
};

/**
 * Hook to listen for token_deployed events
 */
export const useTokenDeployed = (callback: (event: FeedEvent) => void) => {
  useFeedEvent('token_deployed', callback);
};

/**
 * Hook to listen for agent_updated events
 */
export const useAgentUpdated = (callback: (event: FeedEvent) => void) => {
  useFeedEvent('agent_updated', callback);
};

/**
 * Hook to listen for price_update events
 */
export const usePriceUpdate = (callback: (event: FeedEvent) => void) => {
  useFeedEvent('price_update', callback);
};
