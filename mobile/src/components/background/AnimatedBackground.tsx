import { StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { useEffect, useRef } from 'react';

const { width: W, height: H } = Dimensions.get('window');
const GRID_GAP = 68;

export function AnimatedBackground() {
  const pulse1 = useSharedValue(0.7);
  const pulse2 = useSharedValue(0.3);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pulse1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.5, { duration: 4500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    t2.current = setTimeout(() => {
      pulse2.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.2, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }, 2200);

    return () => {
      if (t2.current) clearTimeout(t2.current);
    };
  }, []);

  const glow1Style = useAnimatedStyle(() => ({ opacity: pulse1.value }));
  const glow2Style = useAnimatedStyle(() => ({ opacity: pulse2.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      {/* Base void */}
      <LinearGradient
        colors={['#080808', '#0c0c0c', '#080808']}
        style={StyleSheet.absoluteFill}
      />

      {/* Primary glow — orange horizon at bottom */}
      <Animated.View style={[styles.glow1, glow1Style]}>
        <LinearGradient
          colors={['transparent', 'rgba(249,115,22,0.14)', 'rgba(249,115,22,0.06)', 'transparent']}
          locations={[0, 0.4, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Secondary glow — purple accent top-right */}
      <Animated.View style={[styles.glow2, glow2Style]}>
        <LinearGradient
          colors={['transparent', 'rgba(153,69,255,0.08)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Grid */}
      <Svg width={W} height={H}>
        {Array.from({ length: Math.ceil(H / GRID_GAP) + 1 }).map((_, i) => (
          <Line
            key={`h${i}`}
            x1="0" y1={i * GRID_GAP} x2={W} y2={i * GRID_GAP}
            stroke="rgba(255,255,255,0.035)" strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: Math.ceil(W / GRID_GAP) + 1 }).map((_, i) => (
          <Line
            key={`v${i}`}
            x1={i * GRID_GAP} y1="0" x2={i * GRID_GAP} y2={H}
            stroke="rgba(255,255,255,0.02)" strokeWidth="0.5"
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: -1,
  },
  glow1: {
    position: 'absolute',
    bottom: -H * 0.05,
    left: -W * 0.25,
    right: -W * 0.25,
    height: H * 0.65,
  },
  glow2: {
    position: 'absolute',
    top: -H * 0.15,
    right: -W * 0.2,
    width: W * 0.9,
    height: H * 0.55,
  },
});
