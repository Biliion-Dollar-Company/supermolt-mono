import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TourStep = 'home' | 'arena' | 'agents' | 'complete' | null;

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OnboardingStore {
  hasCompletedOnboarding: boolean;
  tourStep: TourStep;
  /** Ephemeral — not persisted. Set by useTourTarget hook. */
  spotlightRect: SpotlightRect | null;
  startTour: () => void;
  advanceTour: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setSpotlight: (rect: SpotlightRect | null) => void;
}

const TOUR_SEQUENCE: TourStep[] = ['home', 'arena', 'agents', 'complete'];

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      tourStep: null,
      spotlightRect: null,

      startTour: () => set({ tourStep: 'home', spotlightRect: null }),

      advanceTour: () => {
        const current = get().tourStep;
        if (!current) return;
        const idx = TOUR_SEQUENCE.indexOf(current);
        const next = TOUR_SEQUENCE[idx + 1] ?? null;
        // Clear spotlight so new step starts with full dim until measured
        set({ tourStep: next, spotlightRect: null });
      },

      completeOnboarding: () =>
        set({ hasCompletedOnboarding: true, tourStep: null, spotlightRect: null }),

      resetOnboarding: () =>
        set({ hasCompletedOnboarding: false, tourStep: null, spotlightRect: null }),

      setSpotlight: (rect) => set({ spotlightRect: rect }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist tour progress — spotlight is ephemeral
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        tourStep: state.tourStep,
      }),
    }
  )
);
