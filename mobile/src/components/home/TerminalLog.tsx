/**
 * TerminalLog - Multi-line agent activity feed
 * Shows recent decisions in a terminal-style scrolling log
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
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
  buy: colors.status.success,
  sell: colors.status.error,
  skip: colors.text.muted,
  scanning: colors.brand.primary,
  analyzing: '#22d3ee',
  trading: colors.brand.primary,
  watching: colors.text.muted,
};

function getActionIcon(action: string): string {
  switch (action) {
    case 'buy': return '◈';
    case 'sell': return '◇';
    case 'skip': return '○';
    default: return '›';
  }
}

function formatTime(time: string): string {
  try {
    const d = new Date(time);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function DecisionLine({ decision, isLatest }: { decision: Decision; isLatest: boolean }) {
  const actionColor = ACTION_COLORS[decision.action] || colors.text.muted;
  const icon = getActionIcon(decision.action);

  return (
    <View style={logStyles.line}>
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
      <Text style={logStyles.time}>{formatTime(decision.time)}</Text>
    </View>
  );
}

export function TerminalLog({ message, type = 'scanning', decisions = [] }: TerminalLogProps) {
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const actionColor = ACTION_COLORS[type] || colors.brand.primary;
  const recentDecisions = decisions.slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDot} />
        <Text style={styles.headerText}>AGENT LOG</Text>
        <View style={styles.headerLine} />
      </View>

      {/* Decision history */}
      {recentDecisions.length > 0 && (
        <View style={styles.history}>
          {recentDecisions.map((d, i) => (
            <Animated.View
              key={`${d.time}-${i}`}
              entering={FadeIn.delay(i * 80).duration(300)}
            >
              <DecisionLine decision={d} isLatest={i === 0} />
            </Animated.View>
          ))}
        </View>
      )}

      {/* Current status line with blinking cursor */}
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
  icon: {
    fontSize: 10,
    fontWeight: '700',
    width: 14,
    textAlign: 'center',
  },
  action: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    width: 32,
  },
  token: {
    color: colors.brand.accent,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  reason: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  time: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 9,
    fontFamily: 'monospace',
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.primary,
  },
  headerText: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  history: {
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
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
    color: 'rgba(255, 255, 255, 0.6)',
    flex: 1,
  },
  cursor: {
    width: 7,
    height: 14,
    marginLeft: 3,
    borderRadius: 1,
  },
});
