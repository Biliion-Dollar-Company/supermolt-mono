import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface AgentDecision {
  action: 'buy' | 'sell' | 'skip';
  token: string;
  reason: string;
  time: string;
}

export interface AgentStats {
  todayTrades: number;
  winRate: number;
  todayPnl: number;
  avgHoldTime: string;
}

interface AgentState {
  status: 'active' | 'paused' | 'disconnected';
  version: string;
  stats: AgentStats;
  decisions: AgentDecision[];
  isLoading: boolean;

  // Actions
  setStatus: (status: AgentState['status']) => void;
  setStats: (stats: AgentStats) => void;
  addDecision: (decision: AgentDecision) => void;
  clearDecisions: () => void;
  setLoading: (loading: boolean) => void;
}

const initialStats: AgentStats = {
  todayTrades: 0,
  winRate: 0,
  todayPnl: 0,
  avgHoldTime: '0m',
};

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      status: 'disconnected',
      version: 'v1.0.0',
      stats: initialStats,
      decisions: [],
      isLoading: false,

      setStatus: (status) => set({ status }),

      setStats: (stats) => set({ stats }),

      addDecision: (decision) => {
        const decisions = [decision, ...get().decisions].slice(0, 50); // Keep last 50
        set({ decisions });
      },

      clearDecisions: () => set({ decisions: [] }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'agent-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist decisions
        decisions: state.decisions,
      }),
    }
  )
);
