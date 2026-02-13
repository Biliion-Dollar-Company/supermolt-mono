import '../global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PrivyProvider } from '@privy-io/expo';
import { AuthProvider } from '@/lib/auth/provider';
import { WebSocketProvider } from '@/lib/websocket/provider';
import { colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || '';
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || '';

export default function RootLayout() {
  useEffect(() => {
    // Hide splash after providers initialize
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <AuthProvider>
        <WebSocketProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.surface.primary },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="agent/[id]"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="vote/[id]"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="create-agent"
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="configure-agent"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(modals)"
              options={{ presentation: 'modal' }}
            />
          </Stack>
        </WebSocketProvider>
      </AuthProvider>
    </PrivyProvider>
  );
}
