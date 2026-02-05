/**
 * usePnLHistory Hook - PnL chart data
 * Provides historical profit/loss data for chart display
 */

import { useState, useCallback, useMemo } from 'react';

export interface PnLDataPoint {
  timestamp: number;
  value: number; // SOL value
}

export type Timeframe = '1D' | '3D' | '7D' | '30D';

// Generate mock data points
function generateMockData(timeframe: Timeframe): PnLDataPoint[] {
  const now = Date.now();
  const points: PnLDataPoint[] = [];

  let duration: number;
  let interval: number;

  switch (timeframe) {
    case '1D':
      duration = 24 * 60 * 60 * 1000; // 1 day
      interval = 60 * 60 * 1000; // 1 hour
      break;
    case '3D':
      duration = 3 * 24 * 60 * 60 * 1000; // 3 days
      interval = 4 * 60 * 60 * 1000; // 4 hours
      break;
    case '7D':
      duration = 7 * 24 * 60 * 60 * 1000; // 7 days
      interval = 12 * 60 * 60 * 1000; // 12 hours
      break;
    case '30D':
      duration = 30 * 24 * 60 * 60 * 1000; // 30 days
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
    default:
      duration = 3 * 24 * 60 * 60 * 1000;
      interval = 4 * 60 * 60 * 1000;
  }

  const numPoints = Math.floor(duration / interval);
  let value = 0.1; // Starting value

  for (let i = 0; i <= numPoints; i++) {
    const timestamp = now - duration + (i * interval);

    // Add some randomness but trend upward
    const change = (Math.random() - 0.3) * 0.05;
    value = Math.max(0.05, value + change);

    points.push({ timestamp, value });
  }

  // Ensure last point is current and ends higher
  points[points.length - 1] = { timestamp: now, value: 0.45 };

  return points;
}

export function usePnLHistory() {
  const [timeframe, setTimeframe] = useState<Timeframe>('3D');
  const [isLoading, setIsLoading] = useState(false);

  const data = useMemo(() => generateMockData(timeframe), [timeframe]);

  const changeTimeframe = useCallback((newTimeframe: Timeframe) => {
    setIsLoading(true);
    setTimeframe(newTimeframe);
    // Simulate loading
    setTimeout(() => setIsLoading(false), 200);
  }, []);

  const currentValue = data[data.length - 1]?.value ?? 0;
  const startValue = data[0]?.value ?? 0;
  const pnlChange = currentValue - startValue;
  const pnlChangePercent = startValue > 0 ? (pnlChange / startValue) * 100 : 0;

  return {
    data,
    timeframe,
    changeTimeframe,
    isLoading,
    currentValue,
    pnlChange,
    pnlChangePercent,
  };
}
