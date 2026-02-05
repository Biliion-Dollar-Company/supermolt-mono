/**
 * PnLChart - Line chart showing profit/loss history
 * Uses react-native-svg for rendering
 */

import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import type { PnLDataPoint, Timeframe } from '@/hooks/usePnLHistory';

interface PnLChartProps {
  data: PnLDataPoint[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  currentValue: number;
  pnlChange: number;
}

const TIMEFRAMES: Timeframe[] = ['1D', '3D', '7D', '30D'];
const CHART_HEIGHT = 120;
const CHART_WIDTH = Dimensions.get('window').width - 64; // Padding on both sides

// Generate SVG path from data points
function generatePath(
  data: PnLDataPoint[],
  width: number,
  height: number
): { path: string; areaPath: string } {
  if (data.length === 0) return { path: '', areaPath: '' };

  const values = data.map(d => d.value);
  const minValue = Math.min(...values) * 0.9;
  const maxValue = Math.max(...values) * 1.1;
  const valueRange = maxValue - minValue || 1;

  const xStep = width / (data.length - 1);

  let path = '';
  let areaPath = '';

  data.forEach((point, i) => {
    const x = i * xStep;
    const y = height - ((point.value - minValue) / valueRange) * height;

    if (i === 0) {
      path = `M ${x} ${y}`;
      areaPath = `M ${x} ${height} L ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
      areaPath += ` L ${x} ${y}`;
    }
  });

  // Close the area path
  areaPath += ` L ${width} ${height} Z`;

  return { path, areaPath };
}

// Format time label based on timeframe
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
  const { path, areaPath } = generatePath(data, CHART_WIDTH, CHART_HEIGHT);
  const isPositive = pnlChange >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#ef4444';
  const gradientId = 'pnlGradient';

  // Get time labels for x-axis
  const startTime = data[0]?.timestamp;
  const endTime = data[data.length - 1]?.timestamp;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Agent Profit</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{currentValue.toFixed(2)} SOL</Text>
            <Text style={[styles.change, { color: strokeColor }]}>
              {isPositive ? '+' : ''}{pnlChange.toFixed(3)}
            </Text>
          </View>
        </View>

        {/* Timeframe selector */}
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
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          <Line
            x1="0"
            y1={CHART_HEIGHT / 2}
            x2={CHART_WIDTH}
            y2={CHART_HEIGHT / 2}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="4,4"
          />

          {/* Area fill */}
          {areaPath && (
            <Path d={areaPath} fill={`url(#${gradientId})`} />
          )}

          {/* Line */}
          {path && (
            <Path
              d={path}
              stroke={strokeColor}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxisLabels}>
        <Text style={styles.axisLabel}>
          {startTime ? formatTimeLabel(startTime, timeframe) : ''}
        </Text>
        <Text style={styles.axisLabel}>→ Today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  value: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeframeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 2,
  },
  timeframeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeframeButtonActive: {
    backgroundColor: 'rgba(196, 247, 14, 0.2)',
  },
  timeframeText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  timeframeTextActive: {
    color: '#c4f70e',
  },
  chartContainer: {
    marginHorizontal: -8,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabel: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 10,
  },
});
