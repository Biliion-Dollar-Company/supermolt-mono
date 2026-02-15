/**
 * PnLChart - Enhanced profit/loss chart
 * Taller chart with stronger visual presence
 */

import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
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
const CHART_HEIGHT = 160;
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
      // Smooth curve using quadratic bezier
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

  return (
    <View style={styles.container}>
      {/* Timeframe selector */}
      <View style={styles.timeframeRow}>
        <Text style={styles.sectionLabel}>PERFORMANCE</Text>
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
              <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <Stop offset="70%" stopColor={strokeColor} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
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
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="4,6"
            />
          ))}

          {/* Area fill */}
          {areaPath && <Path d={areaPath} fill="url(#chartGrad)" />}

          {/* Line */}
          {path && (
            <Path
              d={path}
              stroke={strokeColor}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current point indicator */}
          {path && data.length > 0 && (
            <>
              <Circle cx={lastX} cy={lastY} r="5" fill={strokeColor} opacity="0.3" />
              <Circle cx={lastX} cy={lastY} r="3" fill={strokeColor} />
            </>
          )}
        </Svg>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxisLabels}>
        <Text style={styles.axisLabel}>
          {startTime ? formatTimeLabel(startTime, timeframe) : ''}
        </Text>
        <Text style={styles.axisLabel}>Now</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  timeframeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 2,
  },
  timeframeButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  timeframeButtonActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  timeframeText: {
    color: 'rgba(255, 255, 255, 0.35)',
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
    marginTop: 8,
  },
  axisLabel: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: 10,
    fontWeight: '500',
  },
});
