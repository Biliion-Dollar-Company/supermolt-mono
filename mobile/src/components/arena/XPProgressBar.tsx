import { View } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';

interface XPProgressBarProps {
  xp: number;
  level: number;
  levelName: string;
  xpForNextLevel: number;
}

export function XPProgressBar({ xp, level, levelName, xpForNextLevel }: XPProgressBarProps) {
  const progress = xpForNextLevel > 0 ? Math.min(xp / xpForNextLevel, 1) : 1;

  return (
    <View style={{ gap: 6 }}>
      {/* Level Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="label" color="brand" style={{ fontWeight: '700' }}>
            Lv.{level}
          </Text>
          <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>
            {levelName}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          {xp} / {xpForNextLevel} XP
        </Text>
      </View>

      {/* Progress Bar */}
      <View
        style={{
          height: 8,
          backgroundColor: colors.surface.tertiary,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: colors.brand.primary,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}
