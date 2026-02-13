import { View, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { TwitterLoginButton } from '@/components/auth';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

export default function LoginScreen() {
  const { isLoading } = useAuth();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.surface.primary }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        {/* Logo / Branding */}
        <View style={{ alignItems: 'center', marginBottom: 56 }}>
          {/* PFP with glow */}
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: colors.brand.primary + '15',
              borderWidth: 2,
              borderColor: colors.brand.primary + '40',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              shadowColor: colors.brand.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Image
              source={require('../assets/images/pfp.png')}
              style={{ width: 90, height: 90, borderRadius: 45 }}
              resizeMode="contain"
            />
          </View>
          <Text
            variant="h1"
            color="brand"
            style={{ fontSize: 36, letterSpacing: -1.2 }}
          >
            SuperMolt
          </Text>
          <Text
            variant="body"
            color="muted"
            style={{ marginTop: 8, textAlign: 'center', fontSize: 15 }}
          >
            AI-Powered Trading on Solana
          </Text>
        </View>

        {/* Login */}
        <View style={{ width: '100%', gap: 16 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.brand.primary} />
          ) : (
            <TwitterLoginButton />
          )}
        </View>

        {/* Divider */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            marginTop: 32,
            gap: 12,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: colors.surface.tertiary }} />
          <Text variant="caption" color="muted">
            Powered by Privy
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.surface.tertiary }} />
        </View>

        {/* Footer */}
        <View style={{ position: 'absolute', bottom: 32, alignItems: 'center' }}>
          <Text variant="caption" color="muted" style={{ textAlign: 'center', lineHeight: 18 }}>
            By signing in, you agree to the Terms of Service
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
