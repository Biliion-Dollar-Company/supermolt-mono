import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface.primary },
      }}
    />
  );
}
