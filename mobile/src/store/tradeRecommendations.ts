import { create } from 'zustand';

export interface TradeRecommendation {
  id: string;
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  suggestedAmount: number;
  chain: 'SOLANA' | 'BSC';
  trigger: string;
  sourceWallet: string;
  reason: string;
  timestamp: number;
}

interface TradeRecommendationStoreState {
  /** Pending recommendations (newest first) */
  pending: TradeRecommendation[];
  /** Push a new recommendation */
  push: (rec: Omit<TradeRecommendation, 'id' | 'timestamp'>) => void;
  /** Dismiss a recommendation by ID */
  dismiss: (id: string) => void;
  /** Clear all */
  clear: () => void;
}

const MAX_PENDING = 10;

export const useTradeRecommendationStore = create<TradeRecommendationStoreState>()(
  (set) => ({
    pending: [],

    push: (rec) =>
      set((state) => ({
        pending: [
          {
            ...rec,
            id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
          },
          ...state.pending,
        ].slice(0, MAX_PENDING),
      })),

    dismiss: (id) =>
      set((state) => ({
        pending: state.pending.filter((r) => r.id !== id),
      })),

    clear: () => set({ pending: [] }),
  }),
);
