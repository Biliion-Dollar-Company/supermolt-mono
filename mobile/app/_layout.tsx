import '../global.css';
import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrivyProvider } from '@privy-io/expo';
import { AuthProvider } from '@/lib/auth/provider';

// Privy configuration
const PRIVY_APP_ID = 'cmkraowkw0094i50c2n696dhz';
const PRIVY_CLIENT_ID = 'client-WY5gKa3L5wUkNj33WrNyYNXmVbVnvhLe6GZfk1zf9hQdV';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after a short delay
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
          <AuthProvider>
            <Slot />
            <StatusBar style="light" />
          </AuthProvider>
        </PrivyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
