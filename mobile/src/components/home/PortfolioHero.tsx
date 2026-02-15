/**
 * PortfolioHero - Giant animated P&L display
 * The first thing you see — massive portfolio value with glowing accent
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';

interface PortfolioHeroProps {
  totalValue: number;
  pnlChange: number;
  pnlPercent?: number;
  todayTrades?: number;
}

export function PortfolioHero({
  totalValue,
  pnlChange,
  pnlPercent = 0,
  todayTrades = 0,
}: PortfolioHeroProps) {
  const isPositive = pnlChange >= 0;
  const accentColor = isPositive ? colors.status.success : colors.status.error;

  // Breathing glow animation
  const glowOpacity = useSharedValue(0.15);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Background glow */}
      <Animated.View
        style={[
          styles.glow,
          { backgroundColor: accentColor },
          glowStyle,
        ]}
      />

      {/* Label */}
      <Text style={styles.label}>PORTFOLIO VALUE</Text>

      {/* Giant value */}
      <Text style={styles.value}>
        {totalValue.toFixed(2)}
        <Text style={styles.valueSuffix}> SOL</Text>
      </Text>

      {/* P&L change row */}
      <View style={styles.changeRow}>
        <View style={[styles.changePill, { backgroundColor: `${accentColor}20` }]}>
          <Text style={[styles.changeArrow, { color: accentColor }]}>
            {isPositive ? '▲' : '▼'}
          </Text>
          <Text style={[styles.changeValue, { color: accentColor }]}>
            {isPositive ? '+' : ''}{pnlChange.toFixed(3)} SOL
          </Text>
          {pnlPercent !== 0 && (
            <Text style={[styles.changePercent, { color: accentColor }]}>
              ({isPositive ? '+' : ''}{pnlPercent.toFixed(1)}%)
            </Text>
          )}
        </View>

        {todayTrades > 0 && (
          <View style={styles.todayPill}>
            <Text style={styles.todayText}>
              {todayTrades} trade{todayTrades !== 1 ? 's' : ''} today
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -40,
    width: 250,
    height: 250,
    borderRadius: 125,
    // blur simulated by large size + low opacity
  },
  label: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  value: {
    color: colors.text.primary,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  valueSuffix: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeArrow: {
    fontSize: 10,
    fontWeight: '700',
  },
  changeValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  changePercent: {
    fontSize: 12,
    fontWeight: '500',
  },
  todayPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  todayText: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
});
