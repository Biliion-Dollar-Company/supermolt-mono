/**
 * PnLChart - Futuristic performance chart with glow effects
 * Enhanced SVG with animated gradient fill, glowing line, pulsing endpoint
 */

import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Rect } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  FadeIn,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import type { PnLDataPoint, Timeframe } from '@/hooks/usePnLHistory';
import { colors } from '@/theme/colors';

interface PnLChartProps {
  data: PnLDataPoint[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  currentValue: number;
  pnlChange: number;
}

const TIMEFRAMES: Timeframe[] = ['1D', '3D', '7D', '30D'];
const CHART_HEIGHT = 170;
const CHART_WIDTH = Dimensions.get('window').width - 64;

function generatePath(
  data: PnLDataPoint[],
  width: number,
  height: number,
): { path: string; areaPath: string; lastX: number; lastY: number } {
  if (data.length === 0) return { path: '', areaPath: '', lastX: 0, lastY: 0 };

  const values = data.map(d => d.value);
  const minValue = Math.min(...values) * 0.9;
  const maxValue = Math.max(...values) * 1.1;
  const valueRange = maxValue - minValue || 1;
  const xStep = width / (data.length - 1);

  let path = '';
  let areaPath = '';
  let lastX = 0;
  let lastY = 0;

  data.forEach((point, i) => {
    const x = i * xStep;
    const y = height - ((point.value - minValue) / valueRange) * height;

    if (i === 0) {
      path = `M ${x} ${y}`;
      areaPath = `M ${x} ${height} L ${x} ${y}`;
    } else {
      const prevX = (i - 1) * xStep;
      const midX = (prevX + x) / 2;
      path += ` Q ${midX} ${lastY} ${x} ${y}`;
      areaPath += ` Q ${midX} ${lastY} ${x} ${y}`;
    }

    lastX = x;
    lastY = y;
  });

  areaPath += ` L ${width} ${height} Z`;

  return { path, areaPath, lastX, lastY };
}

function formatTimeLabel(timestamp: number, timeframe: Timeframe): string {
  const date = new Date(timestamp);
  switch (timeframe) {
    case '1D':
      return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    case '3D':
    case '7D':
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    case '30D':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    default:
      return '';
  }
}

export function PnLChart({
  data,
  timeframe,
  onTimeframeChange,
  currentValue,
  pnlChange,
}: PnLChartProps) {
  const { path, areaPath, lastX, lastY } = generatePath(data, CHART_WIDTH, CHART_HEIGHT);
  const isPositive = pnlChange >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';

  const startTime = data[0]?.timestamp;

  // Pulse for endpoint
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      {/* Header */}
      <View style={styles.timeframeRow}>
        <View style={styles.labelContainer}>
          <View style={[styles.labelDot, { backgroundColor: strokeColor }]} />
          <Text style={styles.sectionLabel}>PERFORMANCE</Text>
        </View>
        <View style={styles.timeframeContainer}>
          {TIMEFRAMES.map((tf) => (
            <Pressable
              key={tf}
              onPress={() => onTimeframeChange(tf)}
              style={[
                styles.timeframeButton,
                tf === timeframe && styles.timeframeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.timeframeText,
                  tf === timeframe && styles.timeframeTextActive,
                ]}
              >
                {tf}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 10}>
          <Defs>
            <LinearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
              <Stop offset="50%" stopColor={strokeColor} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
              <Stop offset="50%" stopColor={strokeColor} stopOpacity="1" />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.8" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct) => (
            <Line
              key={pct}
              x1="0"
              y1={CHART_HEIGHT * pct}
              x2={CHART_WIDTH}
              y2={CHART_HEIGHT * pct}
              stroke="rgba(255,255,255,0.03)"
              strokeDasharray="3,8"
            />
          ))}

          {/* Zero line if mixed pos/neg */}
          <Line
            x1="0" y1={CHART_HEIGHT * 0.5}
            x2={CHART_WIDTH} y2={CHART_HEIGHT * 0.5}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />

          {/* Area fill */}
          {areaPath && <Path d={areaPath} fill="url(#chartGrad)" />}

          {/* Glow line (wider, transparent) */}
          {path && (
            <Path
              d={path}
              stroke={strokeColor}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.15}
            />
          )}

          {/* Main line */}
          {path && (
            <Path
              d={path}
              stroke="url(#lineGlow)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Endpoint pulse rings */}
          {path && data.length > 0 && (
            <>
              <Circle cx={lastX} cy={lastY} r="10" fill={strokeColor} opacity="0.08" />
              <Circle cx={lastX} cy={lastY} r="6" fill={strokeColor} opacity="0.15" />
              <Circle cx={lastX} cy={lastY} r="3.5" fill={strokeColor} />
              {/* Vertical reference line */}
              <Line
                x1={lastX} y1={lastY}
                x2={lastX} y2={CHART_HEIGHT}
                stroke={strokeColor}
                strokeWidth="0.5"
                strokeDasharray="2,4"
                opacity={0.3}
              />
            </>
          )}
        </Svg>
      </View>

      {/* X-axis */}
      <View style={styles.xAxisLabels}>
        <Text style={styles.axisLabel}>
          {startTime ? formatTimeLabel(startTime, timeframe) : ''}
        </Text>
        <View style={styles.nowIndicator}>
          <View style={[styles.nowDot, { backgroundColor: strokeColor }]} />
          <Text style={[styles.axisLabel, { color: strokeColor }]}>Now</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  timeframeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 2,
  },
  timeframeButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  timeframeButtonActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
  },
  timeframeText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    fontWeight: '700',
  },
  timeframeTextActive: {
    color: colors.brand.primary,
  },
  chartContainer: {
    marginHorizontal: -4,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  axisLabel: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: 10,
    fontWeight: '500',
  },
  nowIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
