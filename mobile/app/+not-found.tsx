import { View } from 'react-native';
import { Link } from 'expo-router';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';

export default function NotFoundScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface.primary,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <Text variant="h2" color="primary">Page Not Found</Text>
      <Link href="/" style={{ padding: 8 }}>
        <Text variant="body" color="brand">Go Home</Text>
      </Link>
    </View>
  );
}
