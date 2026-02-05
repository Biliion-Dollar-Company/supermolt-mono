import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TargetHit } from '@/store/portfolio';

interface MilestoneProgressProps {
  currentMultiplier: number;
  targetsHit: TargetHit[];
  nextTarget: number | null;
  progress: number | null;
}

// Default TP targets (should come from config)
const DEFAULT_TARGETS = [2.0, 3.0, 5.0];

export function MilestoneProgress({
  currentMultiplier,
  targetsHit,
  nextTarget,
  progress,
}: MilestoneProgressProps) {
  const maxTarget = Math.max(...DEFAULT_TARGETS);

  // Calculate position percentages
  const getPosition = (multiplier: number) => {
    return ((multiplier - 1) / (maxTarget - 1)) * 100;
  };

  const currentPosition = Math.min(100, Math.max(0, getPosition(currentMultiplier)));

  // Check if a target has been hit
  const isTargetHit = (targetMultiplier: number) => {
    return targetsHit.some(
      (t) => Math.abs(t.targetMultiplier - targetMultiplier) < 0.01
    );
  };

  return (
    <View className="mt-4">
      {/* Progress bar container */}
      <View className="relative h-6">
        {/* Background track */}
        <View className="absolute top-2 left-0 right-0 h-2 bg-background rounded-full" />

        {/* Filled progress */}
        <View
          className="absolute top-2 left-0 h-2 bg-brand-primary rounded-full"
          style={{ width: `${currentPosition}%` }}
        />

        {/* Milestone markers */}
        {DEFAULT_TARGETS.map((target, index) => {
          const position = getPosition(target);
          const hit = isTargetHit(target);
          const isPending = currentMultiplier >= target && !hit;

          return (
            <View
              key={target}
              className="absolute top-0 -ml-3"
              style={{ left: `${position}%` }}
            >
              {hit ? (
                <View className="w-6 h-6 rounded-full bg-success items-center justify-center">
                  <Ionicons name="checkmark" size={14} color="white" />
                </View>
              ) : isPending ? (
                <View className="w-6 h-6 rounded-full bg-warning items-center justify-center animate-pulse">
                  <View className="w-3 h-3 rounded-full bg-white" />
                </View>
              ) : (
                <View className="w-6 h-6 rounded-full bg-background border-2 border-border items-center justify-center">
                  <View className="w-2 h-2 rounded-full bg-foreground-muted" />
                </View>
              )}
            </View>
          );
        })}

        {/* Current position indicator */}
        <View
          className="absolute top-1.5 -ml-1.5"
          style={{ left: `${currentPosition}%` }}
        >
          <View className="w-3 h-3 rounded-full bg-brand-primary border-2 border-white" />
        </View>
      </View>

      {/* Labels */}
      <View className="flex-row justify-between mt-1">
        <Text className="text-foreground-muted text-xs">1x</Text>
        <View className="flex-row gap-1">
          {DEFAULT_TARGETS.map((target) => (
            <Text key={target} className="text-foreground-muted text-xs">
              {target}x
            </Text>
          ))}
        </View>
      </View>

      {/* Current status */}
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-foreground-secondary text-xs">
          Current: {currentMultiplier.toFixed(2)}x
        </Text>
        {nextTarget && (
          <Text className="text-brand-primary text-xs">
            Next: {nextTarget}x
            {progress !== null && ` (${(progress * 100).toFixed(0)}%)`}
          </Text>
        )}
      </View>
    </View>
  );
}
