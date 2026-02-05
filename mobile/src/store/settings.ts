import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Settings {
  autoSign: boolean;
  haptics: boolean;
  pushNotifications: boolean;
  sound: boolean;
  theme: 'dark' | 'light' | 'system';
}

interface SettingsState extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

const defaultSettings: Settings = {
  autoSign: false,
  haptics: true,
  pushNotifications: true,
  sound: true,
  theme: 'dark',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateSetting: (key, value) => set({ [key]: value }),

      reset: () => set(defaultSettings),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
