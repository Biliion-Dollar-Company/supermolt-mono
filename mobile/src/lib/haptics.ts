import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/settings';

function isEnabled(): boolean {
  return useSettingsStore.getState().haptics;
}

export function lightImpact() {
  if (isEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function mediumImpact() {
  if (isEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function heavyImpact() {
  if (isEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export function successNotification() {
  if (isEnabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function errorNotification() {
  if (isEnabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function selectionFeedback() {
  if (isEnabled()) Haptics.selectionAsync();
}
