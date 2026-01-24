import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
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
    <Button
      variant="primary"
      size="lg"
      loading={isLoading}
      onPress={handlePress}
      leftIcon={<Ionicons name="logo-twitter" size={20} color="white" />}
    >
      <Text variant="label" color="primary" weight="600">
        Continue with Twitter
      </Text>
    </Button>
  );
}
