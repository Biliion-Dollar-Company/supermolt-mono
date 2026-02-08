import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentProfile, OnboardingTask } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  agent: AgentProfile | null;
  onboardingTasks: OnboardingTask[];
  onboardingProgress: number;

  setAuth: (agent: AgentProfile, tasks: OnboardingTask[], progress: number) => void;
  clearAuth: () => void;
  updateAgent: (partial: Partial<AgentProfile>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      agent: null,
      onboardingTasks: [],
      onboardingProgress: 0,

      setAuth: (agent, tasks, progress) =>
        set({ isAuthenticated: true, agent, onboardingTasks: tasks, onboardingProgress: progress }),

      clearAuth: () =>
        set({ isAuthenticated: false, agent: null, onboardingTasks: [], onboardingProgress: 0 }),

      updateAgent: (partial) =>
        set((state) => ({
          agent: state.agent ? { ...state.agent, ...partial } : null,
        })),
    }),
    {
      name: 'supermolt-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        agent: state.agent,
        onboardingTasks: state.onboardingTasks,
        onboardingProgress: state.onboardingProgress,
      }),
    },
  ),
);
