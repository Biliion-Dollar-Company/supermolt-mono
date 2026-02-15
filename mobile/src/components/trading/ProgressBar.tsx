/**
 * ProgressBar with TP Targets
 * Shows progress towards take-profit targets
 * Only the next target is active, others are disabled
 */

import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// Take Profit Targets Config
export const TP_TARGETS = [
  { multiplier: 1.5, label: 'TP1' },
  { multiplier: 2.0, label: 'TP2' },
  { multiplier: 3.0, label: 'TP3' },
];

// Consistent colors
const ACTIVE_COLOR = '#F97316';
const DISABLED_COLOR = 'rgba(255,255,255,0.3)';

interface ProgressBarProps {
  progress: number; // 0-1
  nextTarget: number | null;
  targetsHit: number[];
  pnlPct: number;
}

export function ProgressBar({
  progress,
  nextTarget,
  targetsHit,
  pnlPct,
}: ProgressBarProps) {
  const safeTargetsHit = targetsHit || [];
  const clampedProgress = Math.min(Math.max(progress || 0, 0), 1);
  const isPositive = (pnlPct || 0) >= 0;

  const progressStyle = useAnimatedStyle(() => ({
    width: withSpring(`${clampedProgress * 100}%` as any, {
      damping: 20,
      stiffness: 100,
    }),
  }));

  return (
    <View className="mt-4">
      {/* Target labels */}
      <View className="flex-row justify-between mb-2">
        {TP_TARGETS.map((target, i) => {
          const isHit = safeTargetsHit.includes(i + 1);
          const isCurrent = target.multiplier === nextTarget;
          const isActive = isHit || isCurrent;

          return (
            <View key={target.label} className="flex-row items-center gap-1">
              <Text
                style={{ color: isActive ? ACTIVE_COLOR : DISABLED_COLOR }}
                className="text-[10px] font-bold"
              >
                {target.label}
              </Text>
              <Text
                style={{ color: isActive ? ACTIVE_COLOR : DISABLED_COLOR }}
                className="text-[10px] font-mono"
              >
                {target.multiplier}x
              </Text>
            </View>
          );
        })}
      </View>

      {/* Progress track */}
      <View className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        {/* Progress fill */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              borderRadius: 9999,
              backgroundColor: isPositive ? ACTIVE_COLOR : '#ef4444',
            },
            progressStyle,
          ]}
        />
      </View>

      {/* TP milestone dots */}
      <View className="relative h-5 mt-[-10px]">
        {TP_TARGETS.map((target, i) => {
          const isHit = safeTargetsHit.includes(i + 1);
          const isCurrent = target.multiplier === nextTarget;
          const positionPct = ((i + 1) / TP_TARGETS.length) * 100;

          return (
            <View
              key={target.label}
              className="absolute"
              style={{
                left: `${positionPct}%`,
                marginLeft: -8,
              }}
            >
              {isHit ? (
                <View
                  className="w-4 h-4 rounded-full items-center justify-center"
                  style={{ backgroundColor: ACTIVE_COLOR }}
                >
                  <Ionicons name="checkmark" size={10} color="#000" />
                </View>
              ) : (
                <View
                  className="w-3 h-3 rounded-full border-2"
                  style={{
                    borderColor: isCurrent ? ACTIVE_COLOR : DISABLED_COLOR,
                    backgroundColor: '#1a1a1a',
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
