/**
 * TerminalLog - Cinematic agent activity terminal
 * Matrix-inspired with scanlines, typing cursor, neon action colors
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';

export type TerminalActionType = 'scanning' | 'analyzing' | 'trading' | 'watching';

interface Decision {
  action: string;
  token: string;
  reason: string;
  time: string;
}

interface TerminalLogProps {
  message: string;
  type?: TerminalActionType;
  decisions?: Decision[];
}

const ACTION_COLORS: Record<string, string> = {
  buy: '#22c55e',
  sell: '#ef4444',
  skip: '#71717a',
  scanning: colors.brand.primary,
  analyzing: '#22d3ee',
  trading: colors.brand.primary,
  watching: '#a78bfa',
};

const ACTION_ICONS: Record<string, string> = {
  buy: '>>',
  sell: '<<',
  skip: '--',
  scanning: '>_',
  analyzing: '>>',
  trading: '>>',
  watching: '..',
};

function formatTime(time: string): string {
  try {
    const d = new Date(time);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function DecisionLine({ decision }: { decision: Decision }) {
  const actionColor = ACTION_COLORS[decision.action] || colors.text.muted;
  const icon = ACTION_ICONS[decision.action] || '>';

  return (
    <View style={logStyles.line}>
      <Text style={[logStyles.timestamp, { color: 'rgba(255, 255, 255, 0.15)' }]}>
        {formatTime(decision.time)}
      </Text>
      <Text style={[logStyles.icon, { color: actionColor }]}>{icon}</Text>
      <Text style={[logStyles.action, { color: actionColor }]}>
        {decision.action.toUpperCase()}
      </Text>
      {decision.token && (
        <Text style={logStyles.token}>${decision.token}</Text>
      )}
      <Text style={logStyles.reason} numberOfLines={1}>
        {decision.reason}
      </Text>
    </View>
  );
}

export function TerminalLog({ message, type = 'scanning', decisions = [] }: TerminalLogProps) {
  const cursorOpacity = useSharedValue(1);
  const scanline = useSharedValue(0);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400, easing: Easing.steps(1) }),
        withTiming(1, { duration: 400, easing: Easing.steps(1) }),
      ),
      -1, false,
    );
    scanline.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const scanStyle = useAnimatedStyle(() => ({
    top: `${interpolate(scanline.value, [0, 1], [0, 100])}%` as `${number}%`,
  }));

  const actionColor = ACTION_COLORS[type] || colors.brand.primary;
  const recentDecisions = decisions.slice(0, 5);

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(249, 115, 22, 0.03)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle scanline */}
      <Animated.View style={[styles.termScanline, scanStyle]} />

      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerDot, { backgroundColor: colors.status.success }]} />
          <View style={[styles.headerDot, { backgroundColor: colors.status.warning }]} />
          <View style={[styles.headerDot, { backgroundColor: colors.text.muted, opacity: 0.3 }]} />
        </View>
        <Text style={styles.headerTitle}>AGENT_LOG</Text>
        <Text style={styles.headerVersion}>v1.0</Text>
      </View>

      {/* Decision history */}
      {recentDecisions.length > 0 && (
        <View style={styles.history}>
          {recentDecisions.map((d, i) => (
            <Animated.View
              key={`${d.time}-${i}`}
              entering={FadeIn.delay(i * 60).duration(200)}
            >
              <DecisionLine decision={d} />
            </Animated.View>
          ))}
        </View>
      )}

      {/* Current status line */}
      <View style={styles.currentLine}>
        <Text style={[styles.prefix, { color: actionColor }]}>{'>'}</Text>
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
        <Animated.View
          style={[styles.cursor, cursorStyle, { backgroundColor: actionColor }]}
        />
      </View>
    </View>
  );
}

const logStyles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  timestamp: {
    fontSize: 9,
    fontFamily: 'monospace',
    width: 22,
    textAlign: 'right',
  },
  icon: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
    width: 18,
    textAlign: 'center',
  },
  action: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    width: 34,
    fontFamily: 'monospace',
  },
  token: {
    color: colors.brand.accent,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  reason: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.08)',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  termScanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(249, 115, 22, 0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 4,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerTitle: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: 'monospace',
    flex: 1,
    marginLeft: 4,
  },
  headerVersion: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontSize: 8,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  history: {
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
    paddingBottom: 6,
    marginBottom: 2,
  },
  currentLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginRight: 6,
    fontWeight: '700',
  },
  message: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    flex: 1,
  },
  cursor: {
    width: 7,
    height: 14,
    marginLeft: 3,
    borderRadius: 1,
  },
});
