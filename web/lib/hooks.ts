import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketManager, connectWebSocket, FeedEvent } from './websocket';
import type { UnifiedFeedItem } from './types';

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

/**
 * Hook to listen for trade_recommendation events and subscribe to agent room
 */
export const useTradeRecommendations = (
  agentId: string | null | undefined,
  callback: (event: FeedEvent) => void,
) => {
  // Subscribe to agent room when agentId is available
  useEffect(() => {
    if (!agentId) return;
    const ws = getWebSocketManager();
    ws.subscribeToAgent(agentId);
    return () => {
      ws.unsubscribeFromAgent(agentId);
    };
  }, [agentId]);

  useFeedEvent('trade_recommendation', callback);
};

/**
 * Hook for unified token feed — fetches initial data, subscribes to WebSocket for live updates
 */
export const useTokenFeed = (mint: string | null) => {
  const [items, setItems] = useState<UnifiedFeedItem[]>([]);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Fetch initial feed
  useEffect(() => {
    mountedRef.current = true;
    if (!mint) {
      setItems([]);
      setTypingAgents([]);
      return;
    }

    const fetchFeed = async () => {
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/messaging/tokens/${mint}/feed?limit=30`);
        const json = await res.json();
        if (mountedRef.current && json.success) {
          setItems(json.data.items);
          setNextCursor(json.data.nextCursor);
        }
      } catch {
        // silent
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    fetchFeed();
    return () => { mountedRef.current = false; };
  }, [mint]);

  // Subscribe to WebSocket for live updates
  useEffect(() => {
    if (!mint) return;

    const ws = getWebSocketManager();
    ws.subscribeToTokenFeed(mint);

    const unsubItem = ws.onFeedItem((item: any) => {
      if (item.tokenMint !== mint) return;
      setItems(prev => {
        // Dedupe by id
        if (prev.some(p => p.id === item.id)) return prev;
        return [item, ...prev];
      });
    });

    const unsubTyping = ws.onFeedTyping((data) => {
      if (data.tokenMint !== mint) return;
      setTypingAgents(data.agentNames || []);
    });

    return () => {
      ws.unsubscribeFromTokenFeed(mint);
      unsubItem();
      unsubTyping();
    };
  }, [mint]);

  // Load more (older items)
  const loadMore = useCallback(async () => {
    if (!mint || !nextCursor || isLoading) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/messaging/tokens/${mint}/feed?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      const json = await res.json();
      if (json.success) {
        setItems(prev => {
          const newItems = json.data.items.filter((i: any) => !prev.some(p => p.id === i.id));
          return [...prev, ...newItems];
        });
        setNextCursor(json.data.nextCursor);
      }
    } catch {
      // silent
    }
  }, [mint, nextCursor, isLoading]);

  return { items, typingAgents, isLoading, loadMore, hasMore: !!nextCursor };
};
