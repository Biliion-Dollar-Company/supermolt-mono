import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import type { AgentProfile, OnboardingTask } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  agent: AgentProfile | null;
  onboardingTasks: OnboardingTask[];
  onboardingProgress: number;
  _hasHydrated: boolean;

  setAuth: (agent: AgentProfile, tasks: OnboardingTask[], progress: number) => void;
  clearAuth: () => void;
  updateAgent: (partial: Partial<AgentProfile>) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      agent: null,
      onboardingTasks: [],
      onboardingProgress: 0,
      _hasHydrated: false,

      setAuth: (agent, tasks, progress) =>
        set({ isAuthenticated: true, agent, onboardingTasks: tasks, onboardingProgress: progress }),

      clearAuth: () =>
        set({ isAuthenticated: false, agent: null, onboardingTasks: [], onboardingProgress: 0 }),

      updateAgent: (partial) =>
        set((state) => ({
          agent: state.agent ? { ...state.agent, ...partial } : null,
        })),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'supermolt-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        agent: state.agent,
        onboardingTasks: state.onboardingTasks,
        onboardingProgress: state.onboardingProgress,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/**
 * SSR-safe hook that returns false during server render and hydration,
 * then returns the real persisted value once localStorage has been read.
 * Prevents hydration mismatch warnings in Next.js.
 */
export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Wait for Zustand to rehydrate from localStorage
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // If already hydrated (fast path)
    if (useAuthStore.getState()._hasHydrated) {
      setHydrated(true);
    }

    return () => {
      unsub();
    };
  }, []);

  return hydrated;
}
