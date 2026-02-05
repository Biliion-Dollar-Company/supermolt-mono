import { useSettingsStore } from '@/store/settings';

export function useSettings() {
  const store = useSettingsStore();

  return {
    settings: {
      autoSign: store.autoSign,
      haptics: store.haptics,
      pushNotifications: store.pushNotifications,
      sound: store.sound,
      theme: store.theme,
    },
    updateSetting: store.updateSetting,
    reset: store.reset,
  };
}
