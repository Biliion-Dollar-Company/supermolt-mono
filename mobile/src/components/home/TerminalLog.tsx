/**
 * TerminalLog - Single-line terminal output
 * Displays agent's current action in monospace style
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

export type TerminalActionType = 'scanning' | 'analyzing' | 'trading' | 'watching';

interface TerminalLogProps {
  message: string;
  type?: TerminalActionType;
}

// Color based on action type
const ACTION_COLORS: Record<TerminalActionType, string> = {
  scanning: '#c4f70e',   // Neon green
  analyzing: '#22d3ee',  // Cyan
  trading: '#f97316',    // Orange
  watching: '#a1a1aa',   // Gray
};

export function TerminalLog({ message, type = 'scanning' }: TerminalLogProps) {
  const cursorOpacity = useSharedValue(1);

  // Blinking cursor animation
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withTiming(0, {
        duration: 500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Infinite repeats
      true // Reverse
    );
  }, []);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const actionColor = ACTION_COLORS[type];

  return (
    <View style={styles.container}>
      <Text style={[styles.prefix, { color: actionColor }]}>&gt;</Text>
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      <Animated.View style={[styles.cursor, cursorStyle, { backgroundColor: actionColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 4,
    marginBottom: 8,
  },
  prefix: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginRight: 6,
    fontWeight: '600',
  },
  message: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
  },
  cursor: {
    width: 6,
    height: 14,
    marginLeft: 2,
    borderRadius: 1,
  },
});
