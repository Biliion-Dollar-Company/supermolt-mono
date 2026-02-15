/**
 * PortfolioHero - Futuristic HUD-style portfolio display
 * Animated orbital rings, glowing value, pulsing indicators
 */

import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SCREEN_WIDTH = Dimensions.get('window').width;
const RING_SIZE = SCREEN_WIDTH * 0.6;

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

  // Animated values
  const pulse = useSharedValue(0);
  const orbit = useSharedValue(0);
  const breathe = useSharedValue(0);
  const scanline = useSharedValue(0);

  useEffect(() => {
    // Pulse animation
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    // Orbital rotation
    orbit.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1, false,
    );
    // Breathe glow
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    // Scan line
    scanline.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value}deg` }],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-orbit.value * 0.6}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.05, 0.2]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.95, 1.05]) }],
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.4, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.4]) }],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    top: interpolate(scanline.value, [0, 1], [-2, 200]),
    opacity: interpolate(scanline.value, [0, 0.1, 0.5, 0.9, 1], [0, 0.6, 0.3, 0.6, 0]),
  }));

  // Format value parts
  const wholePart = Math.floor(totalValue);
  const decimalPart = (totalValue % 1).toFixed(2).slice(1); // .XX

  return (
    <View style={styles.container}>
      {/* Radial glow background */}
      <Animated.View style={[styles.radialGlow, { backgroundColor: accentColor }, glowStyle]} />

      {/* Scanline effect */}
      <Animated.View style={[styles.scanline, scanStyle]} />

      {/* HUD Grid lines */}
      <View style={styles.gridContainer}>
        <Svg width={SCREEN_WIDTH} height={200} style={StyleSheet.absoluteFill}>
          {/* Horizontal grid */}
          {[40, 80, 120, 160].map((y) => (
            <Line key={`h${y}`} x1="0" y1={y} x2={SCREEN_WIDTH} y2={y} stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
          ))}
          {/* Vertical grid */}
          {Array.from({ length: 8 }).map((_, i) => {
            const x = (SCREEN_WIDTH / 8) * (i + 1);
            return <Line key={`v${i}`} x1={x} y1="0" x2={x} y2="200" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />;
          })}
        </Svg>
      </View>

      {/* Animated orbital rings */}
      <View style={styles.ringsContainer}>
        {/* Pulse expanding ring */}
        <Animated.View style={[styles.pulseRing, { borderColor: accentColor }, pulseRingStyle]} />

        {/* Outer orbital ring */}
        <Animated.View style={[styles.orbitalRing, outerRingStyle]}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_SIZE / 2 - 2}
              fill="none" stroke={`${colors.brand.primary}15`} strokeWidth="1"
              strokeDasharray="4,12"
            />
            {/* Orbital dot */}
            <Circle cx={RING_SIZE / 2} cy={2} r={3} fill={colors.brand.primary} opacity={0.8} />
            <Circle cx={RING_SIZE / 2} cy={2} r={6} fill={colors.brand.primary} opacity={0.2} />
          </Svg>
        </Animated.View>

        {/* Inner orbital ring */}
        <Animated.View style={[styles.innerRing, innerRingStyle]}>
          <Svg width={RING_SIZE * 0.72} height={RING_SIZE * 0.72}>
            <Circle
              cx={RING_SIZE * 0.36} cy={RING_SIZE * 0.36} r={RING_SIZE * 0.36 - 2}
              fill="none" stroke={`${accentColor}20`} strokeWidth="1"
              strokeDasharray="2,8"
            />
            <Circle cx={RING_SIZE * 0.36} cy={2} r={2.5} fill={accentColor} opacity={0.6} />
          </Svg>
        </Animated.View>
      </View>

      {/* Center content */}
      <View style={styles.centerContent}>
        {/* Label */}
        <View style={styles.labelRow}>
          <View style={[styles.labelDot, { backgroundColor: accentColor }]} />
          <Text style={styles.label}>PORTFOLIO VALUE</Text>
          <View style={[styles.labelDot, { backgroundColor: accentColor }]} />
        </View>

        {/* Giant value */}
        <View style={styles.valueRow}>
          <Text style={styles.valueWhole}>{wholePart}</Text>
          <Text style={styles.valueDecimal}>{decimalPart}</Text>
          <Text style={styles.valueSuffix}> SOL</Text>
        </View>

        {/* P&L Change */}
        <View style={styles.changeContainer}>
          <View style={[styles.changePill, { backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }]}>
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
            <View style={styles.tradesPill}>
              <View style={styles.tradesDot} />
              <Text style={styles.tradesText}>
                {todayTrades} trade{todayTrades !== 1 ? 's' : ''} today
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Corner HUD marks */}
      <View style={[styles.cornerMark, styles.cornerTL]}>
        <View style={[styles.cornerH, { backgroundColor: `${colors.brand.primary}30` }]} />
        <View style={[styles.cornerV, { backgroundColor: `${colors.brand.primary}30` }]} />
      </View>
      <View style={[styles.cornerMark, styles.cornerTR]}>
        <View style={[styles.cornerH, styles.cornerHRight, { backgroundColor: `${colors.brand.primary}30` }]} />
        <View style={[styles.cornerV, styles.cornerVRight, { backgroundColor: `${colors.brand.primary}30` }]} />
      </View>
      <View style={[styles.cornerMark, styles.cornerBL]}>
        <View style={[styles.cornerH, { backgroundColor: `${colors.brand.primary}30` }]} />
        <View style={[styles.cornerV, styles.cornerVBottom, { backgroundColor: `${colors.brand.primary}30` }]} />
      </View>
      <View style={[styles.cornerMark, styles.cornerBR]}>
        <View style={[styles.cornerH, styles.cornerHRight, { backgroundColor: `${colors.brand.primary}30` }]} />
        <View style={[styles.cornerV, styles.cornerVBottomRight, { backgroundColor: `${colors.brand.primary}30` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 220,
  },
  radialGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  ringsContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitalRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  innerRing: {
    position: 'absolute',
    width: RING_SIZE * 0.72,
    height: RING_SIZE * 0.72,
  },
  pulseRing: {
    position: 'absolute',
    width: RING_SIZE * 0.55,
    height: RING_SIZE * 0.55,
    borderRadius: RING_SIZE * 0.275,
    borderWidth: 1.5,
  },
  centerContent: {
    alignItems: 'center',
    zIndex: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  labelDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  valueWhole: {
    color: colors.text.primary,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -2,
  },
  valueDecimal: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  valueSuffix: {
    color: colors.text.muted,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  changeArrow: {
    fontSize: 9,
    fontWeight: '700',
  },
  changeValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changePercent: {
    fontSize: 11,
    fontWeight: '500',
  },
  tradesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tradesDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.brand.primary,
  },
  tradesText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  // Corner HUD marks
  cornerMark: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
  cornerTL: { top: 8, left: 16 },
  cornerTR: { top: 8, right: 16 },
  cornerBL: { bottom: 8, left: 16 },
  cornerBR: { bottom: 8, right: 16 },
  cornerH: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 16,
    height: 1,
  },
  cornerHRight: {
    left: undefined,
    right: 0,
  },
  cornerV: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 16,
  },
  cornerVRight: {
    left: undefined,
    right: 0,
  },
  cornerVBottom: {
    top: undefined,
    bottom: 0,
  },
  cornerVBottomRight: {
    top: undefined,
    bottom: 0,
    left: undefined,
    right: 0,
  },
});
