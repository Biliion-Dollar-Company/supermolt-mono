import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { TwitterLoginButton } from '@/components/auth/TwitterLoginButton';
import { colors } from '@/theme/colors';

export default function LoginScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
        {/* Logo and title */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              backgroundColor: colors.glass.green,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="rocket" size={40} color={colors.brand.primary} />
          </View>
          <Text variant="h1" align="center">
            SuperRouter
          </Text>
          <Text variant="body" color="secondary" align="center" style={{ marginTop: 8 }}>
            AI-powered trading on Solana
          </Text>
        </View>

        {/* Login section */}
        <View style={{ gap: 24 }}>
          {/* Twitter login button */}
          <TwitterLoginButton />

          {/* Info card */}
          <Card variant="outlined" padding="md">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="information-circle" size={20} color={colors.text.secondary} />
              <Text variant="bodySmall" color="secondary" style={{ flex: 1 }}>
                Sign in with Twitter to connect your account and start trading with AI assistance.
              </Text>
            </View>
          </Card>
        </View>

        {/* Footer */}
        <View style={{ marginTop: 48 }}>
          <Text variant="caption" color="muted" align="center">
            By continuing, you agree to our Terms of Service
          </Text>
          <Text variant="caption" color="muted" align="center" style={{ marginTop: 4 }}>
            and Privacy Policy
          </Text>
        </View>
      </View>

      {/* Seeker badge */}
      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.surface.secondary,
            borderRadius: 999,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.status.success,
            }}
          />
          <Text variant="caption" color="secondary">
            Optimized for Solana Seeker
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
