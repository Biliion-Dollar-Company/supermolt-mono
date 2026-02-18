import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TourStep = 'home' | 'arena' | 'agents' | 'complete' | null;

interface OnboardingStore {
  hasCompletedOnboarding: boolean;
  tourStep: TourStep;
  startTour: () => void;
  advanceTour: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const TOUR_SEQUENCE: TourStep[] = ['home', 'arena', 'agents', 'complete'];

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      tourStep: null,

      startTour: () => set({ tourStep: 'home' }),

      advanceTour: () => {
        const current = get().tourStep;
        if (!current) return;
        const idx = TOUR_SEQUENCE.indexOf(current);
        const next = TOUR_SEQUENCE[idx + 1] ?? null;
        set({ tourStep: next });
      },

      completeOnboarding: () =>
        set({ hasCompletedOnboarding: true, tourStep: null }),

      resetOnboarding: () =>
        set({ hasCompletedOnboarding: false, tourStep: null }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
