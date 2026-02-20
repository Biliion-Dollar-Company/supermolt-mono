import '../global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Orbitron_600SemiBold, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { PrivyProvider } from '@privy-io/expo';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { AuthProvider } from '@/lib/auth/provider';
import { WebSocketProvider } from '@/lib/websocket/provider';
import { colors } from '@/theme/colors';

// Custom dark theme — forces ALL React Navigation scene containers (Stack + Tabs)
// to use a dark background instead of the default white.
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#080808',
    card: 'rgba(8, 8, 8, 0.92)',
  },
};

SplashScreen.preventAutoHideAsync();

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || '';
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    // Hide splash once fonts are ready
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <AuthProvider>
        <WebSocketProvider>
          <ThemeProvider value={AppTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
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
              name="onboarding"
              options={{ animation: 'fade', gestureEnabled: false }}
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
          </ThemeProvider>
        </WebSocketProvider>
      </AuthProvider>
    </PrivyProvider>
  );
}
