import { create } from 'zustand';
import type { FeedItem } from '@/hooks/useTradeFeed';

interface FeedStoreState {
  /** Real-time items pushed via WebSocket (newest first) */
  realtimeItems: FeedItem[];
  pushItem: (item: FeedItem) => void;
  clear: () => void;
}

const MAX_REALTIME = 50;

export const useFeedStore = create<FeedStoreState>()((set) => ({
  realtimeItems: [],

  pushItem: (item) =>
    set((state) => ({
      realtimeItems: [item, ...state.realtimeItems].slice(0, MAX_REALTIME),
    })),

  clear: () => set({ realtimeItems: [] }),
}));
