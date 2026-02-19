import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { lightImpact } from '@/lib/haptics';
import { TourOverlay } from '@/components/onboarding/TourOverlay';
import { AnimatedBackground } from '@/components/background/AnimatedBackground';

export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Global animated background — persists across all tabs */}
      <AnimatedBackground />

      <Tabs
        // @ts-expect-error sceneContainerStyle exists in RN Nav v7 (bundled by Expo Router) but not in v6 types
        sceneContainerStyle={{ backgroundColor: 'transparent' }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand.primary,
          tabBarInactiveTintColor: colors.text.muted,
          tabBarStyle: {
            backgroundColor: 'rgba(8, 8, 8, 0.92)',
            borderTopColor: 'rgba(255, 255, 255, 0.08)',
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
        screenListeners={{
          tabPress: () => lightImpact(),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="arena"
          options={{
            title: 'Arena',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="agents"
          options={{
            title: 'Agents',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="configure"
          options={{
            title: 'Configure',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
          }}
        />
      </Tabs>
      <TourOverlay />
    </View>
  );
}
