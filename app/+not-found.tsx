import { View, Text } from 'react-native';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 bg-background items-center justify-center p-5">
        <Text className="text-foreground text-xl font-bold">
          This screen doesn't exist.
        </Text>
        <Link href="/" className="mt-4 py-2">
          <Text className="text-brand-primary">Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
