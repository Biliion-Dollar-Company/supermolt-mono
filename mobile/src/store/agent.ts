import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types matching SR-Mobile backend schema
export interface Agent {
  id: string;
  userId: string;
  archetypeId: string;
  name: string;
  status: 'TRAINING' | 'ACTIVE' | 'PAUSED';
  paperBalance: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackStats {
  total: number;
  good: number;
  bad: number;
  skip: number;
  pendingFeedback: number;
}

interface MyAgentState {
  agent: Agent | null;
  hasChecked: boolean;

  // Actions
  setAgent: (agent: Record<string, unknown> | null) => void;
  setHasChecked: (checked: boolean) => void;
  clearAgent: () => void;
}

export const useMyAgentStore = create<MyAgentState>()(
  persist(
    (set) => ({
      agent: null,
      hasChecked: false,

      setAgent: (raw) => {
        if (!raw) {
          set({ agent: null });
          return;
        }
        const agent: Agent = {
          id: raw.id as string,
          userId: raw.userId as string,
          archetypeId: raw.archetypeId as string,
          name: raw.name as string,
          status: (raw.status as Agent['status']) || 'TRAINING',
          paperBalance: Number(raw.paperBalance) || 10,
          totalTrades: Number(raw.totalTrades) || 0,
          winRate: Number(raw.winRate) || 0,
          totalPnl: Number(raw.totalPnl) || 0,
          config: (raw.config as Record<string, unknown>) || {},
          createdAt: (raw.createdAt as string) || new Date().toISOString(),
          updatedAt: (raw.updatedAt as string) || new Date().toISOString(),
        };
        set({ agent, hasChecked: true });
      },

      setHasChecked: (hasChecked) => set({ hasChecked }),

      clearAgent: () => set({ agent: null, hasChecked: false }),
    }),
    {
      name: 'my-agent-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        agent: state.agent,
        hasChecked: state.hasChecked,
      }),
    },
  ),
);
