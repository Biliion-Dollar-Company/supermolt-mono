import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/hooks/useAuth';

interface TwitterLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function TwitterLoginButton({ onSuccess, onError }: TwitterLoginButtonProps) {
  const { loginWithTwitter, isLoading } = useAuth();

  async function handlePress() {
    try {
      await loginWithTwitter();
      onSuccess?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }

  return (
    <TouchableOpacity
      disabled={isLoading}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 24,
          gap: 12,
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <>
            <Text
              variant="body"
              style={{
                color: '#000000',
                fontSize: 20,
                fontWeight: '800',
                lineHeight: 24,
              }}
            >
              𝕏
            </Text>
            <Text
              variant="label"
              style={{
                color: '#000000',
                fontSize: 17,
                fontWeight: '600',
                letterSpacing: -0.3,
              }}
            >
              Continue with X
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
