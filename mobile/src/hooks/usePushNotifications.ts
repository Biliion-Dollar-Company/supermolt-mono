/**
 * Push Notifications Hook
 * Handles permission requests, token registration, and foreground notifications
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/lib/api/client';
import { useSettingsStore } from '@/store/settings';
import { useAuthStore } from '@/store/auth';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Not a physical device, skipping registration');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'f30ebaa8-689e-4e47-91c5-69d3fc3406c3',
    });
    return tokenData.data;
  } catch (err) {
    console.error('[Push] Failed to get push token:', err);
    return null;
  }
}

async function registerTokenWithBackend(pushToken: string): Promise<void> {
  try {
    await apiFetch('/notifications/register', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
    });
    console.log('[Push] Token registered with backend');
  } catch (err) {
    console.error('[Push] Failed to register token with backend:', err);
  }
}

async function unregisterTokenFromBackend(): Promise<void> {
  try {
    await apiFetch('/notifications/register', { method: 'DELETE' });
    console.log('[Push] Token unregistered from backend');
  } catch (err) {
    console.error('[Push] Failed to unregister token:', err);
  }
}

export function usePushNotifications() {
  const router = useRouter();
  const pushEnabled = useSettingsStore((s) => s.pushNotifications);
  const agentProfile = useAuthStore((s) => s.agentProfile);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const registeredRef = useRef(false);

  // Register push token when user is authenticated and setting is enabled
  useEffect(() => {
    if (!agentProfile || !pushEnabled) {
      // If disabled, unregister
      if (registeredRef.current && !pushEnabled) {
        unregisterTokenFromBackend();
        registeredRef.current = false;
      }
      return;
    }

    let cancelled = false;

    async function setup() {
      const token = await registerForPushNotificationsAsync();
      if (token && !cancelled) {
        await registerTokenWithBackend(token);
        registeredRef.current = true;
      }
    }

    setup();

    return () => { cancelled = true; };
  }, [agentProfile?.id, pushEnabled]);

  // Listen for notifications received while app is foregrounded
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] Notification received:', notification.request.content.title);
    });

    // Handle tapping on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      // Deep link based on notification type
      if (data?.type === 'trade_recommendation' && data?.tokenSymbol) {
        router.push({
          pathname: '/(modals)/approve-tx',
          params: {
            action: 'BUY',
            tokenSymbol: data.tokenSymbol as string,
            tokenMint: (data.tokenMint as string) || '',
            reason: 'Push notification trade signal',
          },
        });
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [router]);
}
