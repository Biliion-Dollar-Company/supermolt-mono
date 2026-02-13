import { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.surface.tertiary,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <Animated.View
      style={{
        backgroundColor: colors.surface.secondary,
        borderRadius: 12,
        padding: 16,
        gap: 10,
      }}
    >
      <Skeleton width="60%" height={16} />
      <Skeleton width="100%" height={12} />
      <Skeleton width="40%" height={12} />
    </Animated.View>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <Animated.View
      style={{
        backgroundColor: colors.surface.secondary,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Skeleton width={32} height={32} borderRadius={16} />
      <Animated.View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="30%" height={10} />
      </Animated.View>
      <Animated.View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Skeleton width={60} height={14} />
        <Skeleton width={40} height={10} />
      </Animated.View>
    </Animated.View>
  );
}
