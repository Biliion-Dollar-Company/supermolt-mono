import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface TargetHit {
  targetLevel: number;
  targetMultiplier: number;
  soldQuantity: number;
  soldPrice: number;
  soldTime: string;
  realizedSol: number;
}

export interface Position {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  entrySol: number;
  currentValueSol: number;
  unrealizedPnlPct: number;
  unrealizedPnlSol: number;
  targetsHit: TargetHit[];
  nextTargetMultiplier: number | null;
  targetProgress: number | null;
  buyCount: number;
  sellCount: number;
  createdAt: string;
}

interface PortfolioState {
  positions: Position[];
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  updatePositions: (positions: Position[]) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  positions: [],
  totalValue: 0,
  totalPnl: 0,
  totalPnlPct: 0,
  isLoading: false,
  error: null,
};

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      ...initialState,

      updatePositions: (positions) => {
        const totalValue = positions.reduce(
          (sum, p) => sum + p.currentValueSol,
          0
        );
        const totalEntry = positions.reduce((sum, p) => sum + p.entrySol, 0);
        const totalPnl = totalValue - totalEntry;
        const totalPnlPct = totalEntry > 0 ? (totalPnl / totalEntry) * 100 : 0;

        set({
          positions,
          totalValue,
          totalPnl,
          totalPnlPct,
          isLoading: false,
          error: null,
        });
      },

      updatePosition: (id, updates) => {
        const positions = get().positions.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        );
        get().updatePositions(positions);
      },

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error, isLoading: false }),

      reset: () => set(initialState),
    }),
    {
      name: 'portfolio-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist positions, not loading/error state
        positions: state.positions,
        totalValue: state.totalValue,
        totalPnl: state.totalPnl,
        totalPnlPct: state.totalPnlPct,
      }),
    }
  )
);
