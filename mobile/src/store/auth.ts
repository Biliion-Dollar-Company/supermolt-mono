import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgentProfile, OnboardingProgress, UserAgent } from '@/types/arena';

interface AuthStoreState {
  // Active agent (from /arena/me)
  agentProfile: AgentProfile | null;
  onboarding: OnboardingProgress | null;
  stats: {
    sortinoRatio: number;
    maxDrawdown: number;
    totalPnl: number;
    totalTrades: number;
    winRate: number;
  } | null;

  // Multi-agent
  activeAgentId: string | null;
  agents: UserAgent[];

  setAgentMe: (data: {
    agent: AgentProfile;
    stats: AuthStoreState['stats'];
    onboarding: OnboardingProgress;
  }) => void;
  setActiveAgentId: (id: string) => void;
  setAgents: (agents: UserAgent[]) => void;
  addAgent: (agent: UserAgent) => void;
  removeAgent: (agentId: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      agentProfile: null,
      onboarding: null,
      stats: null,
      activeAgentId: null,
      agents: [],

      setAgentMe: ({ agent, stats, onboarding }) =>
        set({ agentProfile: agent, stats, onboarding, activeAgentId: agent.id }),

      setActiveAgentId: (id) =>
        set({ activeAgentId: id }),

      setAgents: (agents) =>
        set({ agents }),

      addAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),

      removeAgent: (agentId) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== agentId),
        })),

      clear: () =>
        set({
          agentProfile: null,
          stats: null,
          onboarding: null,
          activeAgentId: null,
          agents: [],
        }),
    }),
    {
      name: 'auth-agent-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
